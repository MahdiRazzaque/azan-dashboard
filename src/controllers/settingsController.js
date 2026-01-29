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
const OutputFactory = require('../outputs');

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
     * Retrieves a sanitised subset of application settings for public (non-admin) access.
     * Excludes sensitive data like integration credentials.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} A promise that resolves when the settings are sent.
     */
    getPublicSettings: async (req, res) => {
        await configService.reload();
        const fullConfig = configService.get();
        
        // Deep clone automation block to ensure no secrets are leaked via reference
        const automation = JSON.parse(JSON.stringify(fullConfig.automation || {}));
        
        // Polymorphically sanitise all output strategies
        if (automation.outputs) {
            const secrets = OutputFactory.getSecretRequirementKeys();
            secrets.forEach(({ strategyId, key }) => {
                if (automation.outputs[strategyId]?.params?.[key]) {
                    delete automation.outputs[strategyId].params[key];
                }
            });
        }

        // Decommissioned legacy keys (sanity check)
        delete automation.voiceMonkey;

        res.json({
            location: fullConfig.location,
            prayers: fullConfig.prayers,
            sources: fullConfig.sources,
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
        try {
            const newConfig = req.body;
            if (typeof newConfig !== 'object' || newConfig === null) {
                return res.status(400).json({ error: 'Invalid configuration format' });
            }
            console.log('[SettingsController] Received update request:', JSON.stringify(newConfig.data));

            // Identify services in use to perform a targeted health check as soon as request is received
            const usedServices = new Set(['primarySource']);
            if (newConfig.sources?.backup?.enabled !== false) {
                usedServices.add('backupSource');
            }

            if (newConfig.automation?.triggers) {
                Object.values(newConfig.automation.triggers).forEach(prayerTriggers => {
                    Object.values(prayerTriggers).forEach(trigger => {
                        if (!trigger.enabled) return;
                        if (trigger.type === 'tts') usedServices.add('tts');
                        if (trigger.targets) {
                            trigger.targets.forEach(t => {
                                if (t !== 'browser') usedServices.add(t);
                            });
                        }
                    });
                });
            }

            // Perform targeted health checks before proceeding with disk/cache operations
            sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Checking Service Health...' } });
            await Promise.all(Array.from(usedServices).map(service => healthCheck.refresh(service)));

            // Validate the incoming configuration source for correct masjid identification
            sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Validating Configuration...' } });
            try {
                await validateConfigSource(newConfig);
            } catch (e) {
                if (e.name === 'ProviderValidationError' && e.userFriendly) {
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
            let syncResult;
            try {
                syncResult = await audioAssetService.syncAudioAssets();
            } catch (err) {
                console.error('[SettingsController] Audio asset synchronisation failed. Rolling back config.', err.message);
                
                // Revert configuration if audio synchronisation fails to maintain system consistency
                await configService.update(previousConfig);
                
                return res.status(400).json({
                    error: 'Sync Failed',
                    message: `Settings not saved: ${err.message}. Configuration has been rolled back.`
                });
            }

            // Re-initialise the scheduler with the new timing and configuration
            sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Restarting Scheduler...' } });
            await schedulerService.initScheduler(); 
    
            // Generate warnings if configured automation services are currently offline or disabled
            const warnings = [...(syncResult.warnings || [])];
            const health = healthCheck.getHealth(); // Use the health status updated at the start of the request
            const finalConfig = configService.get();
            const strategies = OutputFactory.getAllStrategies();
            
            // Internal method helper for metadata retrieval
            const getFilesWithMetadata = systemControllerHelper._getAudioFilesWithMetadata || (async () => []);
            const audioFiles = await getFilesWithMetadata();
            
            if (finalConfig.automation && finalConfig.automation.triggers) {
                Object.entries(finalConfig.automation.triggers).forEach(([prayer, triggers]) => {
                    Object.entries(triggers).forEach(([type, trigger]) => {
                        if (!trigger.enabled) return;
                        const prayerName = prayer.charAt(0).toUpperCase() + prayer.slice(1);
                        const typeName = type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                        const niceName = `${prayerName} ${typeName}`;

                        if (trigger.type === 'tts' && !health.tts?.healthy) {
                            warnings.push(`${niceName}: TTS Service is offline`);
                        }

                        // Dynamic strategy checks
                        (trigger.targets || []).forEach(targetId => {
                            const strategy = strategies.find(s => s.id === targetId);
                            if (!strategy || targetId === 'browser') return;
                            
                            const outputConfig = finalConfig.automation?.outputs?.[targetId];
                            const strategyHealth = health[targetId];

                            if (!outputConfig || !outputConfig.enabled) {
                                warnings.push(`${niceName}: ${strategy.label} output is disabled in settings`);
                            } else if (strategyHealth && !strategyHealth.healthy) {
                                warnings.push(`${niceName}: ${strategy.label} output is offline (${strategyHealth.message || 'unreachable'})`);
                            }
        
                            // Polymorphic validation for strategy-specific warnings
                            try {
                                const instance = OutputFactory.getStrategy(targetId);
                                const strategyWarnings = instance.validateTrigger(trigger, {
                                    audioFiles,
                                    prayer,
                                    triggerType: type,
                                    niceName
                                });
                                warnings.push(...strategyWarnings);
                            } catch (e) {
                                // Silently ignore if strategy instance can't be retrieved or validation fails
                            }
                        });
                    });
                });
            }
    
            // Check if any ENABLED output itself is failing health check, even if not yet used in a trigger
            strategies.forEach(strategy => {
                if (strategy.hidden || strategy.id === 'browser') return;
                const outputConfig = finalConfig.automation?.outputs?.[strategy.id];
                if (outputConfig?.enabled) {
                    const status = health[strategy.id];
                    // Note: If the strategy wasn't in usedServices, health status here will be what was already in cache
                    if (status && !status.healthy) {
                        const msg = `${strategy.label} Integration: ${status.message || 'Offline'}`;
                        if (!warnings.some(w => w.includes(msg))) {
                            warnings.push(msg);
                        }
                    }
                }
            });

            sseService.broadcast({ type: 'PROCESS_UPDATE', payload: { label: 'Configuration Saved' } });
            
            res.json({ 
                message: 'Settings validated, updated, and cache refreshed.',
                meta: result.meta,
                warnings: warnings
            });
        } catch (error) {
            console.error('[SettingsController] updateSettings FATAL ERROR:', error);
            res.status(500).json({ error: 'Internal Server Error', message: error.message });
        }
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
        
        let syncWarnings = [];
        try {
            const syncRes = await audioAssetService.syncAudioAssets();
            syncWarnings = syncRes.warnings || [];
        } catch (e) { 
            console.error('[SettingsController] Reset sync failed:', e.message);
            return res.status(400).json({ 
                error: 'Sync Failed', 
                message: `Settings reset, but audio synchronisation failed: ${e.message}` 
            });
        }

        await schedulerService.initScheduler(); 

        res.json({ message: 'Settings reset to defaults.', meta: result.meta, warnings: syncWarnings });
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
            const syncRes = await audioAssetService.syncAudioAssets();
            if (syncRes.warnings) warnings.push(...syncRes.warnings);
        } catch (e) {
            console.error('[SettingsController] Audio asset synchronisation failed:', e.message);
            return res.status(400).json({ 
                error: 'Sync Failed', 
                message: `Cache refreshed, but audio synchronisation failed: ${e.message}` 
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
     * @returns {Promise<void>} Sends a JSON response with status of upload and analysis.
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
            
            // Polymorphically augment metadata from all strategies
            const augmentedData = {};
            OutputFactory.getAllStrategyInstances().forEach(instance => {
                const augmentation = instance.augmentAudioMetadata(metadata);
                Object.assign(augmentedData, augmentation);
            });
            
            const finalMetadata = {
                ...metadata,
                ...augmentedData,
                updatedAt: new Date().toISOString()
            };

            fs.writeFileSync(metaPath, JSON.stringify(finalMetadata));
            
            res.json({ 
                message: 'File uploaded and analysed successfully', 
                filename: req.file.originalname, 
                path: `custom/${req.file.originalname}`,
                ...augmentedData
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
     * @returns {void} Sends a JSON response confirming the deletion status.
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
        try {
            if (fs.existsSync(audioPath)) {
                fs.unlinkSync(audioPath);
                deleted = true;
            }

            if (fs.existsSync(metaPath)) {
                fs.unlinkSync(metaPath);
                deleted = true;
            }
        } catch (e) {
            console.error('[SettingsController] Failed to delete file:', e.message);
            return res.status(500).json({ error: 'Internal Server Error: Failed to delete file' });
        }

        if (deleted) {
            res.json({ success: true, message: 'File and metadata deleted' });
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    }
};

module.exports = settingsController;
