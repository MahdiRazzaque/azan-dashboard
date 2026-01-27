const healthCheck = require('@services/system/healthCheck');
const configService = require('@config');
const OutputFactory = require('../../../src/outputs');
const { ProviderFactory } = require('@providers');

jest.mock('@config');
jest.mock('../../../src/outputs');
jest.mock('@providers');
jest.mock('axios'); // For checkPythonService if kept

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
            { id: 'local', hidden: false },
            { id: 'voicemonkey', hidden: false },
            { id: 'browser', hidden: true }
        ]);
        
        OutputFactory.getStrategy.mockImplementation((id) => {
            if (id === 'local') return mockLocalStrategy;
            if (id === 'voicemonkey') return mockVMStrategy;
            return null;
        });

        configService.get.mockReturnValue({
            sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: false } },
            location: { timezone: 'UTC' }
        });
        
        ProviderFactory.create.mockReturnValue({
            getAnnualTimes: jest.fn().mockResolvedValue({})
        });
    });

    it('should refresh all non-hidden strategies', async () => {
        const result = await healthCheck.refresh('all');
        
        expect(OutputFactory.getStrategy).toHaveBeenCalledWith('local');
        expect(OutputFactory.getStrategy).toHaveBeenCalledWith('voicemonkey');
        expect(OutputFactory.getStrategy).not.toHaveBeenCalledWith('browser');
        
        expect(mockLocalStrategy.healthCheck).toHaveBeenCalled();
        expect(mockVMStrategy.healthCheck).toHaveBeenCalled();
        
        expect(result.local.healthy).toBe(true);
        // Note: strategy id is 'voicemonkey', result key should match
        expect(result.voicemonkey.healthy).toBe(true);
    });

    it('should refresh specific strategy if target matches ID', async () => {
        await healthCheck.refresh('voicemonkey');
        expect(mockVMStrategy.healthCheck).toHaveBeenCalled();
        expect(mockLocalStrategy.healthCheck).not.toHaveBeenCalled();
    });
    
    it('should handle checkSource', async () => {
         const result = await healthCheck.checkSource('primary');
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

        // local should only get audioPlayer, not token or extra
        expect(mockLocalStrategy.healthCheck).toHaveBeenCalledWith({ audioPlayer: 'mpg123' });
        
        // voicemonkey should only get token, not audioPlayer or extra
        expect(mockVMStrategy.healthCheck).toHaveBeenCalledWith({ token: 'vm_token' });
    });
});