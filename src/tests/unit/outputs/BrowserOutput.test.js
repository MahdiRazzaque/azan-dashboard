const BrowserOutput = require('../../../outputs/BrowserOutput');
const sseService = require('../../../services/system/sseService');

jest.mock('../../../services/system/sseService');

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
        });
    });

    describe('execute', () => {
        it('should broadcast AUDIO_PLAY event', async () => {
            const payload = {
                prayer: 'fajr',
                event: 'adhan',
                source: { url: '/public/audio.mp3' }
            };

            await output.execute(payload);

            expect(sseService.broadcast).toHaveBeenCalledWith({
                type: 'AUDIO_PLAY',
                payload: {
                    prayer: 'fajr',
                    event: 'adhan',
                    url: '/public/audio.mp3'
                }
            });
        });

        it('should do nothing if source url is missing', async () => {
             const payload = { source: {} };
             await output.execute(payload);
             expect(sseService.broadcast).not.toHaveBeenCalled();
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
});


