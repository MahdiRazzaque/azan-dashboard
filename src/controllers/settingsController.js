const fs = require('fs');
const path = require('path');
const configService = require('@config');
const envManager = require('@utils/envManager');
const sseService = require('@services/system/sseService');
const { forceRefresh } = require('@services/core/prayerTimeService');
const schedulerService = require('@services/core/schedulerService');
const audioAssetService = require('@services/system/audioAssetService');
const healthCheck = require('@services/system/healthCheck');
const { validateConfigSource } = require('@services/core/validationService');
const audioValidator = require('@utils/audioValidator');
const systemControllerHelper = require('./systemController');

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
     * Retrieves a sanitized subset of application settings for public (non-admin) access.
     * Excludes sensitive data like VoiceMonkey credentials.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the settings are sent.
     */
    getPublicSettings: async (req, res) => {
        await configService.reload();
        const fullConfig = configService.get();
        
        // Sanitize automation block to ensure no secrets are leaked
        const automation = { ...fullConfig.automation };
        if (automation.voiceMonkey) {
            automation.voiceMonkey = {
                enabled: automation.voiceMonkey.enabled
                // Explicitly exclude token and device
            };
        }

        res.json({
            location: fullConfig.location,
            calculation: fullConfig.calculation,
            prayers: fullConfig.prayers,
            automation: automation
        });
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
            const audioFiles = await systemControllerHelper._getAudioFilesWithMetadata();
            
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
                    
                    // VoiceMonkey reachability check
                    if ((trigger.targets?.includes('voiceMonkey') || trigger.type === 'voiceMonkey') && !health.voiceMonkey?.healthy) {
                         warnings.push(`${niceName}: ${health.voiceMonkey?.message || 'VoiceMonkey Service is offline'}`);
                    }
                    
                    // VoiceMonkey audio compatibility check
                    if (trigger.targets?.includes('voiceMonkey')) {
                        const file = audioFiles.find(f => 
                            (trigger.type === 'file' && f.path === trigger.path) ||
                            (trigger.type === 'tts' && f.name === `tts_${prayer}_${type}.mp3`)
                        );
                        
                        if (file && file.vmCompatible === false) {
                            warnings.push(`${niceName}: Audio incompatible with Alexa (${file.vmIssues?.join(', ') || 'Unknown issues'})`);
                        }
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
    uploadFile: async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        try {
            const audioPath = path.join(__dirname, '../../public/audio/custom', req.file.originalname);
            const metaDir = path.join(__dirname, '../public/audio/custom');
            const metaPath = path.join(metaDir, req.file.originalname + '.json');
            
            if (!fs.existsSync(metaDir)) fs.mkdirSync(metaDir, { recursive: true });

            // Generate metadata sidecar in src/public
            const metadata = await audioValidator.analyseAudioFile(audioPath);
            const vmStatus = audioValidator.validateVoiceMonkeyCompatibility(metadata);
            
            fs.writeFileSync(metaPath, JSON.stringify({
                ...metadata,
                ...vmStatus,
                updatedAt: new Date().toISOString()
            }));
            
            res.json({ 
                message: 'File uploaded and analysed successfully', 
                filename: req.file.originalname, 
                path: `custom/${req.file.originalname}`,
                ...vmStatus
            });
        } catch (error) {
            console.error('[SettingsController] Upload analysis failed:', error.message);
            res.json({ 
                message: 'File uploaded, but analysis failed', 
                filename: req.file.originalname, 
                path: `custom/${req.file.originalname}`
            });
        }
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
        
        const audioPath = path.join(__dirname, '../../public/audio/custom', filename);
        const metaPath = path.join(__dirname, '../public/audio/custom', filename + '.json');
        
        // Prevent directory traversal attacks
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        let deleted = false;
        if (fs.existsSync(audioPath)) {
            try {
                fs.unlinkSync(audioPath);
                deleted = true;
            } catch (e) {
                console.error('[SettingsController] Failed to delete audio:', e.message);
            }
        }

        if (fs.existsSync(metaPath)) {
            try {
                fs.unlinkSync(metaPath);
                deleted = true;
            } catch (e) {
                console.error('[SettingsController] Failed to delete meta:', e.message);
            }
        }

        if (deleted) {
            res.json({ success: true, message: 'File and metadata deleted' });
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
