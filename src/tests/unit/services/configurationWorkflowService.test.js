const workflowService = require('../../../services/system/configurationWorkflowService');
const configService = require('@config');
const prayerTimeService = require('@services/core/prayerTimeService');
const schedulerService = require('@services/core/schedulerService');
const audioAssetService = require('@services/system/audioAssetService');
const healthCheck = require('@services/system/healthCheck');
const validationService = require('@services/core/validationService');
const sseService = require('@services/system/sseService');

jest.mock('@services/core/prayerTimeService');
jest.mock('@services/core/schedulerService');
jest.mock('@services/system/audioAssetService');
jest.mock('@services/system/healthCheck');
jest.mock('@services/core/validationService');
jest.mock('@services/system/sseService');

describe('ConfigurationWorkflowService', () => {
    const mockConfig = {
        location: { timezone: 'UTC', coordinates: { lat: 0, long: 0 } },
        sources: { primary: { type: 'aladhan' } },
        automation: { triggers: {} }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        configService.get.mockReturnValue(mockConfig);
        prayerTimeService.forceRefresh.mockResolvedValue({ meta: { count: 365 } });
        audioAssetService.syncAudioAssets.mockResolvedValue({ warnings: [] });
        healthCheck.getHealth.mockReturnValue({});
    });

    it('should execute full update workflow', async () => {
        const newConfig = { 
            ...mockConfig, 
            location: { timezone: 'Europe/London', coordinates: { lat: 51, long: 0 } } 
        };
        const result = await workflowService.executeUpdate(newConfig);
        
        expect(result.message).toContain('Settings updated successfully');
        expect(prayerTimeService.forceRefresh).toHaveBeenCalled();
        // Health check refresh should NOT be called anymore during save
        expect(healthCheck.refresh).not.toHaveBeenCalled();
    });

    it('should skip refresh if not critical', async () => {
        const newConfig = { 
            ...mockConfig, 
            automation: { ...mockConfig.automation, defaultVoice: 'new-voice' } 
        };
        const result = await workflowService.executeUpdate(newConfig);
        
        expect(result.meta.skip).toBe(true);
        expect(prayerTimeService.forceRefresh).not.toHaveBeenCalled();
    });

    it('should handle sync failure as soft-fail (REQ-002)', async () => {
        audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Disk Full'));
        
        const result = await workflowService.executeUpdate(mockConfig);
        expect(result.message).toBe('Settings updated successfully.');
        expect(result.warnings).toContain('Audio Synchronisation Warning: Disk Full');
        expect(configService.update).toHaveBeenCalledWith(mockConfig);
    });

    it('should identify active services', () => {
        const config = {
            automation: {
                triggers: {
                    fajr: { adhan: { enabled: true, type: 'tts', targets: ['local'] } }
                }
            }
        };
        const services = workflowService._getUsedServices(config);
        expect(services.has('tts')).toBe(true);
        expect(services.has('local')).toBe(true);
    });

    it('should collect warnings', async () => {
        const syncResult = { warnings: ['Sync Warning'] };
        const health = { tts: { healthy: false } };
        const finalConfig = {
            automation: {
                triggers: {
                    fajr: { adhan: { enabled: true, type: 'tts', targets: ['local'] } }
                }
            }
        };

        const warnings = await workflowService._collectWarnings(syncResult, health, finalConfig);
        expect(warnings).toContain('Sync Warning');
        expect(warnings).toContain('Fajr Adhan: TTS Service is offline');
    });

    it('should handle strategy validation error in _collectWarnings', async () => {
        const health = { local: { healthy: true } };
        const finalConfig = {
            automation: {
                outputs: { local: { enabled: true } },
                triggers: {
                    fajr: { adhan: { enabled: true, type: 'file', path: 'bad.mp3', targets: ['local'] } }
                }
            }
        };

        const warnings = await workflowService._collectWarnings({ warnings: [] }, health, finalConfig);
        expect(Array.isArray(warnings)).toBe(true);
    });
});
