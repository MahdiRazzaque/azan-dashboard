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
 * Controller for settings-related operations, managing application configuration,
 * system resets, and external service credentials.
 */
const settingsController = {
    /**
     * Retrieves the current application settings.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the settings are sent.
     */
    getSettings: async (req, res) => {
        await configService.reload();
        res.json(configService.get());
    },

    /**
     * Updates application settings, validates them, and synchronises dependent services.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the update completes.
     */
    updateSettings: async (req, res) => {
        const newConfig = req.body;
        if (typeof newConfig !== 'object' || newConfig === null) {
            return res.status(400).json({ error: 'Invalid configuration format' });
        }
        console.log('[SettingsController] Received update request:', JSON.stringify(newConfig.data));

        // Validate the incoming configuration source for correct masjid identification
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Validating Configuration...' } });
        try {
            await validateConfigSource(newConfig);
        } catch (e) {
            if (e.message.startsWith('Invalid Masjid ID') || e.message === 'Masjid ID not found.') {
                return res.status(400).json({ error: e.message });
            }
            return res.status(400).json({ error: `Validation Failed: ${e.message}` });
        }

        // Persist the changes to disk; store previous state for rollback if needed
        const previousConfig = configService.get();
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Saving to Disk...' } });
        await configService.update(newConfig);
        
        // Force a refresh of the prayer time cache to reflect the updated settings
        console.log('[SettingsController] Settings updated, forcing cache refresh...');
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Refreshing Prayer Data...' } });
        const result = await forceRefresh(configService.get());
        
        // Synchronise audio assets, such as TTS and custom files, while checking storage limits
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Generating Audio Assets...' } });
        try {
            await audioAssetService.syncAudioAssets();
        } catch (err) {
            console.error('[SettingsController] Audio asset synchronization failed. Rolling back config.', err.message);
            
            // Revert configuration if audio synchronisation fails to maintain system consistency
            await configService.update(previousConfig);
            
            return res.status(400).json({
                error: 'Storage Quota Exceeded',
                message: `Settings not saved: ${err.message}. Configuration has been rolled back.`
            });
        }

        // Re-initialise the scheduler with the new timing and configuration
        sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Restarting Scheduler...' } });
        await schedulerService.initScheduler(); 

        // Generate warnings if configured automation services are currently offline
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
     * Resets settings to factory defaults by removing the local configuration file.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the reset completes.
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
        } catch(e) { 
            console.error('[SettingsController] Reset sync failed:', e.message);
            return res.status(400).json({ 
                error: 'Reset Failed', 
                message: `Settings reset, but audio synchronization failed: ${e.message}` 
            });
        }

        await schedulerService.initScheduler(); 

        res.json({ message: 'Settings reset to defaults.', meta: result.meta, warnings: [] });
    },

    /**
     * Forces a refresh of the calculated prayer times from online sources.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the cache is refreshed.
     */
    refreshCache: async (req, res) => {
        await configService.reload();
        const config = configService.get(); 

        // Ensure at least one external source is available before discarding the cache
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

        const warnings = [];
        try {
           await audioAssetService.syncAudioAssets();
        } catch (e) {
             console.error('[SettingsController] Audio asset synchronization failed:', e.message);
             return res.status(400).json({ 
                 error: 'Sync Failed', 
                 message: `Cache refreshed, but audio synchronization failed: ${e.message}` 
             });
        }
        await schedulerService.initScheduler(); 
        
        res.json({ 
            message: 'Cache refreshed and scheduler reloaded',
            meta: result.meta,
            warnings
        });
    },

    /**
     * Handles custom audio file uploads and returns the stored file information.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
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
     * Deletes a specific custom audio file from the server's storage.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    deleteFile: (req, res) => {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'Missing filename' });
        
        const filePath = path.join(__dirname, '../../public/audio/custom', filename);
        
        // Prevent directory traversal attacks by sanitising the filename
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
     * Persists VoiceMonkey API credentials to the environment configuration.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when credentials are saved.
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
     * Removes VoiceMonkey API credentials from the environment configuration.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when credentials are removed.
     */
    deleteVoiceMonkey: async (req, res) => {
        envManager.deleteEnvValue('VOICEMONKEY_TOKEN');
        envManager.deleteEnvValue('VOICEMONKEY_DEVICE');

        await configService.reload();
        res.json({ success: true, message: 'Credentials removed successfully' });
    }
};

module.exports = settingsController;
