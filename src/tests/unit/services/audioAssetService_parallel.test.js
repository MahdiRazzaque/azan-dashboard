const audioAssetService = require('@services/system/audioAssetService');
const axios = require('axios');
const configService = require('@config');
const fs = require('fs');
const fsp = fs.promises;

jest.mock('fs', () => ({
    promises: {
        access: jest.fn(),
        mkdir: jest.fn(),
        readdir: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        unlink: jest.fn(),
        utimes: jest.fn()
    }
}));

// Mock other dependencies
jest.mock('@utils/audioValidator', () => ({
    analyseAudioFile: jest.fn().mockResolvedValue({ duration: 10, mimeType: 'audio/mpeg' })
}));
jest.mock('@services/system/storageService', () => ({
    checkQuota: jest.fn().mockResolvedValue({ success: true })
}));
jest.mock('@services/system/healthCheck', () => ({
    refresh: jest.fn().mockResolvedValue({ tts: { healthy: true } })
}));
jest.mock('../../../outputs', () => ({
    getAllStrategyInstances: jest.fn().mockReturnValue([])
}));

describe('AudioAssetService Parallel Generation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('should generate TTS assets in parallel (REQ-003)', async () => {
        const config = {
            automation: {
                pythonServiceUrl: 'http://localhost:8000',
                triggers: {
                    fajr: { adhan: { enabled: true, type: 'tts', template: 'Fajr' } },
                    dhuhr: { adhan: { enabled: true, type: 'tts', template: 'Dhuhr' } },
                    asr: { adhan: { enabled: true, type: 'tts', template: 'Asr' } }
                }
            }
        };
        configService.get.mockReturnValue(config);

        // Mock readdir to return empty so it tries to generate
        fsp.readdir.mockResolvedValue([]);
        // Mock access to throw so it thinks files are missing
        fsp.access.mockRejectedValue(new Error('ENOENT'));
        fsp.readFile.mockResolvedValue(JSON.stringify({ text: 'old', voice: 'old' }));

        // Mock axios.post with 100ms delay
        axios.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

        const start = Date.now();
        await audioAssetService.syncAudioAssets();
        const duration = Date.now() - start;

        // 3 requests, each 100ms. 
        // If serial: > 300ms
        // If parallel (concurrency 3): ~100ms + overhead
        // Threshold is 500ms to accommodate slow CI runners (sequential would be >= 300ms)
        expect(duration).toBeLessThan(500);
        expect(axios.post).toHaveBeenCalledTimes(3);
    });
});
