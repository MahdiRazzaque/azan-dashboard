const fs = require('fs');
const path = require('path');
const configService = require('../config');
const envManager = require('../utils/envManager');
const sseService = require('../services/sseService');
const { forceRefresh } = require('../services/prayerTimeService');
const schedulerService = require('../services/schedulerService');
const audioAssetService = require('../services/audioAssetService');
const healthCheck = require('../services/healthCheck');
const { validateConfigSource } = require('../services/validationService');

/**
 * Controller for Settings related operations.
 */
const settingsController = {
    /**
     * Get current application settings.
     */
    getSettings: async (req, res) => {
        await configService.reload();
        res.json(configService.get());
    },

    /**
     * Update application settings with validation and service restart.
     */
    updateSettings: async (req, res) => {
        const newConfig = req.body;
        if (typeof newConfig !== 'object' || newConfig === null) {
            return res.status(400).json({ error: 'Invalid configuration format' });
        }

        // 1. Validation
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Validating Configuration...' } });
        try {
            await validateConfigSource(newConfig);
        } catch (e) {
            if (e.message.startsWith('Invalid Masjid ID') || e.message === 'Masjid ID not found.') {
                return res.status(400).json({ error: e.message });
            }
            return res.status(400).json({ error: `Validation Failed: ${e.message}` });
        }

        // 2. Save
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Saving to Disk...' } });
        await configService.update(newConfig);
        
        // 3. Refresh Cache
        console.log('[SettingsController] Settings updated, forcing cache refresh...');
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Refreshing Prayer Data...' } });
        const result = await forceRefresh(configService.get());
        
        // 4. Sync Audio Assets
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Generating Audio Assets...' } });
        try {
            await audioAssetService.syncAudioAssets();
        } catch (err) {
            console.error('[SettingsController] Audio asset synchronization failed:', err.message);
        }

        // 5. Restart Scheduler
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Restarting Scheduler...' } });
        await schedulerService.initScheduler(); 

        // 6. Calculate Warnings
        const warnings = [];
        const health = healthCheck.getHealth();
        
        if (newConfig.automation && newConfig.automation.triggers) {
            Object.entries(newConfig.automation.triggers).forEach(([prayer, triggers]) => {
                Object.entries(triggers).forEach(([type, trigger]) => {
                    if (!trigger.enabled) return;
                     const niceName = `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} ${type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`;

                    if (trigger.type === 'tts' && !health.tts?.healthy) {
                        warnings.push(`${niceName}: TTS Service is offline`);
                    }
                    if (trigger.targets && trigger.targets.includes('local') && !health.local?.healthy) {
                        warnings.push(`${niceName}: Local Audio Service is offline`);
                    }
                    if ((trigger.targets?.includes('voiceMonkey') || trigger.type === 'voiceMonkey') && !health.voiceMonkey?.healthy) {
                         warnings.push(`${niceName}: ${health.voiceMonkey?.message || 'VoiceMonkey Service is offline'}`);
                    }
                });
            });
        }
        
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Configuration Saved' } });
        
        res.json({ 
            message: 'Settings validated, updated, and cache refreshed.',
            meta: result.meta,
            warnings: warnings
        });
    },

    /**
     * Reset settings to defaults by deleting local.json.
     */
    resetSettings: async (req, res) => {
        const localPath = path.join(__dirname, '../config/local.json');
        if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
            console.log('[SettingsController] local.json deleted. Reverting to default.');
        }

        await configService.reload();
        const result = await forceRefresh(configService.get());
        
        try {
            await audioAssetService.syncAudioAssets();
        } catch(e) { console.error(e); }

        await schedulerService.initScheduler(); 

        res.json({ message: 'Settings reset to defaults.', meta: result.meta });
    },

    /**
     * Force refresh the prayer times cache.
     */
    refreshCache: async (req, res) => {
        await configService.reload();
        const config = configService.get(); 

        // Safeguard check
        const primaryHealth = await healthCheck.checkSource('primary');
        let backupHealth = { healthy: false };
        if (config.sources.backup && config.sources.backup.enabled !== false) {
            backupHealth = await healthCheck.checkSource('backup');
        }

        if (!primaryHealth.healthy && !backupHealth.healthy) {
            return res.status(503).json({ 
                error: 'System is relying on cache. Cannot reload cache until at least one Prayer API is online.' 
            });
        }

        const result = await forceRefresh(config);
        
        try {
            if (schedulerService.stopAll) {
                await schedulerService.stopAll();
            }
        } catch (stopErr) {
            console.error('[SettingsController] Failed to stop scheduler:', stopErr);
        }

        try {
           await audioAssetService.syncAudioAssets();
        } catch (e) {
             console.error('[SettingsController] Audio asset synchronization failed:', e);
        }
        await schedulerService.initScheduler(); 
        
        res.json({ 
            message: 'Cache refreshed and scheduler reloaded',
            meta: result.meta 
        });
    },

    /**
     * Handle file upload response (Multer does the work).
     */
    uploadFile: (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        res.json({ 
            message: 'File uploaded successfully', 
            filename: req.file.originalname, 
            path: `custom/${req.file.originalname}` 
        });
    },

    /**
     * Delete a custom audio file.
     */
    deleteFile: (req, res) => {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'Missing filename' });
        
        const filePath = path.join(__dirname, '../../public/audio/custom', filename);
        
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                res.json({ success: true, message: 'File deleted' });
            } catch (e) {
                res.status(500).json({ error: 'Delete failed' });
            }
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    },

    /**
     * Save VoiceMonkey credentials.
     */
    saveVoiceMonkey: async (req, res) => {
        const { token, device } = req.body;
        if (!token || !device) return res.status(400).json({ error: 'Missing token or device' });

        if (token.trim() === '' || device.trim() === '') {
             return res.status(400).json({ error: 'Token and Device cannot be empty' });
        }

        envManager.setEnvValue('VOICEMONKEY_TOKEN', token);
        envManager.setEnvValue('VOICEMONKEY_DEVICE', device);

        await configService.reload();
        res.json({ success: true, message: 'Credentials saved successfully' });
    },

    /**
     * Remove VoiceMonkey credentials.
     */
    deleteVoiceMonkey: async (req, res) => {
        envManager.deleteEnvValue('VOICEMONKEY_TOKEN');
        envManager.deleteEnvValue('VOICEMONKEY_DEVICE');

        await configService.reload();
        res.json({ success: true, message: 'Credentials removed successfully' });
    }
};

module.exports = settingsController;
