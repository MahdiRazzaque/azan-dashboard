/**
 * Handles configuration schema migrations.
 */
class MigrationService {
    /**
     * Migrates configuration object to the latest version.
     * @param {Object} config - The raw configuration object.
     * @returns {Object} The migrated configuration object.
     */
    migrateConfig(config) {
        // Deep clone to avoid mutation
        let newConfig = JSON.parse(JSON.stringify(config));
        
        if (!newConfig.version || newConfig.version === 1) {
            newConfig = this.migrateV1toV2(newConfig);
        }

        if (newConfig.version === 2) {
            newConfig = this.migrateV2toV3(newConfig);
        }

        if (newConfig.version === 3) {
            newConfig = this.migrateV3toV4(newConfig);
        }

        if (newConfig.version === 4) {
            newConfig = this.migrateV4toV5(newConfig);
        }

        return newConfig;
    }

    /**
     * Migrates secrets from environment variables to the configuration object.
     * This is intended for first-boot migration from v2.0 to v2.1.
     * @param {Object} config - The configuration object to migrate into.
     * @returns {{config: Object, changed: boolean, migratedKeys: string[]}} The migrated configuration object, change flag, and list of env keys to delete.
     */
    migrateEnvSecrets(config) {
        let changed = false;
        const migratedKeys = [];
        
        // 1. Output Strategy Migration
        const OutputFactory = require('../../outputs');
        const outputSecrets = OutputFactory.getSecretRequirementKeys();

        outputSecrets.forEach(({ strategyId, key }) => {
            const envKey = `${strategyId.toUpperCase()}_${key.toUpperCase()}`;
            const envValue = process.env[envKey];

            if (envValue) {
                if (!config.automation) config.automation = {};
                if (!config.automation.outputs) config.automation.outputs = {};
                if (!config.automation.outputs[strategyId]) {
                    config.automation.outputs[strategyId] = { enabled: false, params: {} };
                }
                if (!config.automation.outputs[strategyId].params) {
                    config.automation.outputs[strategyId].params = {};
                }

                // Only migrate if not already in config
                if (!config.automation.outputs[strategyId].params[key]) {
                    config.automation.outputs[strategyId].params[key] = envValue;
                    changed = true;
                    migratedKeys.push(envKey);
                }
            }
        });

        // 2. Provider Migration
        const { ProviderFactory } = require('@providers');
        const providers = ProviderFactory.getRegisteredProviders();

        for (const provider of providers) {
            const sensitiveKeys = provider.parameters?.filter(p => p.sensitive).map(p => p.key) || [];
            
            for (const sKey of sensitiveKeys) {
                const envKey = sKey.toUpperCase();
                const envValue = process.env[envKey];

                if (envValue) {
                    ['primary', 'backup'].forEach(role => {
                        const source = config.sources?.[role];
                        if (source?.type === provider.id && !source[sKey]) {
                            source[sKey] = envValue;
                            changed = true;
                            if (!migratedKeys.includes(envKey)) migratedKeys.push(envKey);
                        }
                    });
                }
            }
        }

        return { config, changed, migratedKeys };
    }

    /**
     * Migrates the configuration from Version 1 to Version 2.
     * Transitions the legacy VoiceMonkey settings into the new Output Strategy format.
     * 
     * @param {Object} config The Version 1 configuration object.
     * @returns {Object} The migrated Version 2 configuration object.
     */
    migrateV1toV2(config) {
        const v2Config = { ...config, version: 2 };
        
        // Ensure automation exists
        if (!v2Config.automation) {
            v2Config.automation = {};
        }

        // Initialize outputs if missing
        if (!v2Config.automation.outputs) {
            v2Config.automation.outputs = {};
        }

        // Migration: VoiceMonkey (Legacy) -> Output Strategy
        if (v2Config.automation.voiceMonkey) {
            const legacy = v2Config.automation.voiceMonkey;
            
            v2Config.automation.outputs.voicemonkey = {
                enabled: !!legacy.enabled,
                leadTimeMs: 0, // Default for migrated config
                params: {
                    token: legacy.token,
                    device: legacy.device
                }
            };

            // Remove legacy key
            delete v2Config.automation.voiceMonkey;
        }

        return v2Config;
    }

    /**
     * Migrates V2 config to V3.
     * Moves global calculation settings into the primary source if it's aladhan.
     * @param {Object} config - V2 configuration.
     * @returns {Object} V3 configuration.
     */
    migrateV2toV3(config) {
        const v3Config = { ...config, version: 3 };

        if (v3Config.calculation && v3Config.sources && v3Config.sources.primary) {
            const primary = v3Config.sources.primary;
            
            if (primary.type === 'aladhan') {
                // Move calculation fields to primary source
                primary.method = v3Config.calculation.method;
                primary.madhab = v3Config.calculation.madhab;
                primary.latitudeAdjustmentMethod = v3Config.calculation.latitudeAdjustmentMethod;
                primary.midnightMode = v3Config.calculation.midnightMode;
            }

            // Remove global calculation object
            delete v3Config.calculation;
        }

        return v3Config;
    }

    /**
     * Migrates V3 config to V4.
     * Adds system.healthChecks block.
     * @param {Object} config - V3 configuration.
     * @returns {Object} V4 configuration.
     */
    migrateV3toV4(config) {
        const v4Config = { ...config, version: 4 };

        if (!v4Config.system) {
            v4Config.system = {
                healthChecks: {
                    api: true,
                    tts: true
                }
            };
        } else if (!v4Config.system.healthChecks) {
            v4Config.system.healthChecks = {
                api: true,
                tts: true
            };
        }

        return v4Config;
    }

    /**
     * Migrates V4 config to V5.
     * Adds security.tokenVersion block.
     * @param {Object} config - V4 configuration.
     * @returns {Object} V5 configuration.
     */
    migrateV4toV5(config) {
        const v5Config = { ...config, version: 5 };

        if (!v5Config.security) {
            v5Config.security = {
                tokenVersion: 1
            };
        } else if (v5Config.security.tokenVersion === undefined) {
            v5Config.security.tokenVersion = 1;
        }

        return v5Config;
    }
}

module.exports = new MigrationService();