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
            execute: jest.fn().mockImplementation((p, m, signal) => new Promise((resolve, reject) => {
                const err = new Error('Abort'); err.name = 'AbortError';
                signal.addEventListener('abort', () => reject(err));
            })),
            constructor: { getMetadata: () => ({ id: 'voicemonkey', timeoutMs: 1 }) }
        };
        OutputFactory.getStrategy.mockReturnValue(mockStrategy);
        
        const spyErr = jest.spyOn(console, 'error').mockImplementation();
        await service.triggerEvent('fajr', 'adhan');
        expect(spyErr).toHaveBeenCalled();
        spyErr.mockRestore();

        // 3. delay with immediate abort
        // This is internal but we can try to trigger it by passing an already aborted signal if we could.
        // But delay is not exported.
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
});