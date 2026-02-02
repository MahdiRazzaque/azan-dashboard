const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const service = require('@services/system/audioAssetService');
const configService = require('@config');
const axios = require('axios');

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    promises: {
        access: jest.fn(),
        mkdir: jest.fn(),
        readdir: jest.fn(),
        stat: jest.fn(),
        unlink: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        copyFile: jest.fn(),
        rename: jest.fn(),
        utimes: jest.fn()
    }
}));

jest.mock('@config');
jest.mock('axios');
jest.mock('@utils/audioValidator', () => ({
    analyseAudioFile: jest.fn().mockResolvedValue({ format: 'mp3', duration: 10 })
}));

jest.mock('@services/system/healthCheck', () => ({
    refresh: jest.fn().mockResolvedValue({ tts: { healthy: true } })
}));

jest.mock('@services/system/storageService', () => ({
    checkQuota: jest.fn().mockResolvedValue({ success: true })
}));

describe('AudioAssetService (Refactored)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        configService.get.mockReturnValue({
            sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid' } },
            automation: {
                pythonServiceUrl: 'http://localhost:8000',
                triggers: {
                    fajr: {
                        azan: { enabled: true, type: 'tts', template: 'Fajr Azan' }
                    }
                }
            }
        });
    });

    it('should ensure directories exist asynchronously', async () => {
        fsp.access.mockRejectedValue(new Error('ENOENT'));
        fsp.mkdir.mockResolvedValue();
        
        await service.syncAudioAssets();
        
        expect(fsp.mkdir).toHaveBeenCalled();
    });

    it('should cleanup old cache files asynchronously', async () => {
        fsp.access.mockResolvedValue();
        fsp.readdir.mockResolvedValue(['old.mp3']);
        fsp.stat.mockResolvedValue({ mtimeMs: 0 }); // Very old
        fsp.unlink.mockResolvedValue();

        await service.cleanupCache();
        
        expect(fsp.readdir).toHaveBeenCalledWith(expect.stringContaining('cache'));
        expect(fsp.unlink).toHaveBeenCalledWith(expect.stringContaining('old.mp3'));
    });

    it('should generate TTS if file is missing', async () => {
        fsp.access.mockRejectedValue(new Error('ENOENT')); // missing file
        fsp.mkdir.mockResolvedValue();
        fsp.writeFile.mockResolvedValue();
        
        axios.post.mockResolvedValue({ status: 200 });

        const config = configService.get();
        const result = await service.ensureTTSFile('fajr', 'azan', config.automation.triggers.fajr.azan, config);
        
        expect(result.generated).toBe(true);
        expect(axios.post).toHaveBeenCalled();
        expect(fsp.writeFile).toHaveBeenCalled();
    });
});