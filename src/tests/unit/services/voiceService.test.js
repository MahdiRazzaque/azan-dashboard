const fs = require('fs');
const axios = require('axios');
const configService = require('@config');

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn(),
        access: jest.fn()
    }
}));
jest.mock('axios');
jest.mock('@config');

describe('VoiceService (Async Refactor)', () => {
    let service;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.isolateModules(() => {
            service = require('@services/system/voiceService');
        });
        configService.get.mockReturnValue({
            automation: { pythonServiceUrl: 'http://python:8000' }
        });
    });

    it('should load from disk cache using fs.promises', async () => {
        const mockData = {
            timestamp: new Date().toISOString(),
            voices: [{ id: 'v1', name: 'Voice 1' }]
        };
        
        fs.promises.access.mockResolvedValue();
        fs.promises.readFile.mockResolvedValue(JSON.stringify(mockData));

        const voices = await service.refreshVoices();
        
        expect(fs.promises.readFile).toHaveBeenCalled();
        expect(voices).toHaveLength(1);
        expect(voices[0].id).toBe('v1');
    });

    it('should save to disk cache using fs.promises', async () => {
        const mockVoices = [{ id: 'v2', name: 'Voice 2' }];
        axios.get.mockResolvedValue({ data: mockVoices });
        
        // Mock disk cache miss
        fs.promises.access.mockRejectedValue(new Error('no cache'));
        fs.promises.mkdir.mockResolvedValue();
        fs.promises.writeFile.mockResolvedValue();

        const voices = await service.refreshVoices();
        
        expect(axios.get).toHaveBeenCalled();
        expect(fs.promises.writeFile).toHaveBeenCalled();
        expect(voices).toHaveLength(1);
        expect(voices[0].id).toBe('v2');
    });
});
