const fs = require('fs');
const service = require('@services/core/automationService');
const configService = require('@config');
const audioAssetService = require('@services/system/audioAssetService');
const sseService = require('@services/system/sseService');
const OutputFactory = require('@outputs');

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    promises: {
        access: jest.fn()
    }
}));
jest.mock('@config');
jest.mock('@services/system/audioAssetService');
jest.mock('@services/system/sseService');
jest.mock('@outputs');

describe('AutomationService Comprehensive', () => {
    const mockConfig = {
        automation: {
            baseUrl: 'https://test.com',
            triggers: {
                fajr: {
                    adhan: { enabled: true, type: 'tts', template: 'T', targets: ['voicemonkey'] }
                }
            },
            outputs: {
                browser: { enabled: true, leadTimeMs: 0 },
                voicemonkey: { enabled: true, leadTimeMs: 2000 }
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        configService.get.mockReturnValue(mockConfig);
    });

    it('should cover all remaining branches', async () => {
        // 1. settings.enabled false
        await service.triggerEvent('fajr', 'disabled_event'); // nonexistent event
        
        // 2. waitDelay > 0 and delay abort
        audioAssetService.ensureTTSFile.mockResolvedValue({ success: true });
        const mockStrategy = {
            execute: jest.fn().mockResolvedValue(),
            constructor: { getMetadata: () => ({ id: 'voicemonkey', timeoutMs: -5000 }) }
        };
        OutputFactory.getStrategy.mockReturnValue(mockStrategy);
        
        const spyErr = jest.spyOn(console, 'error').mockImplementation();
        await service.triggerEvent('fajr', 'adhan');
        expect(spyErr).toHaveBeenCalled();
        spyErr.mockRestore();
    });
    
    it('should hit waitDelay = 0 branch', async () => {
        configService.get.mockReturnValue({
            automation: {
                baseUrl: 'https://test.com',
                triggers: { fajr: { adhan: { enabled: true, type: 'url', url: 'h', targets: ['voicemonkey'] } } },
                outputs: { voicemonkey: { enabled: true, leadTimeMs: 0 } }
            }
        });
        const mockStrategy = {
            execute: jest.fn().mockResolvedValue(),
            constructor: { getMetadata: () => ({ id: 'voicemonkey' }) }
        };
        OutputFactory.getStrategy.mockReturnValue(mockStrategy);
        await service.triggerEvent('fajr', 'adhan');
        expect(mockStrategy.execute).toHaveBeenCalled();
    });

    describe('getAudioSource', () => {
        it('should handle tts type', () => {
            const settings = { type: 'tts' };
            const result = service.getAudioSource(settings, 'fajr', 'adhan');
            expect(result).toEqual({ path: 'cache/tts_fajr_adhan.mp3' });
        });

        it('should handle file type', () => {
            const settings = { type: 'file', path: 'custom.mp3' };
            const result = service.getAudioSource(settings, 'fajr', 'adhan');
            expect(result).toEqual({ path: 'custom.mp3' });
        });

        it('should handle url type', () => {
            const settings = { type: 'url', url: 'https://example.com/audio.mp3' };
            const result = service.getAudioSource(settings, 'fajr', 'adhan');
            expect(result).toEqual({ url: 'https://example.com/audio.mp3' });
        });

        it('should return null for unknown type', () => {
            const result = service.getAudioSource({ type: 'unknown' }, 'fajr', 'adhan');
            expect(result).toBeNull();
        });
    });

    describe('triggerEvent Error Paths', () => {
        it('should handle TTS generation failure', async () => {
            audioAssetService.ensureTTSFile.mockResolvedValue({ success: false, message: 'Quota exceeded' });
            await service.triggerEvent('fajr', 'adhan');
            expect(sseService.broadcast).toHaveBeenCalledWith(expect.objectContaining({
                payload: expect.objectContaining({ message: expect.stringContaining('TTS Service Offline') })
            }));
        });

        it('should handle TTS critical error', async () => {
            audioAssetService.ensureTTSFile.mockRejectedValue(new Error('Fatal'));
            await service.triggerEvent('fajr', 'adhan');
            // Should catch and log error
        });

        it('should handle missing custom file', async () => {
            configService.get.mockReturnValue({
                automation: {
                    triggers: { fajr: { adhan: { enabled: true, type: 'file', path: 'missing.mp3' } } }
                }
            });
            fs.promises.access.mockRejectedValue(new Error('ENOENT'));
            await service.triggerEvent('fajr', 'adhan');
            expect(sseService.broadcast).toHaveBeenCalledWith(expect.objectContaining({
                payload: expect.objectContaining({ message: expect.stringContaining('Custom file missing') })
            }));
        });

        it('should handle generic error in withTimeout', async () => {
            audioAssetService.ensureTTSFile.mockResolvedValue({ success: true });
            const mockStrategy = {
                execute: jest.fn().mockRejectedValue(new Error('Execution failed')),
                constructor: { getMetadata: () => ({ id: 'voicemonkey' }) }
            };
            OutputFactory.getStrategy.mockReturnValue(mockStrategy);
            
            const spyErr = jest.spyOn(console, 'error').mockImplementation();
            await service.triggerEvent('fajr', 'adhan');
            expect(spyErr).toHaveBeenCalledWith(expect.stringContaining('Error executing target'), 'Execution failed');
            spyErr.mockRestore();
        });
        it('should handle successful custom file access', async () => {
            configService.get.mockReturnValue({
                automation: {
                    triggers: { fajr: { adhan: { enabled: true, type: 'file', path: 'exists.mp3' } } }
                }
            });
            fs.promises.access.mockResolvedValue();
            const mockStrategy = {
                execute: jest.fn().mockResolvedValue(),
                constructor: { getMetadata: () => ({ id: 'voicemonkey' }) }
            };
            OutputFactory.getStrategy.mockReturnValue(mockStrategy);
            await service.triggerEvent('fajr', 'adhan');
            expect(fs.promises.access).toHaveBeenCalled();
        });
    });
});
