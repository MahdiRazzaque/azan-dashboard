const workflowService = require('@services/system/configurationWorkflowService');
const configService = require('@config');
const sseService = require('@services/system/sseService');
const prayerTimeService = require('@services/core/prayerTimeService');
const schedulerService = require('@services/core/schedulerService');
const audioAssetService = require('@services/system/audioAssetService');
const healthCheck = require('@services/system/healthCheck');
const { validateConfigSource } = require('@services/core/validationService');
const OutputFactory = require('@outputs');

jest.mock('@config');
jest.mock('@services/system/sseService');
jest.mock('@services/core/prayerTimeService');
jest.mock('@services/core/schedulerService');
jest.mock('@services/system/audioAssetService');
jest.mock('@services/system/healthCheck');
jest.mock('@services/core/validationService');
jest.mock('@outputs');

describe('ConfigurationWorkflowService', () => {
    const mockConfig = {
        sources: { primary: { type: 'aladhan' }, backup: { enabled: true, type: 'mymasjid' } },
        location: { timezone: 'UTC', coordinates: { lat: 0, long: 0 } },
        automation: { 
            triggers: {
                fajr: { adhan: { enabled: true, type: 'tts', targets: ['voicemonkey'] } }
            },
            outputs: {
                voicemonkey: { enabled: true }
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        configService.get.mockReturnValue(mockConfig);
        audioAssetService.syncAudioAssets.mockResolvedValue({ warnings: [] });
        prayerTimeService.forceRefresh.mockResolvedValue({ meta: { source: 'test' } });
        healthCheck.getHealth.mockReturnValue({});
        healthCheck.refresh.mockResolvedValue({});
        OutputFactory.getAllStrategies.mockReturnValue([
            { id: 'voicemonkey', label: 'VoiceMonkey' }
        ]);
        const mockStrategy = { validateTrigger: jest.fn().mockReturnValue([]) };
        OutputFactory.getStrategy.mockReturnValue(mockStrategy);
    });

    it('should execute full update workflow', async () => {
        const newConfig = {
            ...mockConfig,
            location: { ...mockConfig.location, timezone: 'Europe/London' }
        };
        const result = await workflowService.executeUpdate(newConfig);
        expect(result.message).toContain('Settings validated');
        expect(prayerTimeService.forceRefresh).toHaveBeenCalled();
    });

    it('should skip refresh if not critical', async () => {
        const newConfig = { ...mockConfig, automation: { ...mockConfig.automation, baseUrl: 'https://ok.com' } };
        await workflowService.executeUpdate(newConfig);
        expect(prayerTimeService.forceRefresh).not.toHaveBeenCalled();
    });

    it('should handle backup source refresh', async () => {
        const newConfig = { ...mockConfig, sources: { primary: { type: 'a' }, backup: { enabled: true } } };
        await workflowService.executeUpdate(newConfig);
        expect(healthCheck.refresh).toHaveBeenCalledWith('backupSource');
    });

    it('should handle sync failure and rollback', async () => {
        audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Fail'));
        await expect(workflowService.executeUpdate(mockConfig)).rejects.toThrow(/Sync Failed/);
        expect(configService.update).toHaveBeenCalledWith(mockConfig);
    });

    it('should identify active services', () => {
        const used = workflowService._getUsedServices(mockConfig);
        expect(used.has('tts')).toBe(true);
        expect(used.has('voicemonkey')).toBe(true);
    });

    it('should collect warnings', async () => {
        const health = { 
            tts: { healthy: false }, 
            voicemonkey: { healthy: false, message: 'Offline' } 
        };
        const syncResult = { warnings: ['W1'] };
        const warnings = await workflowService._collectWarnings(syncResult, health, mockConfig);
        expect(warnings).toContain('W1');
        expect(warnings).toContain('Fajr Adhan: TTS Service is offline');
        expect(warnings).toContain('Fajr Adhan: VoiceMonkey output is offline (Offline)');
    });

    it('should handle strategy validation error in _collectWarnings', async () => {
        OutputFactory.getStrategy.mockImplementation(() => { throw new Error('Crash'); });
        const warnings = await workflowService._collectWarnings({}, {}, mockConfig);
        expect(warnings).toBeDefined();
    });
});