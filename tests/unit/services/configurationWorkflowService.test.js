const workflowService = require('@services/system/configurationWorkflowService');
const configService = require('@config');
const sseService = require('@services/system/sseService');
const prayerTimeService = require('@services/core/prayerTimeService');
const schedulerService = require('@services/core/schedulerService');
const audioAssetService = require('@services/system/audioAssetService');
const healthCheck = require('@services/system/healthCheck');
const { validateConfigSource } = require('@services/core/validationService');

jest.mock('@config');
jest.mock('@services/system/sseService');
jest.mock('@services/core/prayerTimeService');
jest.mock('@services/core/schedulerService');
jest.mock('@services/system/audioAssetService');
jest.mock('@services/system/healthCheck');
jest.mock('@services/core/validationService');

describe('ConfigurationWorkflowService', () => {
    const mockConfig = {
        sources: { primary: { type: 'aladhan' } },
        location: { timezone: 'UTC', coordinates: { lat: 0, long: 0 } },
        automation: { triggers: {} }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        configService.get.mockReturnValue(mockConfig);
        audioAssetService.syncAudioAssets.mockResolvedValue({ warnings: [] });
        prayerTimeService.forceRefresh.mockResolvedValue({ meta: { source: 'test' } });
        healthCheck.getHealth.mockReturnValue({});
    });

    it('should execute full update workflow', async () => {
        const newConfig = {
            ...mockConfig,
            location: { ...mockConfig.location, timezone: 'Europe/London' } // Change to trigger refresh
        };

        const result = await workflowService.executeUpdate(newConfig);

        expect(validateConfigSource).toHaveBeenCalled();
        expect(configService.update).toHaveBeenCalledWith(newConfig);
        expect(prayerTimeService.forceRefresh).toHaveBeenCalled();
        expect(audioAssetService.syncAudioAssets).toHaveBeenCalled();
        expect(schedulerService.initScheduler).toHaveBeenCalled();
        expect(result.message).toContain('Settings validated');
    });

    it('should handle sync failure and rollback', async () => {
        audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Sync Error'));
        const newConfig = { ...mockConfig };

        await expect(workflowService.executeUpdate(newConfig)).rejects.toThrow(/Sync Failed/);
        
        // Should rollback to previous config
        expect(configService.update).toHaveBeenCalledWith(mockConfig);
    });
});
