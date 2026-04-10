const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ConfigService = require('@config');
const Bottleneck = require('bottleneck');

// Mock bottleneck
jest.mock('bottleneck', () => {
    const m = {
        schedule: jest.fn((fn) => fn()),
        on: jest.fn(),
        stop: jest.fn()
    };
    return jest.fn(() => m);
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
    let VoiceMonkeyOutput;
    let output;

    beforeAll(() => {
        VoiceMonkeyOutput = require('@outputs/VoiceMonkeyOutput');
    });

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

    it('should return metadata', () => {
        const meta = VoiceMonkeyOutput.getMetadata();
        expect(meta.id).toBe('voicemonkey');
    });

    it('should execute successfully', async () => {
        const audioRoot = path.resolve(__dirname, '../../../../public/audio');
        const testFilePath = path.join(audioRoot, 'custom/test.mp3');
        fs.promises.access.mockResolvedValue(undefined);
        fs.promises.readFile.mockResolvedValue(JSON.stringify({ compatibility: { voicemonkey: { valid: true } } }));
        axios.get.mockResolvedValue({ data: { success: true } });
        await output.execute({ source: { url: '/t.mp3', filePath: testFilePath } }, {});
        expect(axios.get).toHaveBeenCalled();
    });

    it('should skip incompatible', async () => {
        const audioRoot = path.resolve(__dirname, '../../../../public/audio');
        const testFilePath = path.join(audioRoot, 'custom/test.mp3');
        fs.promises.readFile.mockResolvedValue(JSON.stringify({ compatibility: { voicemonkey: { valid: false } } }));
        await output.execute({ source: { url: '/t.mp3', filePath: testFilePath } }, {});
        expect(axios.get).not.toHaveBeenCalled();
    });

    it('should handle missing params in execute', async () => {
        ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com' } });
        await output.execute({ source: { url: '/t.mp3' } }, {});
        expect(axios.get).not.toHaveBeenCalled();
    });

    it('should handle trigger fail', async () => {
        axios.get.mockRejectedValue(new Error('Fail'));
        await expect(output.execute({ source: { url: 'https://ok.com/t.mp3' } }, {})).rejects.toThrow();
    });

    describe('execute edge cases', () => {
        it('should skip if baseUrl is not HTTPS', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'http://insecure.com' } });
            await output.execute({ source: { url: '/t.mp3' } }, {});
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should handle abort error', async () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            axios.get.mockRejectedValue(err);
            await output.execute({ source: { url: 'https://ok.com/t.mp3' } }, {});
            // Should not throw
        });

        it('should handle missing token or device', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: {} } } } });
            await output.execute({ source: { url: '/t.mp3' } }, {});
            expect(axios.get).not.toHaveBeenCalled();
        });
    });

    describe('healthCheck edge cases', () => {
        it('should return offline if baseUrl is not HTTPS', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'http://insecure.com' } });
            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toContain('HTTPS Base URL required');
        });

        it('should return offline if token is missing', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: {} } } } });
            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toContain('Token Missing');
        });

        it('should handle API failure response', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: { token: 't' } } } } });
            axios.get.mockResolvedValue({ data: { success: false, error: 'Some API Error' } });
            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toBe('Some API Error');
        });

        it('should handle network error', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: { token: 't' } } } } });
            axios.get.mockRejectedValue(new Error('Network Error'));
            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toBe('Network Error');
        });
    });

    describe('verifyCredentials edge cases', () => {
        it('should throw if token or device missing', async () => {
            await expect(output.verifyCredentials({})).rejects.toThrow('Missing token or device');
        });

        it('should handle API failure response', async () => {
            axios.get.mockResolvedValue({ data: { success: false, error: 'Invalid Token' } });
            await expect(output.verifyCredentials({ token: 't', device: 'd' })).rejects.toThrow('Invalid Token');
        });

        it('should handle API errors without explicit error message', async () => {
            axios.get.mockResolvedValue({ data: { success: false } }); // success false but no error string
            await expect(output.verifyCredentials({ token: 't', device: 'd' })).rejects.toThrow('Verification Failed');
        });
    });

    describe('validateTrigger edge cases', () => {
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

        it('should return warning if incompatible', () => {
            const context = {
                audioFiles: [{ path: 'p.mp3', compatibility: { voicemonkey: { valid: false, issues: ['Too long'] } } }],
                niceName: 'Test',
                prayer: 'fajr',
                triggerType: 'adhan'
            };
            const trigger = { type: 'file', path: 'p.mp3' };
            const result = output.validateTrigger(trigger, context);
            expect(result[0]).toContain('Audio incompatible with Alexa (Too long)');
        });

        it('should handle missing issues array', () => {
            const context = {
                audioFiles: [{ path: 'p.mp3', compatibility: { voicemonkey: { valid: false } } }],
                niceName: 'Test',
                prayer: 'fajr',
                triggerType: 'adhan'
            };
            const trigger = { type: 'file', path: 'p.mp3' };
            const result = output.validateTrigger(trigger, context);
            expect(result[0]).toContain('Unknown issues');
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

        it('should fallback to manual check if mimeType is missing', async () => {
            const result = await output.validateAsset('p.mp3', { format: 'mp3' });
            expect(result.valid).toBe(true);

            const result2 = await output.validateAsset('p.wav', { format: 'wav' });
            expect(result2.valid).toBe(true);

            const result3 = await output.validateAsset('p.ogg', { format: 'ogg' });
            expect(result3.valid).toBe(true);

            const result4 = await output.validateAsset('p.aac', { format: 'aac' });
            expect(result4.valid).toBe(true);

            const result5 = await output.validateAsset('p.unknown', { format: 'unknown' });
            expect(result5.valid).toBe(false);
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

        it('should reject unsupported mimeType', async () => {
            const result = await output.validateAsset('p.flac', { mimeType: 'audio/flac' });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Unsupported format');
        });
    });

    describe('healthCheck success', () => {
        it('should return healthy if API returns success', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: { token: 't' } } } } });
            axios.get.mockResolvedValue({ data: { success: true } });
            const result = await output.healthCheck();
            expect(result.healthy).toBe(true);
            expect(result.message).toBe('Online');
        });
    });

    describe('verifyCredentials success', () => {
        it('should return success if API returns success', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            const result = await output.verifyCredentials({ token: 't', device: 'd' });
            expect(result.success).toBe(true);
        });
    });

    describe('execute edge cases extra', () => {
        it('should return early if no source or url', async () => {
            await output.execute({}, {});
            await output.execute({ source: {} }, {});
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should use token from payload params', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com' } });
            axios.get.mockResolvedValue({ data: { success: true } });
            await output.execute({ source: { url: '/t.mp3' }, params: { token: 'p-token', device: 'p-device' } }, {});
            expect(axios.get).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
                params: expect.objectContaining({ token: 'p-token' })
            }));
        });
    });

    describe('healthCheck edge cases extra', () => {
        it('should handle missing error string in API failure', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: { token: 't' } } } } });
            axios.get.mockResolvedValue({ data: { success: false } });
            const result = await output.healthCheck();
            expect(result.message).toBe('API Failure');
        });
    });

    describe('verifyCredentials edge cases extra', () => {
        it('should handle missing error message in catch block', async () => {
            axios.get.mockRejectedValue(new Error(''));
            await expect(output.verifyCredentials({ token: 't', device: 'd' })).rejects.toThrow('Verification Failed');
        });
    });

    describe('validateTrigger edge cases extra', () => {
        it('should skip if compatibility is not explicitly false', () => {
            const context = {
                audioFiles: [{ path: 'p.mp3', compatibility: { voicemonkey: { valid: true } } }],
                niceName: 'Test',
                prayer: 'fajr',
                triggerType: 'adhan'
            };
            const trigger = { type: 'file', path: 'p.mp3' };
            const result = output.validateTrigger(trigger, context);
            expect(result).toHaveLength(0);
        });
    });

    describe('validateAsset manual fallback extra', () => {
        it('should handle missing format and codec', async () => {
            const result = await output.validateAsset('p.unknown', {});
            expect(result.valid).toBe(false);
        });

        it('should detect MP3 via codec', async () => {
            const result = await output.validateAsset('p.mp3', { codec: 'mp3' });
            expect(result.valid).toBe(true);
        });
    });

    describe('Queue failed handler', () => {
        it('should cover the listener', () => {
            // Re-require to get a fresh instance with fresh mock calls
            jest.resetModules();
            const Bottleneck = require('bottleneck');
            const VoiceMonkeyOutput = require('@outputs/VoiceMonkeyOutput');
            
            const mockQueueInstance = VoiceMonkeyOutput.queue;
            const failedListenerCall = mockQueueInstance.on.mock.calls.find(call => call[0] === 'failed');
            
            expect(failedListenerCall).toBeDefined();
            const failedListener = failedListenerCall[1];
            const spyWarn = jest.spyOn(console, 'warn').mockImplementation();
            failedListener(new Error('Queue Fail'), { options: { id: 'job1' } });
            expect(spyWarn).toHaveBeenCalledWith(expect.stringContaining('job1 failed: Queue Fail'));
            spyWarn.mockRestore();
        });
    });
});
