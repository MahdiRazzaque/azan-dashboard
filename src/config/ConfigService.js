const fs = require('fs/promises');
const path = require('path');
const { z } = require('zod');
const dotenv = require('dotenv');
const { configSchema } = require('./schemas');

class ConfigNotInitializedError extends Error {
    constructor() {
        super('ConfigService not initialized. Call init() first.');
        this.name = 'ConfigNotInitializedError';
    }
}

class ConfigService {
    constructor() {
        this._config = null;
        this._isInitialized = false;
        this._isSaving = false;
        this._configPath = path.join(__dirname, 'default.json');
        this._localPath = path.join(__dirname, 'local.json');
    }

    /**
     * Resets the singleton state. Used primarily for testing.
     */
    reset() {
        this._config = null;
        this._isInitialized = false;
        this._isSaving = false;
    }

    async init() {
        if (this._isInitialized) return;
        await this.reload();
        this._isInitialized = true;
    }

    get() {
        if (!this._config) {
            throw new ConfigNotInitializedError();
        }
        return this._config;
    }

    async reload() {
        // Reload environment variables
        dotenv.config({ override: true });

        // Load Default Config
        const defaultContent = await fs.readFile(this._configPath, 'utf-8');
        let rawConfig = JSON.parse(defaultContent);

        // Load Local Config (if exists)
        try {
            await fs.access(this._localPath);
            const localContent = await fs.readFile(this._localPath, 'utf-8');
            const localConfig = JSON.parse(localContent);
            rawConfig = this._mergeDeep(rawConfig, localConfig);
        } catch (e) {
            // It's okay if local.json doesn't exist
            if (e.code !== 'ENOENT') {
                console.error('Failed to load local config:', e);
            }
        }

        // Merge Environment Variables
        this._applyEnvOverrides(rawConfig);

        // Validate
        this._config = configSchema.parse(rawConfig);
    }

    async update(partialConfig) {
        if (this._isSaving) {
            throw new Error('Configuration save in progress');
        }

        this._isSaving = true;

        try {            
            // To properly support "partial updates" that persist to local.json, we need to:
            // 1. Read existing local.json (or empty object if none)
            // 2. Merge partialConfig into that localConfig
            // 3. Construct full config (Default + (OldLocal + NewPartial))
            // 4. Validate full config
            // 5. If valid, write (OldLocal + NewPartial) to local.json
            
            let currentLocal = {};
            try {
                const localContent = await fs.readFile(this._localPath, 'utf-8');
                currentLocal = JSON.parse(localContent);
            } catch (e) {
                if (e.code !== 'ENOENT') throw e;
            }

            const newLocalCandidate = this._mergeDeep(currentLocal, partialConfig);
            
            // We need to protect secrets from being written to local.json
            // FR-08: Write Protection
            this._stripSecrets(newLocalCandidate);

            // Construct full candidate to validate schema
            const defaultContent = await fs.readFile(this._configPath, 'utf-8');
            const defaultConfig = JSON.parse(defaultContent);
            
            // Re-apply envs temporarily for validation (because full config needs them)
            // But we don't save them.
            const fullCandidate = this._mergeDeep(defaultConfig, newLocalCandidate);
            this._applyEnvOverrides(fullCandidate);

            // Validation FR-05
            configSchema.parse(fullCandidate);
            // Logic validation (external checks) is currently handled by the caller (API layer)
            // to avoid circular dependencies with fetchers.

            // Write to disk
            await fs.writeFile(this._localPath, JSON.stringify(newLocalCandidate, null, 2));

            // Reload to update memory
            await this.reload();

        } finally {
            this._isSaving = false;
        }
    }

    _mergeDeep(target, source) {
        if (typeof target !== 'object' || target === null) return source;
        if (typeof source !== 'object' || source === null) return target;
        
        // Clone target to allow immutability if needed, but here we usually merge into a fresh object or existing.
        // For simple recursive merge:
        const output = Array.isArray(target) ? [...target] : { ...target };

        for (const key in source) {
            if (Array.isArray(source[key])) {
                // If both are arrays, usually we overwrite in this config system (as seen in existing code)
                // Existing code: target[key] = source[key] (overwrite array)
                 output[key] = source[key];
            } else if (typeof source[key] === 'object' && source[key] !== null && 
                       typeof output[key] === 'object' && output[key] !== null) {
                output[key] = this._mergeDeep(output[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }
        return output;
    }

    _applyEnvOverrides(config) {
        if (!config.automation) return;
        
        if (process.env.BASE_URL) config.automation.baseUrl = process.env.BASE_URL;
        if (process.env.PYTHON_SERVICE_URL) config.automation.pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
        
        if (process.env.VOICEMONKEY_TOKEN) {
            config.automation.voiceMonkey.token = process.env.VOICEMONKEY_TOKEN;
        }
        if (process.env.VOICEMONKEY_DEVICE) {
            config.automation.voiceMonkey.device = process.env.VOICEMONKEY_DEVICE;
        }
    }

    _stripSecrets(config) {
        // Helper to remove env-managed keys from the object to be saved
        // We shouldn't remove the keys entirely if they are required by schema, 
        // but we definitely shouldn't save the *values* from env.
        
        if (config.automation) {
            // These are managed by ENV, so do not save them to local.json
            // If the user tries to change them via UI, it won't persist if we strip them.
            // This enforces "Env as Source of Truth" for these specific keys.
            if (process.env.BASE_URL) delete config.automation.baseUrl;
            if (process.env.PYTHON_SERVICE_URL) delete config.automation.pythonServiceUrl;
            
            if (config.automation.voiceMonkey) {
                 // Always remove token and device from the object to be saved
                 // This ensures they are never written to local.json
                 delete config.automation.voiceMonkey.token;
                 delete config.automation.voiceMonkey.device;
            }
        }
    }
}

module.exports = { ConfigService, ConfigNotInitializedError };
