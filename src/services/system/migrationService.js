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
}

module.exports = new MigrationService();
