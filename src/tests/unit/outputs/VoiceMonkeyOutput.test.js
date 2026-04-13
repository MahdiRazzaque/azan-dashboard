const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ConfigService = require('@config');
const Bottleneck = require('bottleneck');

jest.mock('bottleneck', () => {
    const m = {
        schedule: jest.fn((fn) => fn()),
        on: jest.fn(),
        stop: jest.fn()
    };
    return jest.fn(() => m);
});

jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        access: jest.fn()
    },
    existsSync: jest.fn(),
    readFileSync: jest.fn()
}));

jest.mock('@utils/normalizeSource', () => {
    return jest.fn((source) => {
        if (source.type) return source;
        if (source.url && /^https?:\/\//.test(source.url)) {
            return { type: 'url', url: source.url };
        }
        return {
            type: 'file',
            filePath: source.filePath || `/resolved/public/audio/${source.path || 'test.mp3'}`,
            url: source.url || `/public/audio/${source.path || 'test.mp3'}`
        };
    });
});

describe('VoiceMonkeyOutput', () => {
    let VoiceMonkeyOutput;
    let output;

    const defaultConfig = {
        automation: {
            baseUrl: 'https://test.com',
            outputs: {
                voicemonkey: {
                    params: { token: 't1', device: 'd1' }
                }
            }
        }
    };

    beforeAll(() => {
        VoiceMonkeyOutput = require('@outputs/VoiceMonkeyOutput');
    });

    beforeEach(() => {
        jest.clearAllMocks();
        output = new VoiceMonkeyOutput();
        ConfigService.get.mockReturnValue(defaultConfig);
    });

    describe('getMetadata', () => {
        it('should return correct metadata with supportedSourceTypes', () => {
            const meta = VoiceMonkeyOutput.getMetadata();
            expect(meta.id).toBe('voicemonkey');
            expect(meta.label).toBe('VoiceMonkey (Alexa)');
            expect(meta.supportedSourceTypes).toEqual(['file', 'url']);
            expect(meta.hidden).toBe(false);
        });
    });

    describe('_executeFromFile', () => {
        const filePath = path.resolve(__dirname, '../../../../public/audio/custom/test.mp3');
        const filePayload = {
            source: { type: 'file', filePath, url: '/public/audio/custom/test.mp3' },
            params: { token: 't1', device: 'd1' }
        };

        beforeEach(() => {
            fs.promises.access.mockRejectedValue(new Error('ENOENT'));
        });

        it('should send file source to API with constructed public URL', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            await output._executeFromFile(filePayload, {});
            expect(axios.get).toHaveBeenCalledWith(
                'https://api-v2.voicemonkey.io/announcement',
                expect.objectContaining({
                    params: expect.objectContaining({
                        audio: 'https://test.com/public/audio/custom/test.mp3',
                        token: 't1',
                        device: 'd1'
                    })
                })
            );
        });

        it('should skip if baseUrl is not HTTPS for relative URL', async () => {
            ConfigService.get.mockReturnValue({
                automation: { baseUrl: 'http://insecure.com', outputs: { voicemonkey: { params: { token: 't', device: 'd' } } } }
            });
            await output._executeFromFile(filePayload, {});
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should skip if token or device missing', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com' } });
            const payloadNoParams = {
                source: { type: 'file', filePath, url: '/public/audio/custom/test.mp3' }
            };
            await output._executeFromFile(payloadNoParams, {});
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should use test prefix when isTest is true', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            const spy = jest.spyOn(console, 'log').mockImplementation();
            await output._executeFromFile(filePayload, { isTest: true });
            expect(spy).toHaveBeenCalledWith(expect.stringContaining('[Test Output: VoiceMonkey]'));
            spy.mockRestore();
        });
    });

    describe('_executeFromUrl', () => {
        it('should send HTTPS URL directly to API', async () => {
            const payload = {
                source: { type: 'url', url: 'https://cdn.example.com/audio.mp3' },
                params: { token: 't1', device: 'd1' }
            };
            axios.get.mockResolvedValue({ data: { success: true } });
            await output._executeFromUrl(payload, {});
            expect(axios.get).toHaveBeenCalledWith(
                'https://api-v2.voicemonkey.io/announcement',
                expect.objectContaining({
                    params: expect.objectContaining({ audio: 'https://cdn.example.com/audio.mp3' })
                })
            );
        });

        it('should throw if URL is not HTTPS', async () => {
            const payload = {
                source: { type: 'url', url: 'http://cdn.example.com/audio.mp3' },
                params: { token: 't1', device: 'd1' }
            };
            await expect(output._executeFromUrl(payload, {})).rejects.toThrow('Alexa requires HTTPS audio URLs');
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should include error message when URL is not HTTPS', async () => {
            const payload = {
                source: { type: 'url', url: 'http://cdn.example.com/audio.mp3' },
                params: { token: 't1', device: 'd1' }
            };
            await expect(output._executeFromUrl(payload, {})).rejects.toThrow('Alexa requires HTTPS audio URLs');
        });
    });

    describe('execute (integration via BaseOutput template method)', () => {
        it('should dispatch file source to _executeFromFile', async () => {
            fs.promises.access.mockResolvedValue(undefined);
            axios.get.mockResolvedValue({ data: { success: true } });
            await output.execute(
                { source: { path: 'custom/test.mp3' }, params: { token: 't1', device: 'd1' } },
                {}
            );
            expect(axios.get).toHaveBeenCalled();
        });

        it('should dispatch URL source to _executeFromUrl', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            await output.execute(
                { source: { url: 'https://cdn.example.com/audio.mp3' }, params: { token: 't1', device: 'd1' } },
                {}
            );
            expect(axios.get).toHaveBeenCalledWith(
                'https://api-v2.voicemonkey.io/announcement',
                expect.objectContaining({
                    params: expect.objectContaining({ audio: 'https://cdn.example.com/audio.mp3' })
                })
            );
        });
    });

    describe('_sendToApi', () => {
        it('should use token from payload params over config', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'https://ok.com' } });
            axios.get.mockResolvedValue({ data: { success: true } });
            await output._sendToApi('https://test.com/audio.mp3', { params: { token: 'p-token', device: 'p-device' } }, '[Test]');
            expect(axios.get).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ params: expect.objectContaining({ token: 'p-token', device: 'p-device' }) })
            );
        });

        it('should handle abort error without throwing', async () => {
            const err = new Error('Aborted');
            err.name = 'AbortError';
            axios.get.mockRejectedValue(err);
            await output._sendToApi('https://test.com/audio.mp3', { params: { token: 't', device: 'd' } }, '[Test]');
        });

        it('should handle CanceledError without throwing', async () => {
            const err = new Error('Canceled');
            err.name = 'CanceledError';
            axios.get.mockRejectedValue(err);
            await output._sendToApi('https://test.com/audio.mp3', { params: { token: 't', device: 'd' } }, '[Test]');
        });

        it('should throw on non-abort errors', async () => {
            axios.get.mockRejectedValue(new Error('Network Error'));
            await expect(
                output._sendToApi('https://test.com/audio.mp3', { params: { token: 't', device: 'd' } }, '[Test]')
            ).rejects.toThrow('Network Error');
        });

        it('should pass abort signal to axios', async () => {
            const controller = new AbortController();
            axios.get.mockResolvedValue({ data: { success: true } });
            await output._sendToApi('https://test.com/audio.mp3', { params: { token: 't', device: 'd' } }, '[Test]', controller.signal);
            expect(axios.get).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ signal: controller.signal })
            );
        });
    });

    describe('healthCheck', () => {
        it('should return healthy if API returns success', async () => {
            ConfigService.get.mockReturnValue({
                automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: { token: 't' } } } }
            });
            axios.get.mockResolvedValue({ data: { success: true } });
            const result = await output.healthCheck();
            expect(result.healthy).toBe(true);
            expect(result.message).toBe('Online');
        });

        it('should return offline if baseUrl is not HTTPS', async () => {
            ConfigService.get.mockReturnValue({ automation: { baseUrl: 'http://insecure.com' } });
            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toContain('HTTPS Base URL required');
        });

        it('should return offline if token is missing', async () => {
            ConfigService.get.mockReturnValue({
                automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: {} } } }
            });
            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toContain('Token Missing');
        });

        it('should handle API failure response', async () => {
            ConfigService.get.mockReturnValue({
                automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: { token: 't' } } } }
            });
            axios.get.mockResolvedValue({ data: { success: false, error: 'Some API Error' } });
            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toBe('Some API Error');
        });

        it('should handle missing error string in API failure', async () => {
            ConfigService.get.mockReturnValue({
                automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: { token: 't' } } } }
            });
            axios.get.mockResolvedValue({ data: { success: false } });
            const result = await output.healthCheck();
            expect(result.message).toBe('API Failure');
        });

        it('should handle network error', async () => {
            ConfigService.get.mockReturnValue({
                automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: { token: 't' } } } }
            });
            axios.get.mockRejectedValue(new Error('Network Error'));
            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toBe('Network Error');
        });

        it('should use requestedParams token over config', async () => {
            ConfigService.get.mockReturnValue({
                automation: { baseUrl: 'https://ok.com', outputs: { voicemonkey: { params: {} } } }
            });
            axios.get.mockResolvedValue({ data: { success: true } });
            const result = await output.healthCheck({ token: 'override-token' });
            expect(result.healthy).toBe(true);
            expect(axios.get).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({ params: expect.objectContaining({ token: 'override-token' }) })
            );
        });
    });

    describe('verifyCredentials', () => {
        it('should return success if API returns success', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            const result = await output.verifyCredentials({ token: 't', device: 'd' });
            expect(result.success).toBe(true);
        });

        it('should throw if token or device missing', async () => {
            await expect(output.verifyCredentials({})).rejects.toThrow('Missing token or device');
        });

        it('should handle API failure response', async () => {
            axios.get.mockResolvedValue({ data: { success: false, error: 'Invalid Token' } });
            await expect(output.verifyCredentials({ token: 't', device: 'd' })).rejects.toThrow('Invalid Token');
        });

        it('should handle API failure without error message', async () => {
            axios.get.mockResolvedValue({ data: { success: false } });
            await expect(output.verifyCredentials({ token: 't', device: 'd' })).rejects.toThrow('Verification Failed');
        });

        it('should handle missing error message in catch block', async () => {
            axios.get.mockRejectedValue(new Error(''));
            await expect(output.verifyCredentials({ token: 't', device: 'd' })).rejects.toThrow('Verification Failed');
        });
    });

    describe('validateTrigger', () => {
        const baseContext = {
            audioFiles: [],
            niceName: 'Test',
            prayer: 'fajr',
            triggerType: 'adhan'
        };

        it('should return no warnings if file not found', () => {
            const context = { ...baseContext, audioFiles: [{ path: 'other.mp3' }] };
            const result = output.validateTrigger({ type: 'file', path: 'missing.mp3' }, context);
            expect(result).toHaveLength(0);
        });

        it('should return warning if incompatible', () => {
            const context = {
                ...baseContext,
                audioFiles: [{ path: 'p.mp3', compatibility: { voicemonkey: { valid: false, issues: ['Too long'] } } }]
            };
            const result = output.validateTrigger({ type: 'file', path: 'p.mp3' }, context);
            expect(result[0]).toContain('Audio incompatible with Alexa (Too long)');
        });

        it('should handle missing issues array', () => {
            const context = {
                ...baseContext,
                audioFiles: [{ path: 'p.mp3', compatibility: { voicemonkey: { valid: false } } }]
            };
            const result = output.validateTrigger({ type: 'file', path: 'p.mp3' }, context);
            expect(result[0]).toContain('Unknown issues');
        });

        it('should skip if compatibility is not explicitly false', () => {
            const context = {
                ...baseContext,
                audioFiles: [{ path: 'p.mp3', compatibility: { voicemonkey: { valid: true } } }]
            };
            const result = output.validateTrigger({ type: 'file', path: 'p.mp3' }, context);
            expect(result).toHaveLength(0);
        });

        it('should match TTS file by convention name', () => {
            const context = {
                ...baseContext,
                audioFiles: [{ name: 'tts_fajr_adhan.mp3', compatibility: { voicemonkey: { valid: false, issues: ['Bad format'] } } }]
            };
            const result = output.validateTrigger({ type: 'tts' }, context);
            expect(result[0]).toContain('Bad format');
        });
    });

    describe('validateAsset', () => {
        it('should accept valid MP3', async () => {
            const result = await output.validateAsset('p.mp3', {
                mimeType: 'audio/mpeg', bitrate: 128000, duration: 30
            });
            expect(result.valid).toBe(true);
            expect(result.issues).toHaveLength(0);
        });

        it('should fallback to manual check if mimeType is missing', async () => {
            expect((await output.validateAsset('p.mp3', { format: 'mp3' })).valid).toBe(true);
            expect((await output.validateAsset('p.wav', { format: 'wav' })).valid).toBe(true);
            expect((await output.validateAsset('p.ogg', { format: 'ogg' })).valid).toBe(true);
            expect((await output.validateAsset('p.aac', { format: 'aac' })).valid).toBe(true);
            expect((await output.validateAsset('p.x', { format: 'unknown' })).valid).toBe(false);
        });

        it('should detect MP3 via codec', async () => {
            const result = await output.validateAsset('p.mp3', { codec: 'mp3' });
            expect(result.valid).toBe(true);
        });

        it('should reject high bitrate', async () => {
            const result = await output.validateAsset('p.mp3', { mimeType: 'audio/mpeg', bitrate: 2000000 });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Bitrate too high');
        });

        it('should reject high sample rate', async () => {
            const result = await output.validateAsset('p.mp3', { mimeType: 'audio/mpeg', sampleRate: 48001 });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Sample rate too high');
        });

        it('should reject large file size', async () => {
            const result = await output.validateAsset('p.mp3', { mimeType: 'audio/mpeg', size: 11 * 1024 * 1024 });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('File size too large');
        });

        it('should reject long duration', async () => {
            const result = await output.validateAsset('p.mp3', { mimeType: 'audio/mpeg', duration: 241 });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Duration too long');
        });

        it('should reject unsupported mimeType', async () => {
            const result = await output.validateAsset('p.flac', { mimeType: 'audio/flac' });
            expect(result.valid).toBe(false);
            expect(result.issues[0]).toContain('Unsupported format');
        });

        it('should handle missing format and codec', async () => {
            const result = await output.validateAsset('p.x', {});
            expect(result.valid).toBe(false);
        });
    });

    describe('Queue failed handler', () => {
        it('should cover the listener', () => {
            jest.resetModules();
            require('bottleneck');
            const VM = require('@outputs/VoiceMonkeyOutput');
            const mockQueueInstance = VM.queue;
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
