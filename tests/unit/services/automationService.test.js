const fs = require('fs');
const service = require('@services/core/automationService');
const configService = require('@config');
const audioAssetService = require('@services/system/audioAssetService');
const sseService = require('@services/system/sseService');

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    promises: {
        access: jest.fn()
    }
}));
jest.mock('@config');
jest.mock('@services/system/audioAssetService');
jest.mock('@services/system/sseService');

describe('AutomationService (Async Refactor)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        configService.get.mockReturnValue({
            automation: {
                triggers: {
                    fajr: {
                        adhan: { enabled: true, type: 'file', path: 'custom.mp3', targets: [] }
                    }
                }
            }
        });
    });

    it('should use fs.promises.access for file validation', async () => {
        fs.promises.access.mockResolvedValue(); // file exists
        
        await service.triggerEvent('fajr', 'adhan');
        
        expect(fs.promises.access).toHaveBeenCalled();
    });
});
