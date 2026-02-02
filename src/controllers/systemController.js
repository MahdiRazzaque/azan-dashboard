const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const Bottleneck = require('bottleneck');
const { DateTime } = require('luxon');
const healthCheck = require('@services/system/healthCheck');
const schedulerService = require('@services/core/schedulerService');
const sseService = require('@services/system/sseService');
const automationService = require('@services/core/automationService');
const audioAssetService = require('@services/system/audioAssetService');
const diagnosticsService = require('@services/system/diagnosticsService');
const configService = require('@config');
const voiceService = require('@services/system/voiceService');
const { ProviderFactory } = require('@providers');
const OutputFactory = require('../outputs');
const workflowService = require('@services/system/configurationWorkflowService');
const configUnmasker = require('@utils/configUnmasker');
const { getSafeAgent } = require('@utils/networkUtils');
const { 
    CALCULATION_METHODS, 
    ASR_JURISTIC_METHODS, 
    LATITUDE_ADJUSTMENT_METHODS, 
    MIDNIGHT_MODES 
} = require('@utils/constants');

// Rate limiter for file system operations to prevent EMFILE errors and memory spikes
const fsLimiter = new Bottleneck({
    maxConcurrent: 50
});

/**
 * Controller for system-related operations, handling health checks, logs,
 * automation diagnostics, and hardware testing.
 */
const systemController = {
    /**
     * Retrieves the overall system health status.
     * Returns a 503 service unavailable status if critical components are offline.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {void}
     */
    getHealth: (req, res) => {
        const health = healthCheck.getHealth();
        
        // Assess critical dependencies to determine overall system availability
        const isLocalHealthy = health.local?.healthy;
        const isTTSHealthy = health.tts?.healthy;
        const isPrimaryHealthy = health.primarySource?.healthy;
        const isBackupHealthy = health.backupSource?.healthy;
        
        // Determine if a backup source is configured and required
        const isBackupNeeded = configService.get().sources.backup?.enabled !== false;
        const isSourceHealthy = isPrimaryHealthy || (isBackupNeeded && isBackupHealthy);

        if (!isLocalHealthy || !isTTSHealthy || !isSourceHealthy) {
            return res.status(503).json(health);
        }

        res.json(health);
    },

    /**
     * Toggles automated health monitoring for a specific service.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the toggle operation completes.
     */
    toggleHealthCheck: async (req, res) => {
        const { serviceId, enabled } = req.body;
        if (!serviceId || typeof enabled !== 'boolean') {
            return res.status(400).json({ success: false, error: 'serviceId and enabled (boolean) are required.' });
        }
        await healthCheck.toggle(serviceId, enabled);
        res.json({ success: true });
    },

    /**
     * Forces a fresh health check for a specific target, bypassing the "Monitoring Disabled" config.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    forceRefreshHealth: async (req, res) => {
        const { target, params } = req.body;
        const result = await healthCheck.refresh(target || 'all', params, { force: true });
        res.json(result);
    },

    /**
     * Initiates a fresh health check for specified system components.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the health check completes.
     */
    refreshHealth: async (req, res) => {
        const { target, params } = req.body;
        // Default to checking all components
        const result = await healthCheck.refresh(target || 'all', params);
        res.json(result);
    },

    /**
     * Retrieves a list of currently scheduled background jobs.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    getJobs: (req, res) => {
        /**
         * Checks and returns the currently scheduled background jobs.
         */
        const checkJobs = () => {
            if (schedulerService.getJobs) {
                res.json(schedulerService.getJobs());
            } else {
                res.json({ maintenance: [], automation: [] });
            }
        };

        checkJobs();
    },

    /**
     * Establishes a Server-Sent Events (SSE) connection for streaming system logs.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    getLogs: (req, res) => {
        sseService.addClient(res);
    },

    /**
     * Catalogues available custom and cached audio files from the server's storage,
     * including compatibility metadata and pagination support.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} Sends a JSON response with the file listings and metadata.
     */
    getAudioFiles: async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const result = await systemController._getAudioFilesWithMetadata(page, limit);
        res.json(result);
    },

    /**
     * Internal helper to scan directories and attach metadata from sidecar files.
     * Supports pagination by slicing the file list before I/O operations.
     * 
     * @param {number} page - Current page number.
     * @param {number} limit - Items per page.
     * @returns {Promise<object>} Paginated result object.
     * @private
     */
    _getAudioFilesWithMetadata: async (page = 1, limit = 50) => {
        const audioCustomDir = path.join(__dirname, '../../public/audio/custom');
        const audioCacheDir = path.join(__dirname, '../../public/audio/cache');
        const metaCustomDir = path.join(__dirname, '../public/audio/custom');
        const metaCacheDir = path.join(__dirname, '../public/audio/cache');
        
        // Ensure necessary directories exist
        await Promise.all([
            fs.mkdir(audioCustomDir, { recursive: true }),
            fs.mkdir(audioCacheDir, { recursive: true }),
            fs.mkdir(metaCustomDir, { recursive: true }),
            fs.mkdir(metaCacheDir, { recursive: true })
        ]);

        /**
         * Internal helper to scan directories and attach metadata.
         * 
         * @param {string} audioDir - Directory to scan.
         * @param {string} type - File type category.
         * @returns {Promise<Object[]>} A promise that resolves to file entries.
         * @private
         */
        const getFileEntries = async (audioDir, type) => {
            /**
             * Internal local helper to retrieve file list.
             * 
             * @returns {Promise<Object[]>} A promise that resolves to file entries.
             */
            const fetchEntries = async () => {
                const files = await fs.readdir(audioDir);
                return files.filter(f => f.endsWith('.mp3')).map(f => ({
                    f,
                    type,
                    metaDir: type === 'custom' ? metaCustomDir : metaCacheDir
                }));
            };

            /**
             * Internal wrapper to manage result retrieval and errors.
             * 
             * @returns {Promise<Object[]>} The fetched or empty file list.
             */
            const resultHandler = async () => {
                try {
                    return await fetchEntries();
                } catch (e) {
                    return [];
                }
            };

            return await resultHandler();
        };

        const [customEntries, cacheEntries] = await Promise.all([
            getFileEntries(audioCustomDir, 'custom'),
            getFileEntries(audioCacheDir, 'cache')
        ]);

        const allEntries = [...customEntries, ...cacheEntries];
        const total = allEntries.length;
        const startIndex = (page - 1) * limit;
        const paginatedEntries = allEntries.slice(startIndex, startIndex + limit);

        const results = await Promise.all(paginatedEntries.map(({ f, type, metaDir }) => fsLimiter.schedule(async () => {
            const metaPath = path.join(metaDir, f + '.json');
            
            let metadata = {};
            try {
                const metaContent = await fs.readFile(metaPath, 'utf8');
                metadata = JSON.parse(metaContent);
            } catch (e) { /* ignore missing or corrupt meta */ }

            return { 
                name: f, 
                type, 
                path: `${type}/${f}`,
                url: `/public/audio/${type}/${f}`,
                metadata: metadata
            };
        })));
        
        const files = results.filter(file => !file.metadata.hidden);

        return {
            files,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    },

    /**
     * Transforms a key-value mapping into a sorted array of choice objects.
     * 
     * @param {Object} obj - The mapping object to convert.
     * @returns {Array<{id: number, label: string}>} A sorted array of objects.
     * @private
     */
    _toSortedArray: (obj) => {
        if (!obj) return [];
        return Object.entries(obj)
            .map(([id, label]) => ({ id: parseInt(id), label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    },

    /**
     * Provides static system constants such as calculation methods and juristic settings.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    getConstants: (req, res) => {
        res.json({
            calculationMethods: systemController._toSortedArray(CALCULATION_METHODS),
            madhabs: systemController._toSortedArray(ASR_JURISTIC_METHODS),
            latitudeAdjustments: systemController._toSortedArray(LATITUDE_ADJUSTMENT_METHODS),
            midnightModes: systemController._toSortedArray(MIDNIGHT_MODES)
        });
    },

    /**
     * Performs a diagnostic check on the current automation service status.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when diagnostics complete.
     */
    getAutomationStatus: async (req, res) => {
        await configService.reload();
        const config = configService.get();
        const status = await diagnosticsService.getAutomationStatus(config);
        res.json(status);
    },

    /**
     * Performs a diagnostic check on the Text-to-Speech (TTS) engine's health.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when diagnostics complete.
     */
    getTTSStatus: async (req, res) => {
        await configService.reload();
        const config = configService.get();
        const status = await diagnosticsService.getTTSStatus(config);
        res.json(status);
    },

    /**
     * Forces the regeneration of Text-to-Speech assets by clearing and resyncing caches.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when regeneration is complete.
     */
    regenerateTTS: async (req, res) => {
        try {
            await configService.reload();
            await audioAssetService.syncAudioAssets(true);
            res.json({
                success: true, 
                message: 'Audio assets cleared and synchronised.'
            });
        } catch (error) {
            console.error('[SystemController] Regeneration failed:', error.message);
            res.status(400).json({
                success: false, 
                message: `Regeneration failed: ${error.message}` 
            });
        }
    },

    /**
     * Performs a hot reload of the prayer scheduler without terminating the process.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the scheduler restarts.
     */
    restartScheduler: async (req, res) => {
        await configService.reload();
        await schedulerService.hotReload();
        res.json({ success: true, message: 'Scheduler restarted.' });
    },

    /**
     * Validates that an external URL is reachable via HTTP HEAD or GET.
     * Includes DNS Rebinding protection by pinning DNS resolution to an Agent lookup.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when validation completes.
     */
    validateUrl: async (req, res) => {
        const { url: urlString } = req.body;
        if (!urlString) return res.status(400).json({ valid: false, error: 'URL is required' });

        try {
            const url = new URL(urlString);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                return res.json({ valid: false, error: 'Invalid protocol. Only http and https are allowed.' });
            }

            const httpAgent = getSafeAgent('http:');
            const httpsAgent = getSafeAgent('https:');

            const axiosConfig = { 
                timeout: 5000,
                maxContentLength: 5000000,
                httpAgent,
                httpsAgent
            };

            try {
                await axios.head(urlString, axiosConfig);
                res.json({ valid: true });
            } catch (e) {
                // Attempt a GET request if the server rejects HEAD requests
                try {
                    await axios.get(urlString, { ...axiosConfig, responseType: 'stream' });
                    res.json({ valid: true });
                } catch (e2) {
                     const msg = e2.response ? `Status ${e2.response.status}` : e2.message;
                     res.json({ valid: false, error: msg });
                }
            }
        } catch (e) {
            res.json({ valid: false, error: e.message });
        }
    },

    /**
     * Tests connectivity and data retrieval for a configured prayer time source.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the test completes.
     */
    testSource: async (req, res) => {
        const { target } = req.body;
        if (!target || !['primary', 'backup'].includes(target)) {
            return res.status(400).json({ success: false, error: 'Invalid target. Expected "primary" or "backup".' });
        }

        await configService.reload();
        const config = configService.get();
        const targetSource = config.sources[target];

        if (!targetSource) {
            return res.status(400).json({ success: false, error: `Source "${target}" is not configured.` });
        }

        if (target === 'backup' && targetSource.enabled === false) {
            return res.status(400).json({ success: false, error: 'Backup source is currently disabled.' });
        }

        const type = targetSource.type;
        const healthKey = target === 'primary' ? 'primarySource' : 'backupSource';

        try {
            const provider = ProviderFactory.create(targetSource, config);
            const year = DateTime.now().setZone(config.location.timezone).year;
            const result = await provider.getAnnualTimes(year);

            const daysCount = Object.keys(result).length;

            // Mark source as healthy in the cache after a successful manual test
            await healthCheck.refresh(healthKey);

            res.json({
                success: true,
                message: `Source responded with ${daysCount} days of data.`
            });
        } catch (error) {
            if (error.message.includes('Unknown provider type')) {
                return res.status(400).json({ success: false, error: error.message });
            }

            // Update health status to reflected failure even if data retrieval fails
            try {
                await healthCheck.refresh(healthKey);
            } catch (healthError) {
                console.error(`[SystemController] Failed to refresh health after test failure:`, healthError.message);
            }
            throw error;
        }
    },

    /**
     * Retrieves information regarding storage usage, quotas, and system-free space.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when storage status is retrieved.
     */
    async getStorageStatus(req, res) {
        const storageService = require('@services/system/storageService');
        const configService = require('@config');
        const config = configService.get();
        
        const usage = await storageService.getUsage();
        const systemFree = await storageService.getSystemStats();
        const recommendedLimit = storageService.calculateRecommendedLimit();
        const limitGB = config.data?.storageLimit || 1.0;
        
        res.json({
            usedBytes: usage.total,
            limitBytes: limitGB * 1024 * 1024 * 1024,
            systemFreeBytes: systemFree,
            recommendedLimitGB: recommendedLimit,
            breakdown: { custom: usage.custom, cache: usage.cache }
        });
    },

    /**
     * Retrieves the list of available TTS voices.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} Sends a JSON response containing the available voices.
     */
    async getVoices(req, res) {
        const voices = voiceService.getVoices();
        res.json(voices);
    },

    /**
     * Proxies a request to generate a TTS preview audio file after resolving placeholders.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} Sends a JSON response with the generated audio metadata.
     */
    async previewTTS(req, res) {
        const { template, prayerKey, offsetMinutes, voice } = req.body;
        
        if (!template || !prayerKey || !voice) {
            return res.status(400).json({ error: 'Template, prayerKey, and voice are required' });
        }

        try {
            const data = await audioAssetService.previewTTS(template, prayerKey, offsetMinutes, voice);
            res.json(data);
        } catch (error) {
            console.error('[SystemController] Preview generation failed:', error.message);
            res.status(500).json({ error: error.message || 'Failed to generate preview audio' });
        }
    },

    /**
     * Manually triggers the cleanup of temporary TTS preview files.
     *
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} Sends a JSON response indicating the cleanup status.
     */
    async cleanupTempTTS(req, res) {
        try {
            await audioAssetService.cleanupTempAudio(true);
            res.json({ success: true, message: 'Temporary TTS files cleaned up successfully.' });
        } catch (error) {
            console.error('[SystemController] Temp TTS cleanup failed:', error.message);
            res.status(500).json({ error: 'Failed to clean up temporary files' });
        }
    },

    /**
     * Manually triggers a scheduled maintenance job by its name.
     *
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<Response>} Sends a JSON response with the result of the job execution.
     */
    async runJob(req, res) {
        const { jobName } = req.body;
        if (!jobName) {
            return res.status(400).json({ success: false, message: 'jobName is required' });
        }

        try {
            const result = await schedulerService.runJob(jobName);
            if (!result.success) {
                return res.status(400).json(result);
            }
            
            // Log the manual action
            sseService.log(`Manual trigger: ${jobName}`, 'info');
            
            return res.json(result);
        } catch (error) {
            console.error('[SystemController] runJob failed:', error);
            return res.status(500).json({ success: false, message: error.message || 'Failed to trigger job' });
        }
    },

    /**
     * Returns the registry of available prayer data providers and their schemas.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    getProviders(req, res) {
        const { ProviderFactory } = require('@providers');
        const providers = ProviderFactory.getRegisteredProviders();
        res.json(providers);
    },

    // New Output Strategy Endpoints

    /**
     * Retrieves the registry of all available output strategies and their schemas.
     *
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    getOutputRegistry: (req, res) => {
        const registry = OutputFactory.getAllStrategies();
        res.json(registry);
    },

    /**
     * Verifies the credentials for a specific output strategy based on provided parameters.
     *
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the verification is complete.
     */
    verifyOutput: async (req, res) => {
        const { strategyId } = req.params;
        try {
            const params = req.body;
            const currentConfig = configService.get();
            configUnmasker.unmaskParams(strategyId, params, currentConfig);

            const strategy = OutputFactory.getStrategy(strategyId);
            const result = await strategy.verifyCredentials(params);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    },

    /**
     * Triggers a test execution for a specific output strategy using a predefined test audio file.
     *
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the test execution is complete.
     */
    testOutput: async (req, res) => {
        const { strategyId } = req.params;
        const { source } = req.body;
        try {
            const params = req.body;
            const currentConfig = configService.get();
            configUnmasker.unmaskParams(strategyId, params, currentConfig);

            const strategy = OutputFactory.getStrategy(strategyId);

            if (!source || !source.path) {
                return res.status(400).json({ error: 'Audio source path is required for testing' });
            }

            // Dynamic source from request (e.g., File Manager preview)
            const payload = { params, source };

            await strategy.execute(payload, { isTest: true });
            res.json({ success: true });
        } catch (error) {
            console.error('[SystemController] testOutput error:', error);
            res.status(400).json({ error: error.message });
        }
    }
};

module.exports = systemController;