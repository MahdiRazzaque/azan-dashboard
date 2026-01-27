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
        
        if (!newConfig.version) {
            newConfig = this.migrateV1toV2(newConfig);
        }

        return newConfig;
    }

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
}

module.exports = new MigrationService();
