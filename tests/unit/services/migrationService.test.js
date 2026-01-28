const migrationService = require('../../../src/services/system/migrationService');

describe('migrationService', () => {
    describe('migrateConfig', () => {
        it('should migrate V1 config with VoiceMonkey to V3', () => {
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

            expect(result.version).toBe(3);
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

            expect(result.version).toBe(3);
            expect(result.automation.outputs).toEqual({});
        });

        it('should preserve existing V2 config if already migrated to V3', () => {
            const v3Config = {
                version: 3,
                sources: {
                    primary: { type: 'aladhan', method: 2 }
                }
            };

            const result = migrationService.migrateConfig(v3Config);

            expect(result.version).toBe(3);
            expect(result.sources.primary.method).toBe(2);
        });

        it('should migrate V2 config (global calculation) to V3 (source calculation)', () => {
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

            expect(result.version).toBe(3);
            expect(result.calculation).toBeUndefined();
            expect(result.sources.primary.method).toBe(2);
            expect(result.sources.primary.madhab).toBe(1);
            expect(result.sources.primary.latitudeAdjustmentMethod).toBe(3);
            expect(result.sources.primary.midnightMode).toBe(1);
        });
        
        it('should not mutate original object', () => {
            const v1Config = { automation: { voiceMonkey: {} } };
            const copy = JSON.parse(JSON.stringify(v1Config));
            
            migrationService.migrateConfig(v1Config);
            expect(v1Config).toEqual(copy);
        });
    });
});
