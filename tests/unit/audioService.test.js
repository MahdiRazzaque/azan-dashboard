const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { prepareDailyAssets } = require('../../src/services/audioAssetService');

// Mock dependencies
jest.mock('axios');
jest.mock('fs');
jest.mock('../../src/config', () => ({
    automation: {
        pythonServiceUrl: 'http://mock-python-service',
        triggers: {
            fajr: {
                preAdhan: {
                    enabled: true,
                    type: 'tts',
                    offsetMinutes: 15,
                    template: '{minutes} minutes till {prayerArabic}'
                }
            },
            dhuhr: {
                preAdhan: {
                    enabled: false, // Disabled
                    type: 'tts'
                }
            }
        }
    }
}));

describe('Audio Asset Service', () => {
    const CACHE_DIR = path.join(__dirname, '../../public/audio/cache');

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock fs default behaviors
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue([]);
        fs.statSync.mockReturnValue({ mtimeMs: Date.now() });
    });

    test('should resolve template and call python service for enabled TTS triggers', async () => {
        axios.post.mockResolvedValue({ data: { status: 'success' } });

        await prepareDailyAssets();

        // Should call axios twice? No, only fajr preAdhan is enabled.
        expect(axios.post).toHaveBeenCalledTimes(1);

        const expectedUrl = 'http://mock-python-service/generate-tts';
        const expectedBody = {
            text: 'fifteen minutes till الفجر', // number-to-words "15" -> "fifteen"
            filename: 'tts_fajr_preAdhan.mp3',
            voice: 'ar-SA-NaayfNeural'
        };

        expect(axios.post).toHaveBeenCalledWith(expectedUrl, expectedBody);
    });

    test('should delete old cache files', async () => {
        const OLD_FILE = 'old_file.mp3';
        const FRESH_FILE = 'fresh_file.mp3';
        
        fs.readdirSync.mockReturnValue([OLD_FILE, FRESH_FILE]);
        
        // Mock stats
        fs.statSync.mockImplementation((filePath) => {
            if (filePath.endsWith(OLD_FILE)) {
                return { mtimeMs: Date.now() - (31 * 24 * 60 * 60 * 1000) }; // 31 days old
            }
            return { mtimeMs: Date.now() };
        });

        await prepareDailyAssets();

        expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining(OLD_FILE));
        expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining(FRESH_FILE));
    });
});
