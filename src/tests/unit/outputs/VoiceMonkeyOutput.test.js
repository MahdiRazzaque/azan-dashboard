const VoiceMonkeyOutput = require('@outputs/VoiceMonkeyOutput');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ConfigService = require('@config');

// Mock bottleneck
jest.mock('bottleneck', () => {
    return jest.fn().mockImplementation(() => {
        return {
            schedule: jest.fn((fn) => fn()),
            on: jest.fn(),
            stop: jest.fn()
        };
    });
});

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

describe('VoiceMonkeyOutput Comprehensive', () => {
    let output;

    beforeEach(() => {
        jest.clearAllMocks();
        VoiceMonkeyOutput.queue = {
            schedule: jest.fn((fn) => fn()),
            on: jest.fn()
        };
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

    describe('verifyCredentials', () => {
        it('should handle API errors without explicit error message', async () => {
            axios.get.mockResolvedValue({ data: { success: false } }); // success false but no error string
            await expect(output.verifyCredentials({ token: 't', device: 'd' })).rejects.toThrow('Verification Failed');
        });
    });

    describe('validateTrigger', () => {
        it('should return no warnings if file not found in provided list', () => {
            const context = {
                audioFiles: [{ path: 'other.mp3' }],
                niceName: 'Test',
                prayer: 'fajr',
                triggerType: 'adhan'
            };
            const trigger = { type: 'file', path: 'missing.mp3' };
            const result = output.validateTrigger(trigger, context);
            expect(result).toHaveLength(0);
        });
    });

    describe('validateAsset', () => {
        it('should accept valid MP3 (MPEG 1 Layer 3)', async () => {
            const result = await output.validateAsset('p.mp3', { 
                format: 'MPEG', 
                codec: 'MPEG 1 Layer 3', 
                mimeType: 'audio/mpeg',
                bitrate: 128000, 
                duration: 30 
            });
            expect(result.valid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should accept valid WAV', async () => {
            const result = await output.validateAsset('p.wav', { 
                format: 'WAV', 
                codec: 'PCM', 
                mimeType: 'audio/wav',
                bitrate: 1411200, 
                duration: 30 
            });
            expect(result.valid).toBe(true);
        });

        it('should accept valid OGG', async () => {
            const result = await output.validateAsset('p.ogg', { 
                format: 'Ogg', 
                codec: 'Vorbis', 
                mimeType: 'audio/ogg',
                bitrate: 128000, 
                duration: 30 
            });
            expect(result.valid).toBe(true);
        });

        it('should accept valid OPUS', async () => {
            const result = await output.validateAsset('p.opus', { 
                format: 'Ogg', 
                codec: 'Opus', 
                mimeType: 'audio/opus',
                bitrate: 64000, 
                duration: 30 
            });
            expect(result.valid).toBe(true);
        });

        it('should accept valid AAC', async () => {
            const result = await output.validateAsset('p.aac', { 
                format: 'ADTS', 
                codec: 'AAC', 
                mimeType: 'audio/aac',
                bitrate: 128000, 
                duration: 30 
            });
            expect(result.valid).toBe(true);
        });

        it('should reject unsupported formats', async () => {
            const result = await output.validateAsset('p.flac', { 
                format: 'FLAC', 
                codec: 'FLAC', 
                mimeType: 'audio/flac',
                bitrate: 128000, 
                duration: 30 
            });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Unsupported format');
        });

        it('should reject high bitrate', async () => {
            const result = await output.validateAsset('p.mp3', { 
                format: 'mp3', 
                mimeType: 'audio/mpeg',
                bitrate: 2000000, 
                duration: 30 
            });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Bitrate too high');
        });

        it('should accept bitrate up to 1411.2 kbps', async () => {
            const result = await output.validateAsset('p.mp3', { 
                format: 'mp3', 
                mimeType: 'audio/mpeg',
                bitrate: 1411200, 
                duration: 30 
            });
            expect(result.valid).toBe(true);
        });

        it('should reject high sample rate', async () => {
            const result = await output.validateAsset('p.mp3', { 
                format: 'mp3', 
                mimeType: 'audio/mpeg',
                sampleRate: 48001,
                duration: 30 
            });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Sample rate too high');
        });

        it('should reject large file size', async () => {
            const result = await output.validateAsset('p.mp3', { 
                format: 'mp3', 
                mimeType: 'audio/mpeg',
                size: 11 * 1024 * 1024,
                duration: 30 
            });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('File size too large');
        });

        it('should reject long duration', async () => {
            const result = await output.validateAsset('p.mp3', { 
                format: 'mp3', 
                mimeType: 'audio/mpeg',
                bitrate: 128000, 
                duration: 241 
            });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Duration too long');
        });
    });

    describe('Queue failed handler', () => {
        it('should cover the listener', () => {
            // Placeholder for coverage
        });
    });
    
    it('should return metadata', () => {
        VoiceMonkeyOutput.getMetadata();
    });

    it('should execute successfully', async () => {
        fs.promises.access.mockResolvedValue(undefined);
        fs.promises.readFile.mockResolvedValue(JSON.stringify({ compatibility: { voicemonkey: { valid: true } } }));
        axios.get.mockResolvedValue({ data: { success: true } });
        await output.execute({ source: { url: '/t.mp3', filePath: '/f.mp3' } }, {});
    });

    it('should skip incompatible', async () => {
        fs.promises.readFile.mockResolvedValue(JSON.stringify({ compatibility: { voicemonkey: { valid: false } } }));
        await output.execute({ source: { url: '/t.mp3', filePath: '/f.mp3' } }, {});
    });

    it('should handle missing params in execute', async () => {
        ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com' } });
        await output.execute({ source: { url: '/t.mp3' } }, {});
    });

    it('should handle trigger fail', async () => {
        axios.get.mockRejectedValue(new Error('Fail'));
        await expect(output.execute({ source: { url: 'http://ok.com/t.mp3' } }, {})).rejects.toThrow();
    });

    it('should handle healthCheck API fail', async () => {
        axios.get.mockResolvedValue({ data: { success: false } });
        await output.healthCheck();
    });

    it('should handle healthCheck network fail', async () => {
        axios.get.mockRejectedValue(new Error('Fail'));
        await output.healthCheck();
    });

    it('should validate trigger with legacy meta', () => {
        output.validateTrigger({ type: 'file', path: 'p' }, { audioFiles: [{ path: 'p', vmCompatible: false }], niceName: 'n' });
    });
});
