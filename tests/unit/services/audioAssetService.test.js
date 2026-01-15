const fs = require('fs');
const axios = require('axios');
const service = require('../../../src/services/audioAssetService');
const configService = require('../../../src/config');

jest.mock('fs');
jest.mock('axios');
jest.mock('../../../src/config');

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
    });

    describe('syncAudioAssets', () => {
        it('should return existing file if locally cached', async () => {
            // Mock cache hit (exists + meta matches)
            fs.existsSync.mockReturnValue(true);
            
            // Assume the service reads metadata to check if text matches
            // We need to return valid JSON for metadata file
            fs.readFileSync.mockImplementation((path) => {
                // If it asks for .json, return meta with "cached" text
                if (path.toString().endsWith('.json')) {
                     // Note: The service resolves template before check. 
                     // {minutes} is left as is? Or stripped?
                     // With template "{minutes} till {prayerEnglish}", resolved is "{minutes} till Fajr"
                     return JSON.stringify({ text: "{minutes} till Fajr" }); 
                }
                return "audio";
            });

            await service.syncAudioAssets();
            
            expect(fs.utimesSync).toHaveBeenCalled();
            expect(axios).not.toHaveBeenCalled();
        });

        it('should call python service if cache miss', async () => {
            fs.existsSync.mockReturnValue(false); // Cache miss
            
            // Fix: Mock axios.post specifically as the service calls axios.post
            axios.post.mockResolvedValue({ 
                data: { success: true }
            });
            
            await service.syncAudioAssets();
            
            expect(axios.post).toHaveBeenCalled();
            // Verify payload
            const callArgs = axios.post.mock.calls[0]; // [url, body]
            
            expect(callArgs[0]).toContain('tts');
            expect(callArgs[1].text).toContain('Fajr'); 
        });
    });

    describe('cleanupCache', () => {
        it('should delete old files', async () => {
            fs.readdirSync.mockReturnValue(['old_file.json', 'new_file.json']);
            
            const now = Date.now();
            const OLD_TIME = now - (31 * 24 * 60 * 60 * 1000); // 31 days
            const NEW_TIME = now;

            fs.statSync.mockImplementation((path) => {
                if (path.includes('old_file')) return { mtimeMs: OLD_TIME };
                return { mtimeMs: NEW_TIME };
            });

            await service.cleanupCache();
            
            expect(fs.unlinkSync).toHaveBeenCalledTimes(1);
            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('old_file'));
        });

        it('should handle cleanup errors', async () => {
            fs.readdirSync.mockImplementation(() => { throw new Error('Filesystem error'); });
            await service.cleanupCache();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Cleanup failed'), expect.any(String));
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

        it('should handle forceClean errors', async () => {
            fs.readdirSync.mockImplementation(() => { throw new Error('Reader Fail'); });
            
            await service.syncAudioAssets(true);
            
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to force clean cache'), expect.anything());
        });
    });
});
