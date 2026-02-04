const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');
const { configSchema } = require('./schemas');
const migrationService = require('../services/system/migrationService');
const encryption = require('../utils/encryption');

class ConfigNotInitializedError extends Error {
    /**
     * Initialises a new instance of the ConfigNotInitializedError class.
     */
    constructor() {
        super('ConfigService not initialised. Call init() first.');
        this.name = 'ConfigNotInitializedError';
    }
}

class CriticalConfigurationError extends Error {
    /**
     * Initialises a new instance of the CriticalConfigurationError class.
     * @param {string} message - The error message.
     */
    constructor(message) {
        super(message);
        this.name = 'CriticalConfigurationError';
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

        // Ensure critical environment variables are present before proceeding
        // We do this here after reload() potentially loads them from .env
        await this.reload();

        if (!process.env.JWT_SECRET) {
            throw new CriticalConfigurationError('JWT_SECRET environment variable is required for security.');
        }

        if (!process.env.ENCRYPTION_SALT) {
            throw new CriticalConfigurationError('ENCRYPTION_SALT environment variable is required for security.');
        }

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
                let localConfig = JSON.parse(localContent);
                
                // [Migration Hook] Auto-migrate local configuration
                const migratedLocal = migrationService.migrateConfig(localConfig);
                if ((migratedLocal.version || 0) > (localConfig.version || 0)) {
                    console.log('[Config] Migrating local.json to V2...');
                    await this._saveLocal(migratedLocal);
                    localConfig = migratedLocal;
                }

                rawConfig = this._mergeDeep(rawConfig, localConfig);
            }
        } catch (e) {
            // It is acceptable if local.json does not exist; we continue with defaults
            // We also ignore SyntaxError (empty/corrupt file) and just log a warning
            if (e.code !== 'ENOENT') {
                console.warn('Warning: Failed to load local config (using defaults):', e.message);
            }
        }

        // Decrypt sensitive fields loaded from local.json
        await this._processSensitiveFields(rawConfig, 'decrypt');

        // [Migration Hook] Ensure final configuration structure is up-to-date
        rawConfig = migrationService.migrateConfig(rawConfig);

        // [Migration Hook] Migrate secrets from .env if present
        const { config: envMigrated, changed, migratedKeys } = migrationService.migrateEnvSecrets(rawConfig);
        if (changed) {
            console.log(`[Config] Migrating ${migratedKeys.length} secrets from .env to local.json...`);
            // Use _saveLocal to persist immediately
            // We need to do this before applying env overrides so we don't save overrides
            await this._saveLocal(envMigrated);
            rawConfig = envMigrated;
            
            // Clean up .env (non-blocking)
            const envManager = require('../utils/envManager');
            for (const key of migratedKeys) {
                envManager.deleteEnvValue(key);
            }
        }

        // Merge environment variables to override file-based settings
        this._applyEnvOverrides(rawConfig);

        // [Constraint Enforcement] Validate/Clamp values based on Strategy Metadata
        this._validateConstraints(rawConfig);

        // Clean up source data based on selected type
        this._cleanSourceData(rawConfig);

        // [Strategy Pattern] Validate provider-specific parameters
        this._validateSources(rawConfig);

        // Validate the final configuration against the Zod schema
        try {
            this._config = configSchema.parse(rawConfig);
        } catch (e) {
            if (e.name === 'ZodError') {
                const issues = e.issues || e.errors || [];
                const formattedErrors = issues.map(err => {
                    const path = err.path.join('.');
                    return path ? `${path}: ${err.message}` : err.message;
                }).join(', ');
                throw new Error(`Configuration Validation Failed: ${formattedErrors}`);
            }
            throw e;
        }
    }

    /**
     * Enforces strategy-defined constraints on configuration values.
     * @param {Object} config - The configuration object.
     * @private
     */
    _validateConstraints(config) {
        if (!config.automation?.outputs) return;
        
        // Lazy load OutputFactory
        let OutputFactory;
        try { OutputFactory = require('../outputs'); } catch { return; }

        for (const [id, outputConfig] of Object.entries(config.automation.outputs)) {
            try {
                // We access the strategy by ID. If it doesn't exist, skip.
                // OutputFactory.getStrategy throws if not found.
                // We use try/catch inside loop.
                const strategy = OutputFactory.getStrategy(id);
                
                if (typeof outputConfig.leadTimeMs === 'number') {
                    const min = -30000;
                    const max = 30000;
                    
                    if (outputConfig.leadTimeMs < min || outputConfig.leadTimeMs > max) {
                        const clamped = Math.max(min, Math.min(outputConfig.leadTimeMs, max));
                        console.warn(`[Config] Warning: leadTimeMs for '${id}' (${outputConfig.leadTimeMs}ms) exceeds allowed range [${min}-${max}ms]. Clamped to ${clamped}ms.`);
                        outputConfig.leadTimeMs = clamped;
                    }
                }

                // [REQ-004] LocalOutput specific constraint: audioPlayer allowlist
                if (id === 'local' && outputConfig.params?.audioPlayer) {
                    const metadata = strategy.constructor.getMetadata();
                    const playerParam = metadata.params.find(p => p.key === 'audioPlayer');
                    const allowed = playerParam?.options || [];
                    
                    if (!allowed.includes(outputConfig.params.audioPlayer)) {
                        console.warn(`[Config] Warning: Invalid audioPlayer '${outputConfig.params.audioPlayer}' for 'local' output. Reverting to default 'mpg123'.`);
                        outputConfig.params.audioPlayer = 'mpg123';
                    }
                }
            } catch {
                // Strategy not found or error, ignore
            }
        }
    }

    /**
     * Persists the local configuration to disk atomically.
     * 
     * @param {Object} config - The configuration object to save.
     * @private
     */
    async _saveLocal(config) {
        // Create a deep copy to avoid mutating the original config while encrypting
        const copy = JSON.parse(JSON.stringify(config));
        await this._processSensitiveFields(copy, 'encrypt');

        const tempPath = `${this._localPath}.tmp`;
        const content = JSON.stringify(copy, null, 2);

        try {
            // Write to a temporary file first
            await fs.writeFile(tempPath, content, 'utf-8');

            // Basic verification: ensure the written file is valid JSON
            const verifyContent = await fs.readFile(tempPath, 'utf-8');
            JSON.parse(verifyContent);

            // Atomically rename the temp file to the target local configuration path
            await fs.rename(tempPath, this._localPath);
        } catch (error) {
            // Clean up the temp file if it exists
            try { await fs.unlink(tempPath); } catch { /* ignore */ }
            throw new Error(`Atomic configuration save failed: ${error.message}`);
        }
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
            
            // Clean up source data based on selected type
            this._cleanSourceData(newLocalCandidate);

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
            try {
                configSchema.parse(fullCandidate);
            } catch (e) {
                if (e.name === 'ZodError') {
                    const issues = e.issues || e.errors || [];
                    const formattedErrors = issues.map(err => {
                        const path = err.path.join('.');
                        return path ? `${path}: ${err.message}` : err.message;
                    }).join(', ');
                    throw new Error(`Configuration Validation Failed: ${formattedErrors}`);
                }
                throw e;
            }

            // [Strategy Pattern] Validate provider-specific parameters
            this._validateSources(fullCandidate);
            
            // Logic validation is handled by the API layer to avoid circular dependencies.

            // Persist the updated local configuration to disk atomically
            await this._saveLocal(newLocalCandidate);

            // Reload the configuration to update the in-memory state
            await this.reload();

        } finally {
            this._isSaving = false;
        }
    }

    /**
     * Validates provider-specific configuration using schemas defined in providers.
     * 
     * @param {Object} config - The full configuration object.
     * @private
     */
    _validateSources(config) {
        if (!config.sources) return;

        const { ProviderFactory } = require('../providers');

        ['primary', 'backup'].forEach(role => {
            const source = config.sources[role];
            if (!source || !source.type) return;

            try {
                const providerClass = ProviderFactory.getProviderClass(source.type);
                const schema = providerClass.getConfigSchema();
                
                // Backup sources might have an extra 'enabled' field not present in the provider-specific schema
                let validationSchema = schema;
                if (role === 'backup') {
                    const { z } = require('zod');
                    validationSchema = schema.extend({ enabled: z.boolean().optional() });
                }

                validationSchema.parse(source);
            } catch (e) {
                if (e.name === 'ZodError') {
                    const issues = e.issues || e.errors || [];
                    const formattedErrors = issues.map(err => {
                        const path = err.path.join('.');
                        return path ? `${path}: ${err.message}` : err.message;
                    }).join(', ');
                    throw new Error(`[${role.toUpperCase()} Source] ${formattedErrors}`);
                }
                throw e;
            }
        });
    }

    /**
     * Removes irrelevant source-specific keys when a source type is changed.
     * 
     * @param {Object} config - The configuration object to clean.
     * @private
     */
    _cleanSourceData(config) {
        if (!config.sources) return;

        const { ProviderFactory } = require('../providers');
        const providers = ProviderFactory.getRegisteredProviders();

        ['primary', 'backup'].forEach(role => {
            const source = config.sources[role];
            if (!source || !source.type) return;

            const activeProvider = providers.find(p => p.id === source.type);
            if (!activeProvider) return;

            const allowedKeys = new Set(['type', 'enabled', ...activeProvider.parameters.map(p => p.key)]);
            
            // Also allow sensitive keys that might have been stripped from local.json but are in memory
            activeProvider.parameters.filter(p => p.sensitive).forEach(p => allowedKeys.add(p.key));

            Object.keys(source).forEach(key => {
                if (!allowedKeys.has(key)) {
                    delete source[key];
                }
            });
        });
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
            // Guard against prototype pollution
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
                continue;
            }

            if (Array.isArray(source[key])) {
                // Arrays are completely overwritten in this configuration system
                 output[key] = source[key];
            } else if (typeof source[key] === 'object' && source[key] !== null) {
                if (typeof output[key] === 'object' && output[key] !== null) {
                    // Recursively merge nested objects
                    output[key] = this._mergeDeep(output[key], source[key]);
                } else {
                    // Target is missing or primitive: deep clone source
                    output[key] = this._mergeDeep({}, source[key]);
                }
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
        
        // [Dynamic Output Secrets]
        const OutputFactory = require('../outputs');        const secrets = OutputFactory.getSecretRequirementKeys();

        secrets.forEach(({ strategyId, key }) => {
            // e.g. VOICEMONKEY_TOKEN
            // Special case mapping if needed, but standard is ID_KEY
            const envKey = `${strategyId.toUpperCase()}_${key.toUpperCase()}`;
            
            if (process.env[envKey]) {
                if (!config.automation.outputs) config.automation.outputs = {};
                if (!config.automation.outputs[strategyId]) config.automation.outputs[strategyId] = { params: {} };
                if (!config.automation.outputs[strategyId].params) config.automation.outputs[strategyId].params = {};
                
                config.automation.outputs[strategyId].params[key] = process.env[envKey];
            }
        });

        // [REQ-006] Apply dynamic provider secrets from environment variables
        const { ProviderFactory } = require('@providers');
        const providers = ProviderFactory.getRegisteredProviders();

        for (const provider of providers) {
            provider.parameters.filter(p => p.sensitive).forEach(param => {
                const envKey = param.key.toUpperCase();
                if (process.env[envKey]) {
                    ['primary', 'backup'].forEach(role => {
                        const source = config.sources?.[role];
                        if (source?.type === provider.id) {
                            source[param.key] = process.env[envKey];
                        }
                    });
                }
            });
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
            
                    // [Dynamic Output Secrets]
                    const OutputFactory = require('../outputs');            const secrets = OutputFactory.getSecretRequirementKeys();
            
            secrets.forEach(({ strategyId, key }) => {
                const envKey = `${strategyId.toUpperCase()}_${key.toUpperCase()}`;
                if (process.env[envKey]) {
                     // If env var exists, remove from config to avoid saving it
                     if (config.automation.outputs?.[strategyId]?.params?.[key] !== undefined) {
                         delete config.automation.outputs[strategyId].params[key];
                     }
                }
            });
        }

        // [REQ-006] Dynamic provider secrets from metadata
        const { ProviderFactory } = require('@providers');
        const providers = ProviderFactory.getRegisteredProviders();
        
        for (const provider of providers) {
            const sensitiveKeys = provider.parameters
                .filter(p => p.sensitive)
                .map(p => p.key);
            
            for (const role of ['primary', 'backup']) {
                const source = config.sources?.[role];
                if (source?.type === provider.id) {
                    for (const key of sensitiveKeys) {
                        if (source[key] !== undefined) {
                            delete source[key];
                        }
                    }
                }
            }
        }
    }

    /**
     * Returns the encryption key derived from JWT_SECRET or a fallback value.
     * @returns {string} The encryption key used for securing sensitive data.
     * @private
     */
    _getEncryptionKey() {
        if (!process.env.JWT_SECRET) {
            throw new CriticalConfigurationError('JWT_SECRET environment variable is required for security.');
        }
        return process.env.JWT_SECRET;
    }

    /**
     * Encrypts or decrypts sensitive fields in the configuration object.
     * @param {Object} obj - The configuration object to process.
     * @param {'encrypt'|'decrypt'} action - The action to perform.
     * @returns {Promise<void>}
     * @private
     */
    async _processSensitiveFields(obj, action = 'encrypt') {
        if (!obj || typeof obj !== 'object') return;

        const key = this._getEncryptionKey();

        // 1. Process Outputs
        if (obj.automation?.outputs) {
            let OutputFactory;
            try { OutputFactory = require('../outputs'); } catch {}
            
            if (OutputFactory) {
                for (const [id, outputConfig] of Object.entries(obj.automation.outputs)) {
                    try {
                        const strategy = OutputFactory.getStrategy(id);
                        const metadata = strategy.constructor.getMetadata();
                        const sensitiveKeys = metadata.params?.filter(p => p.sensitive).map(p => p.key) || [];
                        
                        if (outputConfig.params) {
                            for (const sKey of sensitiveKeys) {
                                const val = outputConfig.params[sKey];
                                if (val && typeof val === 'string') {
                                    if (action === 'encrypt') {
                                        // Only encrypt if it's not already encrypted and not masked
                                        if (!val.includes(':') && !encryption.isMasked(val)) {
                                            outputConfig.params[sKey] = await encryption.encrypt(val, key);
                                        }
                                    } else {
                                        // Decrypt if it looks like encrypted data
                                        if (val.includes(':')) {
                                            try {
                                                outputConfig.params[sKey] = await encryption.decrypt(val, key);
                                            } catch {
                                                // Decryption failed (wrong key or corrupted), keep as is
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } catch { /* strategy not found */ }
                }
            }
        }

        // 2. Process Sources
        if (obj.sources) {
            let ProviderFactory;
            try { ProviderFactory = require('../providers').ProviderFactory; } catch {}
            
            if (ProviderFactory) {
                for (const role of ['primary', 'backup']) {
                    const source = obj.sources[role];
                    if (source && source.type) {
                        try {
                            const providerClass = ProviderFactory.getProviderClass(source.type);
                            const metadata = providerClass.getMetadata();
                            const sensitiveKeys = metadata.parameters?.filter(p => p.sensitive).map(p => p.key) || [];
                            
                            for (const sKey of sensitiveKeys) {
                                const val = source[sKey];
                                if (val && typeof val === 'string') {
                                    if (action === 'encrypt') {
                                        if (!val.includes(':') && !encryption.isMasked(val)) {
                                            source[sKey] = await encryption.encrypt(val, key);
                                        }
                                    } else {
                                        if (val.includes(':')) {
                                            try {
                                                source[sKey] = await encryption.decrypt(val, key);
                                            } catch { /* ignore */ }
                                        }
                                    }
                                }
                            }
                        } catch { /* provider not found */ }
                    }
                }
            }
        }
    }
}

module.exports = { ConfigService, ConfigNotInitializedError, CriticalConfigurationError };