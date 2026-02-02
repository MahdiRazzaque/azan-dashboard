const migrationService = require('../../../services/system/migrationService');

describe('migrationService', () => {
    describe('migrateConfig', () => {
        it('should migrate V1 config with VoiceMonkey to V4', () => {
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

            expect(result.version).toBe(4);
            expect(result.automation.voiceMonkey).toBeUndefined();
            expect(result.automation.outputs.voicemonkey).toEqual({
                enabled: true,
                leadTimeMs: 0, // Default
                params: {
                    token: 'myToken',
                    device: 'myDevice'
                }
            });
            expect(result.system.healthChecks).toBeDefined();
        });

        it('should handle V1 config without VoiceMonkey', () => {
            const v1Config = {
                automation: {
                    // No voiceMonkey
                }
            };

            const result = migrationService.migrateConfig(v1Config);

            expect(result.version).toBe(4);
            expect(result.automation.outputs).toEqual({});
        });

        it('should preserve existing V3 config and migrate to V4', () => {
            const v3Config = {
                version: 3,
                sources: {
                    primary: { type: 'aladhan', method: 2 }
                }
            };

            const result = migrationService.migrateConfig(v3Config);

            expect(result.version).toBe(4);
            expect(result.sources.primary.method).toBe(2);
            expect(result.system.healthChecks).toBeDefined();
        });

        it('should migrate V2 config (global calculation) to V4', () => {
            const v2Config = {
                version: 2,
                calculation: {
                    method: 2,
                    madhab: 1,
                    latitudeAdjustmentMethod: 3,
                    midnightMode: 1
                },
                sources: {
                    primary: { type: 'aladhan' }
                }
            };

            const result = migrationService.migrateConfig(v2Config);

            expect(result.version).toBe(4);
            expect(result.calculation).toBeUndefined();
            expect(result.sources.primary.method).toBe(2);
            expect(result.system.healthChecks).toBeDefined();
        });
        
        it('should migrate V3 config to V4 by adding system.healthChecks', () => {
            const v3Config = {
                version: 3,
                automation: { outputs: {} }
            };

            const result = migrationService.migrateConfig(v3Config);

            expect(result.version).toBe(4);
            expect(result.system.healthChecks).toEqual({
                api: true,
                tts: true
            });
        });

        it('should not mutate original object', () => {
            const v1Config = { automation: { voiceMonkey: {} } };
            const copy = JSON.parse(JSON.stringify(v1Config));
            
            migrationService.migrateConfig(v1Config);
            expect(v1Config).toEqual(copy);
        });
    });
});