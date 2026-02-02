const VoiceMonkeyOutput = require('@outputs/VoiceMonkeyOutput');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ConfigService = require('@config');

jest.mock('axios');
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        access: jest.fn()
    },
    existsSync: jest.fn(),
    readFileSync: jest.fn()
}));
jest.mock('@config');

describe('VoiceMonkeyOutput', () => {
    let output;

    beforeEach(() => {
        jest.clearAllMocks();
        output = new VoiceMonkeyOutput();
        ConfigService.get.mockReturnValue({
            automation: {
                baseUrl: 'https://test.com',
                outputs: {
                    voicemonkey: {
                        params: { token: 't1', device: 'd1' }
                    }
                }
            }
        });
    });

    describe('validateAsset', () => {
        it('should return valid for correct MP3 parameters', async () => {
            const meta = { format: 'mp3', bitrate: 128000, duration: 30 };
            const result = await output.validateAsset('path.mp3', meta);
            expect(result.valid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should return invalid for non-MP3 format', async () => {
            const meta = { format: 'wav', bitrate: 128000, duration: 30 };
            const result = await output.validateAsset('path.wav', meta);
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Unsupported format');
        });

        it('should return invalid for bitrate > 128kbps', async () => {
            const meta = { format: 'mp3', bitrate: 192000, duration: 30 };
            const result = await output.validateAsset('path.mp3', meta);
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Bitrate too high');
        });

        it('should return invalid for bitrate < 48kbps', async () => {
            const meta = { format: 'mp3', bitrate: 32000, duration: 30 };
            const result = await output.validateAsset('path.mp3', meta);
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Bitrate too low');
        });

        it('should return invalid for duration > 90s', async () => {
            const meta = { format: 'mp3', bitrate: 128000, duration: 100 };
            const result = await output.validateAsset('path.mp3', meta);
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Duration too long');
        });
    });

    describe('augmentAudioMetadata', () => {
        it('should align with validateAsset logic', () => {
            const meta = { format: 'wav', bitrate: 128000, duration: 30 };
            const result = output.augmentAudioMetadata(meta);
            expect(result.vmCompatible).toBe(false);
            expect(result.vmIssues).toHaveLength(1);
        });

        it('should return compatible for valid metadata', () => {
            const meta = { format: 'mp3', bitrate: 128000, duration: 30 };
            const result = output.augmentAudioMetadata(meta);
            expect(result.vmCompatible).toBe(true);
        });
    });

    describe('execute', () => {
        it('should trigger announcement if compatible', async () => {
            fs.promises.access.mockResolvedValue(undefined);
            fs.promises.readFile.mockResolvedValue(JSON.stringify({ compatibility: { voicemonkey: { valid: true } } }));
            axios.get.mockResolvedValue({ data: { success: true } });

            const payload = {
                source: { url: '/test.mp3', filePath: '/fake/public/audio/test.mp3' },
                baseUrl: 'https://test.com'
            };

            await output.execute(payload, {});
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('announcement'), expect.anything());
        });

        it('should skip if incompatible in metadata', async () => {
            fs.promises.access.mockResolvedValue(undefined);
            fs.promises.readFile.mockResolvedValue(JSON.stringify({ compatibility: { voicemonkey: { valid: false } } }));
            
            const payload = {
                source: { url: '/test.mp3', filePath: '/fake/public/audio/test.mp3' },
                baseUrl: 'https://test.com'
            };

            await output.execute(payload, {});
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should skip if baseUrl is not HTTPS', async () => {
            const payload = {
                source: { url: '/test.mp3' },
                baseUrl: 'http://insecure.com'
            };

            await output.execute(payload, {});
            expect(axios.get).not.toHaveBeenCalled();
        });
    });
});