const fs = require('fs');
const axios = require('axios');
const configService = require('@config');

jest.mock('fs');
jest.mock('axios');
jest.mock('@config');

describe('VoiceService', () => {
    let service;
    let mockConfigService;
    let mockAxios;
    let mockFs;
    const CACHE_FILE = expect.stringContaining('voices.json');

    beforeEach(() => {
        jest.resetModules();
        mockConfigService = require('@config');
        mockAxios = require('axios');
        mockFs = require('fs');
        service = require('@services/system/voiceService');
        
        // Default mock for config
        mockConfigService.get.mockReturnValue({
            automation: { pythonServiceUrl: 'http://mock-python:8000' }
        });

        // Default mock for axios
        mockAxios.get.mockResolvedValue({ data: [] });

        // Default mock for fs
        mockFs.existsSync.mockReturnValue(false);
        mockFs.readFileSync.mockReturnValue('{}');
        mockFs.mkdirSync.mockImplementation(() => {});
        mockFs.writeFileSync.mockImplementation(() => {});
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getVoices', () => {
        it('should return empty array initially', () => {
            expect(service.getVoices()).toEqual([]);
        });
    });

    describe('refreshVoices', () => {
        it('should return current voices if already fetching', async () => {
            // We can't easily set isFetching directly, but we can call it twice
            // Actually, we can mock axial to be slow and call it twice
            mockAxios.get.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ data: ['voice1'] }), 100)));
            
            const p1 = service.refreshVoices();
            const p2 = service.refreshVoices();
            
            const [r1, r2] = await Promise.all([p1, p2]);
            
            expect(mockAxios.get).toHaveBeenCalledTimes(1);
            expect(r2).toEqual([]); // Second call returns current 'voices' which is still []
        });

        it('should use memory cache if valid', async () => {
            // First call to populate memory cache
            mockAxios.get.mockResolvedValue({ data: ['voice1'] });
            await service.refreshVoices();
            
            // Second call
            const result = await service.refreshVoices();
            
            expect(mockAxios.get).toHaveBeenCalledTimes(1);
            expect(result).toEqual(['voice1']);
        });

        it('should load from disk cache if memory is empty and disk is valid', async () => {
            const mockVoices = ['voice-from-disk'];
            const mockData = {
                timestamp: new Date().toISOString(),
                voices: mockVoices
            };

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(mockData));

            const result = await service.refreshVoices();

            expect(result).toEqual(mockVoices);
            expect(mockAxios.get).not.toHaveBeenCalled();
        });

        it('should refresh if disk cache is expired', async () => {
            const oldDate = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(); // 30h ago
            const mockData = {
                timestamp: oldDate,
                voices: ['old-voice']
            };

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(mockData));
            mockAxios.get.mockResolvedValue({ data: ['new-voice'] });

            const result = await service.refreshVoices();

            expect(result).toEqual(['new-voice']);
            expect(mockAxios.get).toHaveBeenCalled();
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });

        it('should handle disk cache read error', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation(() => { throw new Error('Read Error'); });
            mockAxios.get.mockResolvedValue({ data: ['new-voice'] });

            const result = await service.refreshVoices();

            expect(result).toEqual(['new-voice']);
            expect(mockAxios.get).toHaveBeenCalled();
        });

        it('should fetch from Python service and save to cache', async () => {
            const mockVoices = ['python-voice'];
            mockAxios.get.mockResolvedValue({ data: mockVoices });
            mockFs.existsSync.mockReturnValue(false); // Cache dir doesn't exist

            const result = await service.refreshVoices();

            expect(result).toEqual(mockVoices);
            expect(mockAxios.get).toHaveBeenCalledWith('http://mock-python:8000/voices', { 
                timeout: 10000,
                maxContentLength: 5000000
            });
            expect(mockFs.mkdirSync).toHaveBeenCalled();
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });

        it('should use default Python URL if not configured', async () => {
            mockConfigService.get.mockReturnValue({ automation: {} });
            mockAxios.get.mockResolvedValue({ data: [] });

            await service.refreshVoices();

            expect(mockAxios.get).toHaveBeenCalledWith('http://localhost:8000/voices', { 
                timeout: 10000,
                maxContentLength: 5000000
            });
        });

        it('should handle fetch errors and return current voices', async () => {
            mockAxios.get.mockRejectedValue(new Error('Network Error'));
            
            const result = await service.refreshVoices();

            expect(result).toEqual([]);
            expect(mockAxios.get).toHaveBeenCalled();
        });

        it('should handle disk cache save error', async () => {
            mockAxios.get.mockResolvedValue({ data: ['v'] });
            mockFs.writeFileSync.mockImplementation(() => { throw new Error('Write Error'); });

            const result = await service.refreshVoices();

            expect(result).toEqual(['v']);
        });
    });

    describe('init', () => {
        it('should call refreshVoices', async () => {
            mockAxios.get.mockResolvedValue({ data: ['init-voice'] });
            await service.init();
            expect(service.getVoices()).toEqual(['init-voice']);
        });
    });
});
