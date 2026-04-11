const fsAsync = require('fs/promises');
const path = require('path');
const configService = require('@config');
const { forceRefresh } = require('@services/core/prayerTimeService');
const schedulerService = require('@services/core/schedulerService');
const audioAssetService = require('@services/system/audioAssetService');
const healthCheck = require('@services/system/healthCheck');
const audioValidator = require('@utils/audioValidator');
const { sanitiseFilename } = require('@utils/pathSecurity');
const systemControllerHelper = require('./systemController');
const OutputFactory = require('../outputs');

const workflowService = require('@services/system/configurationWorkflowService');

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
        const config = JSON.parse(JSON.stringify(configService.get()));
        settingsController._maskSecrets(config);
        res.json(config);
    },

    /**
     * Internal helper to mask sensitive fields in a configuration object.
     * @param {Object} obj - The configuration object to mask.
     * @private
     */
    _maskSecrets: (obj) => {
        const encryption = require('../utils/encryption');
        const { ProviderFactory } = require('../providers');

        if (obj.automation?.outputs) {
            for (const [id, outputConfig] of Object.entries(obj.automation.outputs)) {
                try {
                    const strategy = OutputFactory.getStrategy(id);
                    const metadata = strategy.constructor.getMetadata();
                    const sensitiveKeys = metadata.params?.filter(p => p.sensitive).map(p => p.key) || [];
                    if (outputConfig.params) {
                        for (const sKey of sensitiveKeys) {
                            if (outputConfig.params[sKey]) {
                                outputConfig.params[sKey] = encryption.mask();
                            }
                        }
                    }
                } catch {
                    // Ignore errors
                }
            }
        }

        if (obj.sources) {
            for (const role of ['primary', 'backup']) {
                const source = obj.sources[role];
                if (source && source.type) {
                    try {
                        const providerClass = ProviderFactory.getProviderClass(source.type);
                        const metadata = providerClass.getMetadata();
                        const sensitiveKeys = metadata.parameters?.filter(p => p.sensitive).map(p => p.key) || [];
                        for (const sKey of sensitiveKeys) {
                            if (source[sKey]) {
                                source[sKey] = encryption.mask();
                            }
                        }
                    } catch {
                        // Ignore errors
                    }
                }
            }
        }
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
            automation: automation,
            system: { tours: fullConfig.system?.tours }
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
            const result = await workflowService.executeUpdate(req.body);
            res.json(result);
        } catch (error) {
            console.error('[SettingsController] updateSettings FATAL ERROR:', error);
            const status = error.message.includes('Validation Failed') ? 400 : 500;
            res.status(status).json({ error: 'Update Failed', message: error.message });
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
        try {
            await fsAsync.access(localPath);
            await fsAsync.unlink(localPath);
            console.log('[SettingsController] local.json deleted. Reverting to default.');
        } catch {
            // Ignore if file doesn't exist
        }

        await configService.reload();
        const result = await forceRefresh(configService.get());
        
        let syncWarnings = [];
        try {
            const syncRes = await audioAssetService.syncAudioAssets(true);
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
     * Validates file content (Magic Bytes) before moving to permanent storage.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} Sends a JSON response with status of upload and analysis.
     */
    uploadFile: async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        // Multer generates the filename via DiskStorage; validate against traversal and character allowlist
        const safeFilename = sanitiseFilename(req.file.filename);
        if (!safeFilename) {
            try { await fsAsync.unlink(req.file.path); } catch { /* ignore */ }
            return res.status(400).json({ error: 'Invalid filename' });
        }

        const tempPath = req.file.path;
        const targetDir = path.join(__dirname, '../../public/audio/custom');
        const targetPath = path.join(targetDir, safeFilename); // nosemgrep: path-join-resolve-traversal
        const metaDir = path.join(__dirname, '../public/audio/custom');
        const metaPath = path.join(metaDir, safeFilename + '.json'); // nosemgrep: path-join-resolve-traversal
        
        try {
            // Ensure target and meta directories exist
            await fsAsync.mkdir(targetDir, { recursive: true });
            await fsAsync.mkdir(metaDir, { recursive: true });

            // REQ-005: File Count Hard Limit
            const existingFiles = await fsAsync.readdir(targetDir).catch(() => []);
            if (existingFiles.length >= 500) {
                // Cleanup temp file
                try { await fsAsync.unlink(tempPath); } catch { /* ignore */ }
                return res.status(400).json({ 
                    error: 'Limit Reached', 
                    message: 'Maximum of 500 custom audio files allowed. Please delete some files before uploading more.' 
                });
            }

            // 1. Magic Bytes Check (via audioValidator)
            let basicMetadata;
            try {
                basicMetadata = await audioValidator.analyseAudioFile(tempPath);
                
                // Allow any audio format supported by the validator
                if (!basicMetadata.mimeType || !basicMetadata.mimeType.startsWith('audio/')) {
                    throw new Error('Invalid file format: Not a valid audio file');
                }
            } catch (validationError) {
                // Cleanup temp file on validation failure
                try { await fsAsync.unlink(tempPath); } catch { /* ignore */ }
                return res.status(400).json({ 
                    error: 'Invalid File', 
                    message: validationError.message 
                });
            }

            // 2. Move file from temp to custom (use copy+unlink to avoid EXDEV errors across filesystems/Docker volumes)
            await fsAsync.copyFile(tempPath, targetPath);
            await fsAsync.unlink(tempPath);

            // 3. Generate metadata sidecar
            const enrichedMetadata = await audioAssetService.enrichMetadata(targetPath, basicMetadata);
            await fsAsync.writeFile(metaPath, JSON.stringify(enrichedMetadata));
            
            // REQ-004: Invalidate file listing cache
            if (systemControllerHelper.invalidateFileCache) {
                systemControllerHelper.invalidateFileCache();
            }

            res.json({
                message: 'File uploaded and analysed successfully',
                filename: safeFilename,
                path: `custom/${safeFilename}`,
                ...enrichedMetadata
            });
        } catch (error) {
            console.error('[SettingsController] Upload processing failed:', error.message);
            // Cleanup on error
            try { await fsAsync.unlink(tempPath); } catch { /* ignore */ }
            res.status(500).json({
                error: 'Upload Failed',
                message: error.message
            });
        }
    },

    /**
     * Deletes a specific custom audio file from the server's storage.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} Sends a JSON response confirming the deletion status.
     */
    deleteFile: async (req, res) => {
        const { filename } = req.body;
        if (!filename) return res.status(400).json({ error: 'Missing filename' });
        
        const sanitised = sanitiseFilename(filename);
        if (!sanitised) return res.status(400).json({ error: 'Invalid filename' });

        const audioDir = path.resolve(__dirname, '../../public/audio/custom');
        const metaDir = path.resolve(__dirname, '../public/audio/custom');
        const audioPath = path.join(audioDir, sanitised); // nosemgrep: path-join-resolve-traversal, express-path-join-resolve-traversal
        const metaPath = path.join(metaDir, sanitised + '.json'); // nosemgrep: path-join-resolve-traversal, express-path-join-resolve-traversal

        // Check if file is protected
        try {
            await fsAsync.access(metaPath); // nosemgrep: express-fs-filename
            const metaContent = await fsAsync.readFile(metaPath, 'utf8'); // nosemgrep: express-fs-filename
            const metadata = JSON.parse(metaContent);
            if (metadata.protected) {
                return res.status(403).json({ error: 'Forbidden: File is protected and cannot be deleted' });
            }
        } catch { /* ignore if meta missing or corrupt */ }

        let deleted = false;
        try {
            let audioExists = false;
            try { await fsAsync.access(audioPath); audioExists = true; } catch { /* ignore */ } // nosemgrep: express-fs-filename
            if (audioExists) {
                await fsAsync.unlink(audioPath); // nosemgrep: express-fs-filename
                deleted = true;
            }

            let metaExists = false;
            try { await fsAsync.access(metaPath); metaExists = true; } catch { /* ignore */ } // nosemgrep: express-fs-filename
            if (metaExists) {
                await fsAsync.unlink(metaPath); // nosemgrep: express-fs-filename
                deleted = true;
            }
        } catch (e) {
            console.error('[SettingsController] Failed to delete file:', e.message);
            return res.status(500).json({ error: 'Internal Server Error: Failed to delete file' });
        }

        if (deleted) {
            // REQ-004: Invalidate file listing cache
            if (systemControllerHelper.invalidateFileCache) {
                systemControllerHelper.invalidateFileCache();
            }
            res.json({ success: true, message: 'File and metadata deleted' });
        } else {
            res.status(404).json({ error: 'File not found' });
        }
    },

    /**
     * Re-analyses an audio file and updates its metadata sidecar.
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} Sends a JSON response with the updated metadata.
     */
    revalidateFile: async (req, res) => {
        const { filename, type } = req.body;
        
        if (!filename || !type) {
            return res.status(400).json({ error: 'Filename and type are required' });
        }

        const sanitised = sanitiseFilename(filename);
        if (!sanitised) return res.status(400).json({ error: 'Invalid filename' });

        const audioDir = type === 'cache' 
            ? path.resolve(__dirname, '../../public/audio/cache')
            : path.resolve(__dirname, '../../public/audio/custom');
        
        const filePath = path.join(audioDir, sanitised); // nosemgrep: path-join-resolve-traversal, express-path-join-resolve-traversal

        try {
            await fsAsync.access(filePath); // nosemgrep: express-fs-filename
            
            // Call audioAssetService.analyzeFile for fresh validation
            // Note: analyzeFile is the internal method that performs the full scan
            const metadata = await audioAssetService.analyzeFile(filePath);
            
            // Invalidate file listing cache to ensure UI sees new metadata
            if (systemControllerHelper.invalidateFileCache) {
                systemControllerHelper.invalidateFileCache();
            }

            res.json(metadata);
        } catch (error) {
            console.error('[SettingsController] Revalidation failed:', error.message);
            res.status(error.code === 'ENOENT' ? 404 : 500).json({ 
                error: 'Revalidation Failed', 
                message: error.message 
            });
        }
    },

/**
 * Updates the onboarding tour state (dashboardSeen / adminSeen) in config.
 * @param {import('express').Request} req - Express request with body { dashboardSeen?, adminSeen? }.
 * @param {import('express').Response} res - Express response.
 * @returns {Promise<void>} Resolves when the tour state has been updated.
 */
    updateTourState: async (req, res) => {
        const { dashboardSeen, adminSeen } = req.body;
        if (dashboardSeen !== undefined && typeof dashboardSeen !== 'boolean') {
            return res.status(400).json({ error: 'Invalid tour state' });
        }
        if (adminSeen !== undefined && typeof adminSeen !== 'boolean') {
            return res.status(400).json({ error: 'Invalid tour state' });
        }
        await configService.update({ system: { tours: req.body } });
        res.json({ success: true });
    },

};

module.exports = settingsController;