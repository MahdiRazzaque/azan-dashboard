const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { DateTime } = require('luxon');
const healthCheck = require('@services/system/healthCheck');
const schedulerService = require('@services/core/schedulerService');
const sseService = require('@services/system/sseService');
const automationService = require('@services/core/automationService');
const audioAssetService = require('@services/system/audioAssetService');
const diagnosticsService = require('@services/system/diagnosticsService');
const configService = require('@config');
const voiceService = require('@services/system/voiceService');
const fetchers = require('@adapters/prayerApiAdapter');
const { 
    CALCULATION_METHODS, 
    ASR_JURISTIC_METHODS, 
    LATITUDE_ADJUSTMENT_METHODS, 
    MIDNIGHT_MODES 
} = require('@utils/constants');

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
     * Initiates a fresh health check for specified system components.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the health check completes.
     */
    refreshHealth: async (req, res) => {
        const { target, mode } = req.body;
        // Default to checking all components in silent mode if not specified
        const result = await healthCheck.refresh(target || 'all', mode || 'silent');
        res.json(result);
    },

    /**
     * Retrieves a list of currently scheduled background jobs.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    getJobs: (req, res) => {
        if (schedulerService.getJobs) {
            res.json(schedulerService.getJobs());
        } else {
            res.json({ maintenance: [], automation: [] });
        }
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
     * Catalogues available custom and cached audio files from the server's storage.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    /**
     * Catalogues available custom and cached audio files from the server's storage,
     * including VoiceMonkey compatibility metadata.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    getAudioFiles: async (req, res) => {
        const files = await systemController._getAudioFilesWithMetadata();
        res.json(files);
    },

    /**
     * Internal helper to scan directories and attach metadata from sidecar files.
     */
    _getAudioFilesWithMetadata: async () => {
        const audioCustomDir = path.join(__dirname, '../../public/audio/custom');
        const audioCacheDir = path.join(__dirname, '../../public/audio/cache');
        const metaCustomDir = path.join(__dirname, '../public/audio/custom');
        const metaCacheDir = path.join(__dirname, '../public/audio/cache');
        
        // Ensure necessary directories exist
        if (!fs.existsSync(audioCustomDir)) fs.mkdirSync(audioCustomDir, { recursive: true });
        if (!fs.existsSync(audioCacheDir)) fs.mkdirSync(audioCacheDir, { recursive: true });
        if (!fs.existsSync(metaCustomDir)) fs.mkdirSync(metaCustomDir, { recursive: true });
        if (!fs.existsSync(metaCacheDir)) fs.mkdirSync(metaCacheDir, { recursive: true });

        const getFiles = (audioDir, metaDir, type) => {
            if (!fs.existsSync(audioDir)) return [];
            return fs.readdirSync(audioDir)
                .filter(f => f.endsWith('.mp3'))
                .map(f => {
                    const metaPath = path.join(metaDir, f + '.json');
                    
                    let metadata = {};
                    if (fs.existsSync(metaPath)) {
                        try {
                            metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                        } catch (e) { /* ignore corrupt meta */ }
                    }

                    return { 
                        name: f, 
                        type, 
                        path: `${type}/${f}`,
                        url: `/public/audio/${type}/${f}`,
                        vmCompatible: metadata.vmCompatible,
                        vmIssues: metadata.vmIssues,
                        metadata: metadata
                    };
                });
        };
        
        const custom = getFiles(audioCustomDir, metaCustomDir, 'custom');
        const cache = getFiles(audioCacheDir, metaCacheDir, 'cache');
        
        return [...custom, ...cache];
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
     * Executes a playback test for a specific audio file on a target output device.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the playback is triggered.
     */
    testAudio: async (req, res) => {
        const { filename, type, target = 'local' } = req.body; 
        if (!filename || !type) return res.status(400).json({ error: 'Missing filename or type' });
        
        // Input sanitisation for path category and output target
        if (!['custom', 'cache'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
        if (!['local', 'browser', 'voiceMonkey'].includes(target)) return res.status(400).json({ error: 'Invalid target' });

        // Mitigate directory traversal by allowing only simple filenames
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
             return res.status(400).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(__dirname, `../../public/audio/${type}/${filename}`);
        const metaPath = path.join(__dirname, `../public/audio/${type}/${filename}.json`);
        const url = `/public/audio/${type}/${filename}`;
        
        // Confirm the existence of the file before attempt playback
        if (!fs.existsSync(filePath)) {
            console.error(`[TestAudio] File not found at ${filePath}`);
            return res.status(404).json({ error: 'File not found on disk' });
        }

        const prayer = 'test';
        const event = filename;
        const source = { filePath, url };

        console.log(`[TestAudio] Target: ${target}, File: ${filename}`);

        if (target === 'local') {
            console.log(`[TestAudio] Executing handleLocal`);
            automationService.handleLocal({}, prayer, event, source);
        } else if (target === 'browser') {
            console.log(`[TestAudio] Executing broadcastToClients`);
            automationService.broadcastToClients({}, prayer, event, source);
        } else if (target === 'voiceMonkey') {
            console.log(`[TestAudio] Executing handleVoiceMonkey`);
            await automationService.handleVoiceMonkey({}, prayer, event, source);
        }

        res.json({ success: true, message: `Testing audio on ${target}...` });
    },

    /**
     * Validates that an external URL is reachable via HTTP HEAD or GET.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when validation completes.
     */
    validateUrl: async (req, res) => {
        const { url } = req.body;
        if (!url) return res.status(400).json({ valid: false, error: 'URL is required' });

        try {
            await axios.head(url, { timeout: 5000 });
            res.json({ valid: true });
        } catch (e) {
            // Attempt a GET request if the server rejects HEAD requests
            try {
                await axios.get(url, { timeout: 5000, responseType: 'stream' });
                res.json({ valid: true });
            } catch (e2) {
                 const msg = e2.response ? `Status ${e2.response.status}` : e2.message;
                 res.json({ valid: false, error: msg });
            }
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
            let result;
            if (type === 'aladhan') {
                const year = DateTime.now().setZone(config.location.timezone).year;
                result = await fetchers.fetchAladhanAnnual(config, year);
            } else if (type === 'mymasjid') {
                result = await fetchers.fetchMyMasjidBulk(config);
            } else {
                return res.status(400).json({ success: false, error: `Unsupported source type: ${type}` });
            }

            const daysCount = Object.keys(result).length;

            // Mark source as healthy in the cache after a successful manual test
            await healthCheck.refresh(healthKey);

            res.json({
                success: true,
                message: `Source responded with ${daysCount} days of data.`
            });
        } catch (error) {
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
     * Initiates a test announcement via VoiceMonkey to verify API connectivity.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the test announcement succeeds.
     */
    testVoiceMonkey: async (req, res) => {
        const { token, device } = req.body;
        if (!token || !device) return res.status(400).json({ error: 'Missing token or device' });

        const response = await axios.get('https://api-v2.voicemonkey.io/announcement', {
            params: { token, device, text: 'Test' },
            timeout: 5000
        });
        
        if (response.data && response.data.success === true) {
            res.json({ success: true });
        } else {
            throw new Error(response.data?.error || 'VoiceMonkey API returned failure');
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
     * Manually triggers cleanup of temporary TTS preview files.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    async cleanupTempTTS(req, res) {
        try {
            await audioAssetService.cleanupTempAudio(true);
            res.json({ success: true, message: 'Temporary TTS files cleaned up successfully.' });
        } catch (error) {
            console.error('[SystemController] Temp TTS cleanup failed:', error.message);
            res.status(500).json({ error: 'Failed to clean up temporary files' });
        }
    }
};

module.exports = systemController;
