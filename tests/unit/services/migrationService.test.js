const migrationService = require('../../../src/services/system/migrationService');

describe('migrationService', () => {
    describe('migrateConfig', () => {
        it('should migrate V1 config with VoiceMonkey to V2', () => {
            const v1Config = {
                automation: {
                    voiceMonkey: {
                        enabled: true,
                        token: 'myToken',
                        device: 'myDevice'
                    }
                }
            };

            const result = migrationService.migrateConfig(v1Config);

            expect(result.version).toBe(2);
            expect(result.automation.voiceMonkey).toBeUndefined();
            expect(result.automation.outputs.voicemonkey).toEqual({
                enabled: true,
                leadTimeMs: 0, // Default
                params: {
                    token: 'myToken',
                    device: 'myDevice'
                }
            });
        });

        it('should handle V1 config without VoiceMonkey', () => {
            const v1Config = {
                automation: {
                    // No voiceMonkey
                }
            };

            const result = migrationService.migrateConfig(v1Config);

            expect(result.version).toBe(2);
            expect(result.automation.outputs).toEqual({});
        });

        it('should preserve existing V2 config', () => {
            const v2Config = {
                version: 2,
                automation: {
                    outputs: {
                        voicemonkey: { enabled: true }
                    }
                }
            };

            const result = migrationService.migrateConfig(v2Config);

            expect(result).toEqual(v2Config); // Should be identical
        });
        
        it('should not mutate original object', () => {
            const v1Config = { automation: { voiceMonkey: {} } };
            const copy = JSON.parse(JSON.stringify(v1Config));
            
            migrationService.migrateConfig(v1Config);
            expect(v1Config).toEqual(copy);
        });
    });
});
