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
            system: { healthChecks: {} }
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
});