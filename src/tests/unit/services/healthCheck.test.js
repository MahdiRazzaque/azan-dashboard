const healthCheck = require('@services/system/healthCheck');
const configService = require('@config');
const OutputFactory = require('../../../outputs');
const { ProviderFactory } = require('@providers');
const axios = require('axios');

jest.mock('@config');
jest.mock('../../../outputs');
jest.mock('@providers');
jest.mock('axios');

describe('HealthCheck Service', () => {
    let mockLocalStrategy, mockVMStrategy;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockLocalStrategy = {
            constructor: { getMetadata: () => ({ id: 'local', hidden: false }) },
            healthCheck: jest.fn().mockResolvedValue({ healthy: true, message: 'Ready' })
        };
        mockVMStrategy = {
             constructor: { getMetadata: () => ({ id: 'voicemonkey', hidden: false }) },
             healthCheck: jest.fn().mockResolvedValue({ healthy: true, message: 'Online' })
        };
        
        OutputFactory.getAllStrategies.mockReturnValue([
            { id: 'local', hidden: false, params: [] },
            { id: 'voicemonkey', hidden: false, params: [] },
            { id: 'browser', hidden: true, params: [] }
        ]);
        
        OutputFactory.getStrategy.mockImplementation((id) => {
            if (id === 'local') return mockLocalStrategy;
            if (id === 'voicemonkey') return mockVMStrategy;
            return null;
        });

        configService.get.mockReturnValue({
            sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: false } },
            location: { timezone: 'UTC' },
            system: { healthChecks: { local: true, voicemonkey: true, primarySource: true, backupSource: true } }
        });
        
        ProviderFactory.create.mockReturnValue({
            healthCheck: jest.fn().mockResolvedValue({ healthy: true, message: 'Online' })
        });

        axios.get.mockResolvedValue({ status: 200 });
    });

    it('should refresh all non-hidden strategies', async () => {
        const result = await healthCheck.refresh('all');
        
        expect(OutputFactory.getStrategy).toHaveBeenCalledWith('local');
        expect(OutputFactory.getStrategy).toHaveBeenCalledWith('voicemonkey');
        
        expect(mockLocalStrategy.healthCheck).toHaveBeenCalled();
        expect(mockVMStrategy.healthCheck).toHaveBeenCalled();
        
        expect(result.local.healthy).toBe(true);
        expect(result.voicemonkey.healthy).toBe(true);
    });

    it('should refresh specific strategy if target matches ID', async () => {
        await healthCheck.refresh('voicemonkey');
        expect(mockVMStrategy.healthCheck).toHaveBeenCalled();
        expect(mockLocalStrategy.healthCheck).not.toHaveBeenCalled();
    });
    
    it('should handle checkSource using provider healthCheck', async () => {
         const mockProvider = { healthCheck: jest.fn().mockResolvedValue({ healthy: true, message: 'Source OK' }) };
         ProviderFactory.create.mockReturnValue(mockProvider);
         
         const result = await healthCheck.checkSource('primary');
         expect(mockProvider.healthCheck).toHaveBeenCalled();
         expect(result.healthy).toBe(true);
    });

    it('should filter params passed to strategies based on requiredForHealth', async () => {
        OutputFactory.getAllStrategies.mockReturnValue([
            { 
                id: 'local', 
                hidden: false, 
                params: [{ key: 'audioPlayer', requiredForHealth: true }] 
            },
            { 
                id: 'voicemonkey', 
                hidden: false, 
                params: [{ key: 'token', requiredForHealth: true }] 
            }
        ]);

        const leakedParams = {
            token: 'vm_token',
            audioPlayer: 'mpg123',
            extra: 'ignore_me'
        };

        await healthCheck.refresh('all', leakedParams);

        expect(mockLocalStrategy.healthCheck).toHaveBeenCalledWith({ audioPlayer: 'mpg123' });
        expect(mockVMStrategy.healthCheck).toHaveBeenCalledWith({ token: 'vm_token' });
    });

    it('should populate health-check params from config and inject baseUrl', async () => {
        OutputFactory.getAllStrategies.mockReturnValue([
            {
                id: 'local',
                hidden: false,
                params: []
            },
            {
                id: 'voicemonkey',
                hidden: false,
                params: [
                    { key: 'token', requiredForHealth: true },
                    { key: 'device', requiredForHealth: false },
                    { key: 'region', requiredForHealth: true }
                ]
            }
        ]);

        configService.get.mockReturnValue({
            automation: {
                baseUrl: 'https://dashboard.test',
                outputs: {
                    voicemonkey: {
                        params: {
                            token: 'stored-token',
                            device: 'living-room',
                            region: 'us-east-1'
                        }
                    }
                }
            },
            sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: false } },
            location: { timezone: 'UTC' },
            system: { healthChecks: { local: true, voicemonkey: true, primarySource: true, backupSource: true } }
        });

        await healthCheck.refresh('voicemonkey');

        expect(mockVMStrategy.healthCheck).toHaveBeenCalledWith({
            token: 'stored-token',
            region: 'us-east-1',
            baseUrl: 'https://dashboard.test'
        });
    });

    it('should merge transient health-check params with stored config fallback and preserve transient baseUrl', async () => {
        OutputFactory.getAllStrategies.mockReturnValue([
            {
                id: 'voicemonkey',
                hidden: false,
                params: [
                    { key: 'token', requiredForHealth: true },
                    { key: 'device', requiredForHealth: false },
                    { key: 'region', requiredForHealth: true }
                ]
            }
        ]);

        configService.get.mockReturnValue({
            automation: {
                baseUrl: 'https://dashboard.test',
                outputs: {
                    voicemonkey: {
                        params: {
                            token: 'stored-token',
                            device: 'living-room',
                            region: 'us-east-1'
                        }
                    }
                }
            },
            sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: false } },
            location: { timezone: 'UTC' },
            system: { healthChecks: { voicemonkey: true } }
        });

        await healthCheck.refresh('voicemonkey', {
            token: 'transient-token',
            baseUrl: 'https://preview.test'
        });

        expect(mockVMStrategy.healthCheck).toHaveBeenCalledWith({
            token: 'transient-token',
            region: 'us-east-1',
            baseUrl: 'https://preview.test'
        });
    });

    describe('Config-based Toggles', () => {
        it('should skip disabled checks in daily maintenance', async () => {
            configService.get.mockReturnValue({
                system: {
                    healthChecks: {
                        local: false,
                        voicemonkey: true,
                        tts: true
                    }
                },
                sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: true } }
            });

            const result = await healthCheck.runDailyMaintenance();

            expect(mockLocalStrategy.healthCheck).not.toHaveBeenCalled();
            expect(mockVMStrategy.healthCheck).toHaveBeenCalled();
            expect(result.local.message).toBe('Monitoring Disabled');
        });

        it('should bypass disabled checks if force is true', async () => {
            configService.get.mockReturnValue({
                system: {
                    healthChecks: {
                        local: false
                    }
                },
                sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: true } }
            });

            await healthCheck.refresh('local', null, { force: true });

            expect(mockLocalStrategy.healthCheck).toHaveBeenCalled();
        });
    });

    describe('toggle', () => {
        it('should persist toggle state to config', async () => {
            configService.get.mockReturnValue({ system: { healthChecks: { api: true } } });
            
            await healthCheck.toggle('api', false);
            
            expect(configService.update).toHaveBeenCalledWith({
                system: { healthChecks: { api: false } }
            });
        });
    });

    describe('runStartupChecks', () => {
        it('should run all checks with force true', async () => {
            configService.get.mockReturnValue({
                system: { healthChecks: { local: false } },
                sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: false } }
            });

            await healthCheck.runStartupChecks();

            expect(mockLocalStrategy.healthCheck).toHaveBeenCalled();
        });
    });

    describe('Per-service lastChecked (Issue #37)', () => {
        it('should set lastChecked on each refreshed target, not globally', async () => {
            const result = await healthCheck.refresh('tts');

            // The refreshed target should have its own lastChecked
            expect(result.tts.lastChecked).toBeDefined();
            expect(typeof result.tts.lastChecked).toBe('string');

            // Global lastChecked should NOT exist
            expect(result.lastChecked).toBeUndefined();
        });

        it('should set lastChecked on all targets when refreshing all', async () => {
            const result = await healthCheck.refresh('all');

            expect(result.tts.lastChecked).toBeDefined();
            expect(result.primarySource.lastChecked).toBeDefined();
            expect(result.backupSource.lastChecked).toBeDefined();
            expect(result.local.lastChecked).toBeDefined();
            expect(result.voicemonkey.lastChecked).toBeDefined();

            // Global lastChecked should NOT exist
            expect(result.lastChecked).toBeUndefined();
        });

        it('should initialise each service with lastChecked: null', () => {
            // Use isolateModules to get a fresh healthCache
            jest.isolateModules(() => {
                const freshHealthCheck = require('@services/system/healthCheck');
                // Re-mock OutputFactory for the fresh module context
                const FreshOutputFactory = require('../../../outputs');
                FreshOutputFactory.getAllStrategies.mockReturnValue([
                    { id: 'local', hidden: false, params: [] },
                    { id: 'voicemonkey', hidden: false, params: [] }
                ]);

                freshHealthCheck.init();
                const health = freshHealthCheck.getHealth();

                // Each service entry should have lastChecked: null initially
                expect(health.tts.lastChecked).toBeNull();
                expect(health.primarySource.lastChecked).toBeNull();
                expect(health.backupSource.lastChecked).toBeNull();
                expect(health.local.lastChecked).toBeNull();
                expect(health.voicemonkey.lastChecked).toBeNull();
            });
        });

        it('should only update lastChecked for the specific target refreshed', async () => {
            // Record current state before targeted refresh
            const before = healthCheck.getHealth();
            const ttsBefore = before.tts.lastChecked;

            // Refresh only voicemonkey
            await healthCheck.refresh('voicemonkey');
            const after = healthCheck.getHealth();

            // voicemonkey should have a new lastChecked
            expect(after.voicemonkey.lastChecked).toBeDefined();
            expect(typeof after.voicemonkey.lastChecked).toBe('string');

            // tts should be unchanged from before the refresh
            expect(after.tts.lastChecked).toBe(ttsBefore);
        });

        it('should not stamp lastChecked when monitoring is disabled (no real check ran)', async () => {
            // Record local's lastChecked before refresh
            const before = healthCheck.getHealth();
            const localLastCheckedBefore = before.local?.lastChecked || null;

            configService.get.mockReturnValue({
                system: {
                    healthChecks: {
                        local: false,
                        voicemonkey: true,
                        tts: true
                    }
                },
                sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: true } }
            });

            const result = await healthCheck.refresh('all');

            // Disabled service should preserve its previous lastChecked (no real check ran)
            expect(result.local.lastChecked).toBe(localLastCheckedBefore);

            // Enabled services should have a new lastChecked timestamp
            expect(result.voicemonkey.lastChecked).toBeDefined();
            expect(typeof result.voicemonkey.lastChecked).toBe('string');
            expect(result.tts.lastChecked).toBeDefined();
        });

        it('should return api as healthy even when api monitoring is toggled off', async () => {
            configService.get.mockReturnValue({
                system: {
                    healthChecks: {
                        api: false
                    }
                },
                sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: true } }
            });

            const result = await healthCheck.refresh('api');

            // API should always be healthy — it is exempt from monitoring toggle
            expect(result.api.healthy).toBe(true);
            expect(result.api.message).toBe('Ready');
            expect(result.api.lastChecked).toBeDefined();
            expect(typeof result.api.lastChecked).toBe('string');
        });
    });
});
