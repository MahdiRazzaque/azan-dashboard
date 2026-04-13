const BrowserOutput = require('../../../outputs/BrowserOutput');
const sseService = require('../../../services/system/sseService');

jest.mock('../../../services/system/sseService');
jest.mock('@utils/normalizeSource', () => {
    return jest.fn((source) => {
        if (source.type) return source;
        if (source.url && /^https?:\/\//i.test(source.url)) {
            return { type: 'url', url: source.url };
        }
        if (source.url) {
            return { type: 'file', filePath: `/absolute${source.url}`, url: source.url };
        }
        throw new Error('Invalid source');
    });
});

describe('BrowserOutput', () => {
    let output;

    beforeEach(() => {
        output = new BrowserOutput();
        jest.clearAllMocks();
    });

    describe('Metadata', () => {
        it('should return correct metadata', () => {
            const meta = BrowserOutput.getMetadata();
            expect(meta.id).toBe('browser');
            expect(meta.hidden).toBe(true);
            expect(meta.supportedSourceTypes).toEqual(['file', 'url']);
        });
    });

    describe('_executeFromFile', () => {
        it('should broadcast file source URL via SSE', async () => {
            const payload = {
                prayer: 'fajr',
                event: 'adhan',
                source: { type: 'file', filePath: '/audio/test.mp3', url: '/public/audio/test.mp3' }
            };

            await output.execute(payload, {});

            expect(sseService.broadcast).toHaveBeenCalledWith({
                type: 'AUDIO_PLAY',
                payload: {
                    prayer: 'fajr',
                    event: 'adhan',
                    url: '/public/audio/test.mp3'
                }
            });
        });
    });

    describe('_executeFromUrl', () => {
        it('should broadcast remote URL via SSE', async () => {
            const payload = {
                prayer: 'dhuhr',
                event: 'iqamah',
                source: { type: 'url', url: 'https://example.com/audio.mp3' }
            };

            await output.execute(payload, {});

            expect(sseService.broadcast).toHaveBeenCalledWith({
                type: 'AUDIO_PLAY',
                payload: {
                    prayer: 'dhuhr',
                    event: 'iqamah',
                    url: 'https://example.com/audio.mp3'
                }
            });
        });
    });

    describe('execute normalizes raw source', () => {
        it('should normalize and broadcast legacy source', async () => {
            const payload = {
                prayer: 'fajr',
                event: 'adhan',
                source: { url: '/public/audio.mp3' }
            };

            await output.execute(payload, {});

            expect(sseService.broadcast).toHaveBeenCalledWith({
                type: 'AUDIO_PLAY',
                payload: {
                    prayer: 'fajr',
                    event: 'adhan',
                    url: '/public/audio.mp3'
                }
            });
        });
    });

    describe('healthCheck', () => {
        it('should always return healthy', async () => {
            const result = await output.healthCheck();
            expect(result.healthy).toBe(true);
        });
    });

    describe('verifyCredentials', () => {
        it('should always return success', async () => {
            const result = await output.verifyCredentials();
            expect(result.success).toBe(true);
        });
    });

    describe('validateAsset', () => {
        it('should always return valid=true', async () => {
            const result = await output.validateAsset('test.mp3', {});
            expect(result.valid).toBe(true);
            expect(result.issues).toEqual([]);
            expect(result.lastChecked).toBeDefined();
        });
    });
});
