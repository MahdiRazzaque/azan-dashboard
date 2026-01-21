const fs = require('fs');
const axios = require('axios');
const service = require('@services/system/audioAssetService');
const configService = require('@config');
const healthCheck = require('@services/system/healthCheck');
const voiceService = require('@services/system/voiceService');

jest.mock('fs');
jest.mock('axios');
jest.mock('@config');
jest.mock('@services/system/healthCheck');
jest.mock('@services/system/voiceService');

describe('AudioAssetService', () => {
    const mockConfig = {
        automation: {
            pythonServiceUrl: 'http://python-service',
            baseUrl: 'http://localhost',
            voiceMonkey: { enabled: false },
            triggers: {
                fajr: {
                     preAdhan: { enabled: true, type: 'tts', template: '{minutes} till {prayerEnglish}', targets: ['local'] },
                     adhan: { enabled: false }
                },
                dhuhr: { preAdhan: { enabled: false } },
                asr: { preAdhan: { enabled: false } },
                maghrib: { preAdhan: { enabled: false } },
                isha: { preAdhan: { enabled: false } }
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        configService.get.mockReturnValue(mockConfig);
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue([]);
        fs.statSync.mockReturnValue({ mtimeMs: Date.now() });
        fs.unlinkSync.mockImplementation(() => {});
        fs.writeFileSync.mockImplementation(() => {});
        fs.utimesSync.mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        healthCheck.getHealth.mockReturnValue({ tts: { healthy: true } });
        healthCheck.refresh.mockResolvedValue();
    });

    describe('syncAudioAssets', () => {
        it('should throw error if TTS service is offline (L133)', async () => {
            healthCheck.getHealth.mockReturnValue({ tts: { healthy: false } });
            await expect(service.syncAudioAssets()).rejects.toThrow('TTS Service is offline');
        });

        it('should return existing file if locally cached', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readFileSync.mockImplementation((path) => {
                if (path.toString().endsWith('.json')) {
                     return JSON.stringify({ 
                         text: "{minutes} till Fajr", 
                         voice: "ar-DZ-IsmaelNeural" 
                     }); 
                }
                return "audio";
            });
            await service.syncAudioAssets();
            expect(fs.utimesSync).toHaveBeenCalled();
            expect(axios).not.toHaveBeenCalled();
        });

        it('should call python service if cache miss', async () => {
            fs.existsSync.mockReturnValue(false); 
            axios.post.mockResolvedValue({ data: { success: true } });
            await service.syncAudioAssets();
            expect(axios.post).toHaveBeenCalled();
            const callArgs = axios.post.mock.calls[0];
            expect(callArgs[0]).toContain('tts');
            expect(callArgs[1].text).toContain('Fajr'); 
        });

        it('should use trigger-specific voice if provided', async () => {
            const voiceConfig = JSON.parse(JSON.stringify(mockConfig));
            voiceConfig.automation.triggers.fajr.preAdhan.voice = 'en-US-JennyNeural';
            configService.get.mockReturnValue(voiceConfig);
            fs.existsSync.mockReturnValue(false);
            await service.syncAudioAssets();
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('generate-tts'),
                expect.objectContaining({ voice: 'en-US-JennyNeural' })
            );
        });

        it('should use global default voice if trigger voice is missing', async () => {
            const voiceConfig = JSON.parse(JSON.stringify(mockConfig));
            voiceConfig.automation.defaultVoice = 'en-GB-SoniaNeural';
            configService.get.mockReturnValue(voiceConfig);
            fs.existsSync.mockReturnValue(false);
            await service.syncAudioAssets();
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('generate-tts'),
                expect.objectContaining({ voice: 'en-GB-SoniaNeural' })
            );
        });
    });

    describe('cleanupTempAudio', () => {
        it('should delete temp mp3 files older than 1 hour', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['temp1.mp3', 'fresh.mp3', 'other.txt']);
            const now = Date.now();
            const OLD_TIME = now - (61 * 60 * 1000); 
            const NEW_TIME = now;
            fs.statSync.mockImplementation((path) => {
                if (path.includes('temp1.mp3')) return { mtimeMs: OLD_TIME };
                return { mtimeMs: NEW_TIME };
            });
            await service.cleanupTempAudio();
            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('temp1.mp3'));
        });
    });

    describe('cleanupCache', () => {
        it('should delete old files', async () => {
            fs.readdirSync.mockReturnValue(['old_file.json', 'new_file.json']);
            const now = Date.now();
            const OLD_TIME = now - (31 * 24 * 60 * 60 * 1000);
            const NEW_TIME = now;
            fs.statSync.mockImplementation((path) => {
                if (path.includes('old_file')) return { mtimeMs: OLD_TIME };
                return { mtimeMs: NEW_TIME };
            });
            await service.cleanupCache();
            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('old_file'));
        });

        it('should handle cleanup errors', async () => {
            fs.readdirSync.mockImplementation(() => { throw new Error('Filesystem error'); });
            await service.cleanupCache();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Cache cleanup failed'), expect.any(String));
        });
    });

    describe('resolveTemplate', () => {
        it('should resolve placeholders correctly', () => {
            const res = service.resolveTemplate('{prayerEnglish} at {minutes}', 'fajr', 10);
            expect(res).toBe('Fajr at ten');
        });
    });
    
    describe('syncAudioAssets Edge Cases', () => {
        it('should handle TTS generation errors gracefully', async () => {
            fs.existsSync.mockReturnValue(false); 
            axios.post.mockRejectedValue(new Error('TTS Failed'));
            await service.syncAudioAssets();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('TTS Generation failed'), expect.any(String));
        });

        it('should verify forceClean functionality', async () => {
            fs.readdirSync.mockReturnValue(['file.mp3', 'file.json', 'other.txt']);
            await service.syncAudioAssets(true);
            expect(fs.unlinkSync).toHaveBeenCalledTimes(2); 
        });

        it('should handle forceClean errors gracefully', async () => {
            fs.readdirSync.mockImplementation(() => { throw new Error('Read Error'); });
            await service.syncAudioAssets(true);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to force clean cache'), expect.any(Object));
        });
    });

    it('should throw error if quota is exceeded (L201)', async () => {
        const mockedStorage = require('@services/system/storageService');
        // Use spyOn instead of mock to avoid breaking other tests
        jest.spyOn(mockedStorage, 'checkQuota').mockResolvedValue({ success: false, message: 'Full' });
        fs.existsSync.mockReturnValue(false);
        await expect(service.syncAudioAssets()).rejects.toThrow('Storage Limit Exceeded');
    });

    describe('previewTTS', () => {
        beforeEach(() => {
            jest.spyOn(Date, 'now').mockReturnValue(new Date('2023-01-01T12:00:00Z').getTime());
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should return cached preview if valid', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ mtimeMs: Date.now() - 1000 }); // 1 second old
            
            const result = await service.previewTTS('Hello', 'fajr', 0, 'voice1');
            expect(result.url).toContain('preview_');
            expect(fs.utimesSync).toHaveBeenCalled();
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should regenerate preview if cache is expired', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.statSync.mockReturnValue({ mtimeMs: Date.now() - (2 * 60 * 60 * 1000) }); // 2 hours old
            axios.post.mockResolvedValue({ data: { url: 'new-url' } });
            
            await service.previewTTS('Hello', 'fajr', 0, 'voice1');
            expect(axios.post).toHaveBeenCalled();
        });

        it('should handle storage quota during preview generation', async () => {
            fs.existsSync.mockReturnValue(false);
            const storageService = require('@services/system/storageService');
            jest.spyOn(storageService, 'checkQuota').mockResolvedValue({ success: false, message: 'Quota exceeded' });
            
            await expect(service.previewTTS('Hello', 'fajr', 0, 'voice1')).rejects.toThrow('Storage limit reached');
        });

        it('should throw error if preview generation fails', async () => {
            fs.existsSync.mockReturnValue(false);
            const storageService = require('@services/system/storageService');
            jest.spyOn(storageService, 'checkQuota').mockResolvedValue({ success: true });
            axios.post.mockRejectedValue(new Error('Generation Error'));
            
            await expect(service.previewTTS('Hello', 'fajr', 0, 'voice1')).rejects.toThrow('Generation Error');
        });

        it('should return early if TEMP_DIR does not exist in cleanupTempAudio', async () => {
            fs.existsSync.mockReturnValue(false);
            await service.cleanupTempAudio();
            expect(fs.readdirSync).not.toHaveBeenCalled();
        });

        it('should handle cleanupTempAudio errors', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockImplementation(() => { throw new Error('Cleanup Fail'); });
            await service.cleanupTempAudio();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Temp cleanup failed'), expect.any(String));
        });
    });
});
