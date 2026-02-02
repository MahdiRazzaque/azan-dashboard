const fs = require('fs');
const fsAsync = require('fs/promises');
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
                } catch (e) {}
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
                    } catch (e) {}
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
        } catch (e) {
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
     * 
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     * @returns {Promise<void>} Sends a JSON response with status of upload and analysis.
     */
    uploadFile: async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        
        try {
            const audioPath = path.join(__dirname, '../../public/audio/custom', req.file.filename);
            const metaDir = path.join(__dirname, '../public/audio/custom');
            const metaPath = path.join(metaDir, req.file.filename + '.json');
            
            try {
                await fsAsync.access(metaDir);
            } catch (e) {
                await fsAsync.mkdir(metaDir, { recursive: true });
            }

            // Generate metadata sidecar in src/public
            const basicMetadata = await audioValidator.analyseAudioFile(audioPath);
            const enrichedMetadata = await audioAssetService.enrichMetadata(audioPath, basicMetadata);
            
            await fsAsync.writeFile(metaPath, JSON.stringify(enrichedMetadata));
            
            res.json({
                message: 'File uploaded and analysed successfully',
                filename: req.file.filename,
                path: `custom/${req.file.filename}`,
                ...enrichedMetadata
            });
        } catch (error) {
            console.error('[SettingsController] Upload analysis failed:', error.message);
            res.json({
                message: 'File uploaded, but analysis failed',
                filename: req.file.filename,
                path: `custom/${req.file.filename}`
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
        
        const audioPath = path.join(__dirname, '../../public/audio/custom', filename);
        const metaPath = path.join(__dirname, '../public/audio/custom', filename + '.json');
        
        // Prevent directory traversal attacks
        if (filename.includes('..') || /[\/]/.test(filename)) {
            return res.status(400).json({ error: 'Invalid filename' });
        }

        // Check if file is protected
        try {
            await fsAsync.access(metaPath);
            const metaContent = await fsAsync.readFile(metaPath, 'utf8');
            const metadata = JSON.parse(metaContent);
            if (metadata.protected) {
                return res.status(403).json({ error: 'Forbidden: File is protected and cannot be deleted' });
            }
        } catch (e) { /* ignore if meta missing or corrupt */ }

        let deleted = false;
        try {
            let audioExists = false;
            try { await fsAsync.access(audioPath); audioExists = true; } catch (e) {}
            if (audioExists) {
                await fsAsync.unlink(audioPath);
                deleted = true;
            }

            let metaExists = false;
            try { await fsAsync.access(metaPath); metaExists = true; } catch (e) {}
            if (metaExists) {
                await fsAsync.unlink(metaPath);
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
