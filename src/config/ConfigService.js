const fs = require('fs/promises');
const path = require('path');
const { z } = require('zod');
const dotenv = require('dotenv');
const { configSchema } = require('./schemas');

class ConfigNotInitializedError extends Error {
    /**
     * Initialises a new instance of the ConfigNotInitializedError class.
     */
    constructor() {
        super('ConfigService not initialised. Call init() first.');
        this.name = 'ConfigNotInitializedError';
    }
}

/**
 * Service responsible for managing application configuration, including loading,
 * merging local overrides, and applying environment variable overrides.
 */
class ConfigService {
    /**
     * Initialises the ConfigService instance with default paths and state.
     */
    constructor() {
        this._config = null;
        this._isInitialized = false;
        this._isSaving = false;
        this._configPath = path.join(__dirname, 'default.json');
        this._localPath = process.env.LOCAL_CONFIG_PATH || path.join(__dirname, 'local.json');
    }

    /**
     * Resets the singleton state. Used primarily for testing.
     */
    reset() {
        this._config = null;
        this._isInitialized = false;
        this._isSaving = false;
    }

    /**
     * Initialises the configuration service by loading it from disk.
     * 
     * @returns {Promise<void>} A promise that resolves when initialisation is complete.
     */
    async init() {
        if (this._isInitialized) return;
        await this.reload();
        this._isInitialized = true;
    }

    /**
     * Retrieves the current configuration object.
     * 
     * @throws {ConfigNotInitializedError} If the service has not been initialised.
     * @returns {Object} The current configuration object.
     */
    get() {
        if (!this._config) {
            throw new ConfigNotInitializedError();
        }
        return this._config;
    }

    /**
     * Reloads the configuration from disk, applying default, local, and environment overrides.
     * 
     * @returns {Promise<void>} A promise that resolves when the configuration is reloaded.
     */
    async reload() {
        // Reload environment variables from the specified .env file
        const ENV_FILE_PATH = process.env.ENV_FILE_PATH || path.join(__dirname, '../../.env');
        dotenv.config({ path: ENV_FILE_PATH, override: true });

        // Load default configuration from the JSON file
        const defaultContent = await fs.readFile(this._configPath, 'utf-8');
        let rawConfig = JSON.parse(defaultContent);

        // Load local configuration overrides if the file exists
        try {
            await fs.access(this._localPath);
            const localContent = await fs.readFile(this._localPath, 'utf-8');
            
            // Only parse if file is not empty
            if (localContent && localContent.trim().length > 0) {
                const localConfig = JSON.parse(localContent);
                rawConfig = this._mergeDeep(rawConfig, localConfig);
            }
        } catch (e) {
            // It is acceptable if local.json does not exist; we continue with defaults
            // We also ignore SyntaxError (empty/corrupt file) and just log a warning
            if (e.code !== 'ENOENT') {
                console.warn('Warning: Failed to load local config (using defaults):', e.message);
            }
        }

        // Merge environment variables to override file-based settings
        this._applyEnvOverrides(rawConfig);

        // Validate the final configuration against the Zod schema
        this._config = configSchema.parse(rawConfig);
    }

    /**
     * Reloads environment variables from the .env file.
     * 
     * @returns {Promise<void>} A promise that resolves when environment variables are reloaded.
     */
    async reloadEnv() {
        const ENV_FILE_PATH = process.env.ENV_FILE_PATH || path.join(__dirname, '../../.env');
        dotenv.config({ path: ENV_FILE_PATH, override: true });
    }

    /**
     * Updates the local configuration with partial changes and persists them to disk.
     * 
     * @param {Object} partialConfig - The partial configuration object to merge.
     * @throws {Error} If a save operation is already in progress.
     * @returns {Promise<void>} A promise that resolves when the update is complete.
     */
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
                // Only parse if file is not empty
                if (localContent && localContent.trim().length > 0) {
                    currentLocal = JSON.parse(localContent);
                }
            } catch (e) {
                // If file missing or corrupt (syntax error), treat as empty object and continue
                if (e.code !== 'ENOENT' && !(e instanceof SyntaxError)) {
                    throw e;
                }
            }

            const newLocalCandidate = this._mergeDeep(currentLocal, partialConfig);
            
            // Protect secrets from being written to local.json as per requirement FR-08
            this._stripSecrets(newLocalCandidate);

            // Construct full candidate to validate against the schema
            const defaultContent = await fs.readFile(this._configPath, 'utf-8');
            const defaultConfig = JSON.parse(defaultContent);
            
            // Re-apply environment overrides temporarily for validation
            // These are not saved to the local configuration file.
            const fullCandidate = this._mergeDeep(defaultConfig, newLocalCandidate);
            this._applyEnvOverrides(fullCandidate);

            // Validate against the configuration schema (FR-05)
            configSchema.parse(fullCandidate);
            // Logic validation is handled by the API layer to avoid circular dependencies.

            // Persist the updated local configuration to disk
            await fs.writeFile(this._localPath, JSON.stringify(newLocalCandidate, null, 2));

            // Reload the configuration to update the in-memory state
            await this.reload();

        } finally {
            this._isSaving = false;
        }
    }

    /**
     * Deeply merges a source object into a target object.
     * 
     * @param {Object} target - The target object to merge into.
     * @param {Object} source - The source object containing overrides.
     * @returns {Object} The resulting merged object.
     * @private
     */
    _mergeDeep(target, source) {
        if (typeof target !== 'object' || target === null) return source;
        if (typeof source !== 'object' || source === null) return target;
        
        // Create a shallow clone to maintain potential immutability
        const output = Array.isArray(target) ? [...target] : { ...target };

        for (const key in source) {
            if (Array.isArray(source[key])) {
                // Arrays are completely overwritten in this configuration system
                 output[key] = source[key];
            } else if (typeof source[key] === 'object' && source[key] !== null && 
                       typeof output[key] === 'object' && output[key] !== null) {
                // Recursively merge nested objects
                output[key] = this._mergeDeep(output[key], source[key]);
            } else {
                // Direct assignment for primitive values
                output[key] = source[key];
            }
        }
        return output;
    }

    /**
     * Applies environment variable overrides to the configuration object.
     * 
     * @param {Object} config - The configuration object to modify.
     * @private
     */
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

    /**
     * Removes sensitive environment-managed keys before saving to disk.
     * 
     * @param {Object} config - The configuration object to strip.
     * @private
     */
    _stripSecrets(config) {
        // Enforces "Environment as Source of Truth" by preventing secrets from persisting to disk
        
        if (config.automation) {
            if (process.env.BASE_URL) delete config.automation.baseUrl;
            if (process.env.PYTHON_SERVICE_URL) delete config.automation.pythonServiceUrl;
            
            if (config.automation.voiceMonkey) {
                 delete config.automation.voiceMonkey.token;
                 delete config.automation.voiceMonkey.device;
            }
        }
    }
}

module.exports = { ConfigService, ConfigNotInitializedError };
