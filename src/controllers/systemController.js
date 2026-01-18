const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { DateTime } = require('luxon');
const healthCheck = require('../services/healthCheck');
const schedulerService = require('../services/schedulerService');
const sseService = require('../services/sseService');
const automationService = require('../services/automationService');
const audioAssetService = require('../services/audioAssetService');
const diagnosticsService = require('../services/diagnosticsService');
const configService = require('../config');
const fetchers = require('../services/fetchers');
const { 
    CALCULATION_METHODS, 
    ASR_JURISTIC_METHODS, 
    LATITUDE_ADJUSTMENT_METHODS, 
    MIDNIGHT_MODES 
} = require('../utils/constants');

/**
 * Controller for System related operations.
 */
const systemController = {
    /**
     * Get system health status. 
     * Returns 503 if critical services are unhealthy.
     */
    getHealth: (req, res) => {
        const health = healthCheck.getHealth();
        
        // Determine critical health
        // Local audio and TTS are always critical. 
        // Prayer source is critical if both primary and backup are down.
        const isLocalHealthy = health.local?.healthy;
        const isTTSHealthy = health.tts?.healthy;
        const isPrimaryHealthy = health.primarySource?.healthy;
        const isBackupHealthy = health.backupSource?.healthy;
        
        // Backup might be disabled or not configured
        const isBackupNeeded = configService.get().sources.backup?.enabled !== false;
        const isSourceHealthy = isPrimaryHealthy || (isBackupNeeded && isBackupHealthy);

        if (!isLocalHealthy || !isTTSHealthy || !isSourceHealthy) {
            return res.status(503).json(health);
        }

        res.json(health);
    },

    /**
     * Trigger a refresh of the system health status.
     */
    refreshHealth: async (req, res) => {
        const { target, mode } = req.body;
        // target defaults to 'all' if not checking a specific one, mode defaults to 'silent'
        const result = await healthCheck.refresh(target || 'all', mode || 'silent');
        res.json(result);
    },

    /**
     * Get the current scheduled jobs.
     */
    getJobs: (req, res) => {
        if (schedulerService.getJobs) {
            res.json(schedulerService.getJobs());
        } else {
            res.json({ maintenance: [], automation: [] });
        }
    },

    /**
     * Handle Server-Sent Events (SSE) logs connection.
     */
    getLogs: (req, res) => {
        sseService.addClient(res);
    },

    /**
     * List custom and cached audio files.
     */
    getAudioFiles: (req, res) => {
        const customDir = path.join(__dirname, '../../public/audio/custom');
        const cacheDir = path.join(__dirname, '../../public/audio/cache');
        
        if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

        const getFiles = (dir, type) => {
            return fs.readdirSync(dir)
                .filter(f => f.endsWith('.mp3'))
                .map(f => ({ name: f, type, path: `${type}/${f}` }));
        };
        
        const custom = getFiles(customDir, 'custom').map(f => ({ ...f, url: `/public/audio/custom/${f.name}` }));
        const cache = getFiles(cacheDir, 'cache').map(f => ({ ...f, url: `/public/audio/cache/${f.name}` }));
        
        res.json([...custom, ...cache]);
    },

    /**
     * Helper to convert map to array of objects object { id, label } and sort by label
     */
    _toSortedArray: (obj) => {
        if (!obj) return [];
        return Object.entries(obj)
            .map(([id, label]) => ({ id: parseInt(id), label }))
            .sort((a, b) => a.label.localeCompare(b.label));
    },

    /**
     * Get system constants (Aladhan methods, etc).
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
     * Get automation status diagnostics.
     */
    getAutomationStatus: async (req, res) => {
        await configService.reload();
        const config = configService.get();
        const status = await diagnosticsService.getAutomationStatus(config);
        res.json(status);
    },

    /**
     * Get TTS status diagnostics.
     */
    getTTSStatus: async (req, res) => {
        await configService.reload();
        const config = configService.get();
        const status = await diagnosticsService.getTTSStatus(config);
        res.json(status);
    },

    /**
     * Trigger manual regeneration of TTS assets.
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
     * Hot reload the scheduler.
     */
    restartScheduler: async (req, res) => {
        await configService.reload();
        await schedulerService.hotReload();
        res.json({ success: true, message: 'Scheduler restarted.' });
    },

    /**
     * Test playing an audio file on the server.
     */
    testAudio: async (req, res) => {
        const { filename, type, target = 'local' } = req.body; 
        if (!filename || !type) return res.status(400).json({ error: 'Missing filename or type' });
        
        // Sanitise type
        if (!['custom', 'cache'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

        // Sanitise target
        if (!['local', 'browser', 'voiceMonkey'].includes(target)) return res.status(400).json({ error: 'Invalid target' });

        // Sanitise filename
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
             return res.status(400).json({ error: 'Invalid filename' });
        }

        const filePath = path.join(__dirname, `../../public/audio/${type}/${filename}`);
        const url = `/public/audio/${type}/${filename}`;
        
        // Final existence check
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
     * Validate an external URL.
     */
    validateUrl: async (req, res) => {
        const { url } = req.body;
        if (!url) return res.status(400).json({ valid: false, error: 'URL is required' });

        try {
            await axios.head(url, { timeout: 5000 });
            res.json({ valid: true });
        } catch (e) {
            // Retry with GET if HEAD fails (some servers block HEAD)
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
     * Test prayer source connectivity.
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

            // Update Health Cache after successful manual test
            await healthCheck.refresh(healthKey);

            res.json({
                success: true,
                message: `Source responded with ${daysCount} days of data.`
            });
        } catch (error) {
            // Even if fetch fails, we should refresh the health status for that source
            try {
                await healthCheck.refresh(healthKey);
            } catch (healthError) {
                console.error(`[SystemController] Failed to refresh health after test failure:`, healthError.message);
            }
            throw error; // Let global handler handle it
        }
    },

    /**
     * Test VoiceMonkey integration.
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
     * Get storage quota and usage information.
     */
    async getStorageStatus(req, res) {
        const storageService = require('../services/storageService');
        const configService = require('../config');
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
    }
};

module.exports = systemController;
