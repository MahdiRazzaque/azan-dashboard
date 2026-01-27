const fs = require('fs');
const path = require('path');
const axios = require('axios');
const service = require('@services/system/audioAssetService');
const configService = require('@config');
const healthCheck = require('@services/system/healthCheck');
const voiceService = require('@services/system/voiceService');
const audioValidator = require('@utils/audioValidator');

jest.mock('fs');
jest.mock('axios');
jest.mock('@config');
jest.mock('@services/system/healthCheck');
jest.mock('@services/system/voiceService');
jest.mock('@utils/audioValidator');

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
        audioValidator.analyseAudioFile.mockResolvedValue({
            format: 'mp3',
            codec: 'LAME',
            bitrate: 128000,
            sampleRate: 44100,
            size: 1024,
            duration: 10
        });
        audioValidator.validateVoiceMonkeyCompatibility.mockReturnValue({
            vmCompatible: true,
            vmIssues: []
        });
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
                         voice: "ar-SA-HamedNeural" 
                     }); 
                }
                return "audio";
            });
            await service.syncAudioAssets();
            expect(fs.utimesSync).toHaveBeenCalled();
            expect(axios.post).not.toHaveBeenCalled();
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

    describe('ensureTestAudio', () => {
        it('should return early if test.mp3 already exists', async () => {
            fs.existsSync.mockReturnValue(true);
            await service.ensureTestAudio();
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should generate and move test.mp3 if it does not exist', async () => {
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('custom' + path.sep + 'test.mp3')) return false;
                if (p.includes('cache' + path.sep + 'test.mp3')) return true;
                return true;
            });
            axios.post.mockResolvedValue({ data: { success: true } });
            fs.renameSync.mockImplementation(() => {});

            await service.ensureTestAudio();

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('generate-tts'),
                expect.objectContaining({ text: 'Test', filename: 'test.mp3' })
            );
            expect(fs.renameSync).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('test.mp3.json'),
                expect.stringContaining('"text":"Test"')
            );
        });

        it('should handle errors during test audio generation', async () => {
            fs.existsSync.mockReturnValue(false);
            axios.post.mockRejectedValue(new Error('TTS Failed'));
            
            await service.ensureTestAudio();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to generate test audio'), 'TTS Failed');
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

        it('should use default pythonServiceUrl if missing (L138)', async () => {
             const customConfig = JSON.parse(JSON.stringify(mockConfig));
             delete customConfig.automation.pythonServiceUrl;
             configService.get.mockReturnValue(customConfig);
             
             fs.existsSync.mockReturnValue(false);
             axios.post.mockResolvedValue({ data: { success: true } });
             await service.syncAudioAssets();
             
             expect(axios.post).toHaveBeenCalledWith(
                 expect.stringContaining('http://localhost:8000'),
                 expect.any(Object)
             );
        });

        it('should verify forceClean functionality', async () => {
             fs.readdirSync.mockReturnValue(['file.mp3', 'file.json', 'other.txt']);
             fs.existsSync.mockReturnValue(true);
             await service.syncAudioAssets(true);
             expect(fs.unlinkSync).toHaveBeenCalledTimes(6); 
        });

        it('should skip forceClean if directories do not exist (L153)', async () => {
            fs.existsSync.mockImplementation((p) => {
                // Return false for the directories being cleaned
                if (p.includes('cache')) return false;
                return true;
            });
            fs.readdirSync.mockReturnValue([]);
            await service.syncAudioAssets(true);
            // In syncAudioAssets, if forceClean is true and dir missing, readdirSync shouldn't be called for it.
            // But cleanupCache calls it later. We just check that coverage hits the 'continue' or skips the block.
            // Simplified: if fs.existsSync is false, unlinkSync shouldn't be called from the forceClean block.
            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });

        it('should handle forceClean errors gracefully', async () => {
            // Since the source doesn't have a try-catch in forceClean, 
            // the test runner will catch it if we expect it to throw.
            fs.readdirSync.mockImplementation((dir) => {
                if (dir.includes('cache')) throw new Error('Read Error');
                return [];
            });
            await expect(service.syncAudioAssets(true)).rejects.toThrow('Read Error');
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

        it('should use provided pythonServiceUrl (L224 - branch 1)', async () => {
             const customConfig = JSON.parse(JSON.stringify(mockConfig));
             customConfig.automation.pythonServiceUrl = 'http://custom-python-service';
             configService.get.mockReturnValue(customConfig);
             fs.existsSync.mockReturnValue(false);
             axios.post.mockResolvedValue({ data: { url: 'ok' } });

             await service.previewTTS('Hello', 'fajr', 0, 'voice1');
             expect(axios.post).toHaveBeenCalledWith(
                 expect.stringContaining('http://custom-python-service'),
                 expect.any(Object)
             );
        });

        it('should use default pythonServiceUrl (L224 - branch 2)', async () => {
             const customConfig = JSON.parse(JSON.stringify(mockConfig));
             delete customConfig.automation.pythonServiceUrl;
             configService.get.mockReturnValue(customConfig);
             fs.existsSync.mockReturnValue(false);
             axios.post.mockResolvedValue({ data: { url: 'ok' } });

             await service.previewTTS('Hello', 'fajr', 0, 'voice1');
             expect(axios.post).toHaveBeenCalledWith(
                 expect.stringContaining('http://localhost:8000'),
                 expect.any(Object)
             );
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
            
            // The current implementation does NOT throw if quota exceeded in previewTTS
            axios.post.mockResolvedValue({ data: { url: 'new-url' } });
            const result = await service.previewTTS('Hello', 'fajr', 0, 'voice1');
            expect(result.url).toBe('new-url');
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

    describe('generateMetadataForExistingFiles', () => {
        const audioCustomDir = path.join(__dirname, '../../../public/audio/custom');
        const metaCustomDir = path.join(__dirname, '../../public/audio/custom');

        it('should generate metadata when metaPath does not exist (L267)', async () => {
            fs.readdirSync.mockImplementation((dir) => {
                if (dir.includes('custom')) return ['test.mp3'];
                return [];
            });
            fs.existsSync.mockImplementation((p) => {
                // If checking metaPath (starts with src/public/audio)
                if (p.includes('src' + path.sep + 'public' + path.sep + 'audio')) return false;
                // Otherwise (directories or audio files)
                return true;
            });

            await service.generateMetadataForExistingFiles();
            
            expect(audioValidator.analyseAudioFile).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        it('should skip generation when metaPath already exists (L267 branch)', async () => {
            fs.readdirSync.mockReturnValue(['exists.mp3']);
            fs.existsSync.mockReturnValue(true); // Everything exists

            await service.generateMetadataForExistingFiles();
            
            expect(audioValidator.analyseAudioFile).not.toHaveBeenCalled();
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('should handle legacy metadata (L274) and subsequent cleanup (L288)', async () => {
            const files = ['legacy.mp3'];
            fs.readdirSync.mockReturnValue(files);
            fs.existsSync.mockImplementation((p) => {
                // metaPath does not exist
                if (p.includes('src' + path.sep + 'public')) return false;
                // legacyMetaPath exists
                if (p.endsWith('legacy.mp3.json')) return true;
                // redundantMetaPath does not exist
                if (p.endsWith('.meta.json')) return false;
                // Audio and dirs exist
                return true;
            });
            fs.readFileSync.mockImplementation((p) => {
                if (p.endsWith('legacy.mp3.json')) {
                    return JSON.stringify({ text: 'Legacy text', voice: 'Legacy voice' });
                }
                return '';
            });

            await service.generateMetadataForExistingFiles();

            expect(fs.readFileSync).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('Legacy text')
            );
            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('legacy.mp3.json'));
        });

        it('should handle redundant metadata (L276) and subsequent cleanup (L289)', async () => {
            const files = ['redundant.mp3'];
            fs.readdirSync.mockReturnValue(files);
            fs.existsSync.mockImplementation((p) => {
                // metaPath does not exist
                if (p.includes('src' + path.sep + 'public')) return false;
                // legacyMetaPath does not exist
                if (p.endsWith('redundant.mp3.json')) return false;
                // redundantMetaPath exists
                if (p.endsWith('redundant.mp3.meta.json')) return true;
                // Audio and dirs exist
                return true;
            });
            fs.readFileSync.mockImplementation((p) => {
                if (p.endsWith('redundant.mp3.meta.json')) {
                    return JSON.stringify({ text: 'Redundant text', voice: 'Redundant voice' });
                }
                return '';
            });

            await service.generateMetadataForExistingFiles();

            expect(fs.readFileSync).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expect.stringContaining('Redundant text')
            );
            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('redundant.mp3.meta.json'));
        });

        it('should handle JSON parse errors for legacy metadata (L275 - catch)', async () => {
            const files = ['corrupt-legacy.mp3'];
            fs.readdirSync.mockReturnValue(files);
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('src' + path.sep + 'public')) return false;
                if (p.endsWith('corrupt-legacy.mp3.json')) return true;
                return true;
            });
            fs.readFileSync.mockReturnValue('INVALID_JSON');

            await service.generateMetadataForExistingFiles();

            // Should still write metadata (with empty existingData)
            expect(fs.writeFileSync).toHaveBeenCalled();
            // Should still clean up corrupt file
            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('corrupt-legacy.mp3.json'));
        });

        it('should handle JSON parse errors for redundant metadata (L277 - catch)', async () => {
            const files = ['corrupt-red.mp3'];
            fs.readdirSync.mockReturnValue(files);
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('src' + path.sep + 'public')) return false;
                if (p.endsWith('corrupt-red.mp3.json')) return false;
                if (p.endsWith('corrupt-red.mp3.meta.json')) return true;
                return true;
            });
            fs.readFileSync.mockReturnValue('INVALID_JSON');

            await service.generateMetadataForExistingFiles();

            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('corrupt-red.mp3.meta.json'));
        });

        it('should handle cases where no legacy or redundant metadata exist (L278 branch)', async () => {
            const files = ['none.mp3'];
            fs.readdirSync.mockReturnValue(files);
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('src' + path.sep + 'public')) return false;
                if (p.endsWith('.json')) return false; // Neither legacy nor meta exists
                return true;
            });

            await service.generateMetadataForExistingFiles();

            expect(fs.writeFileSync).toHaveBeenCalled();
            expect(fs.unlinkSync).not.toHaveBeenCalled();
        });

        it('should skip directory if audio directory does not exist (L257)', async () => {
            fs.existsSync.mockImplementation((p) => {
                if (p.includes('audio' + path.sep + 'custom')) return false;
                return true;
            });
            await service.generateMetadataForExistingFiles();
            expect(fs.readdirSync).not.toHaveBeenCalledWith(expect.stringContaining('custom'));
        });

        it('should handle errors during metadata generation gracefully (L291)', async () => {
            fs.readdirSync.mockReturnValue(['error.mp3']);
            fs.existsSync.mockImplementation((p) => {
                if (p.endsWith('error.mp3.json')) return false;
                return true;
            });
            audioValidator.analyseAudioFile.mockRejectedValue(new Error('Analysis Error'));

            await service.generateMetadataForExistingFiles();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Metadata generation failed'), 'Analysis Error');
        });
    });
});

