const automationService = require('../../src/services/automationService');
const sseService = require('../../src/services/sseService');
const axios = require('axios');
const path = require('path');
const playerFactory = require('play-sound');

// Mocks
jest.mock('axios');
jest.mock('../../src/services/sseService', () => ({
    broadcast: jest.fn()
}));

jest.mock('play-sound', () => {
    const mPlay = jest.fn();
    const fn = () => ({ play: mPlay });
    fn.mockPlay = mPlay;
    return fn;
});

jest.mock('../../src/config', () => ({
    automation: {
        baseUrl: 'http://my-dashboard.local',
        audioPlayer: 'mpg123',
        voiceMonkey: { accessToken: 'token', secretToken: 'secret' },
        triggers: {
            fajr: {
                preAdhan: {
                    enabled: true,
                    type: 'tts',
                    targets: ['local', 'browser', 'voiceMonkey']
                },
                adhan: {
                    enabled: true,
                    type: 'file',
                    path: 'custom/adhan.mp3',
                    targets: ['local']
                }
            }
        }
    }
}));

describe('Automation Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        playerFactory.mockPlay.mockClear();
    });

    test('should trigger all targets for TTS event', async () => {
        await automationService.triggerEvent('fajr', 'preAdhan');

        // Check Local (TTS file path)
        expect(playerFactory.mockPlay).toHaveBeenCalledWith(
            expect.stringContaining('tts_fajr_preAdhan.mp3'),
            { player: 'mpg123' },
            expect.any(Function)
        );

        // Check Browser (SSE)
        expect(sseService.broadcast).toHaveBeenCalledWith(expect.objectContaining({
            type: 'AUDIO_PLAY',
            payload: {
                prayer: 'fajr',
                event: 'preAdhan',
                url: '/audio/cache/tts_fajr_preAdhan.mp3'
            }
        }));

        // Check VoiceMonkey (Axios)
        const expectedPublicUrl = 'http://my-dashboard.local/audio/cache/tts_fajr_preAdhan.mp3';
        expect(axios.get).toHaveBeenCalledWith('https://api.voicemonkey.io/trigger', expect.objectContaining({
            params: expect.objectContaining({
                audio: expectedPublicUrl,
                access_token: 'token'
            })
        }));
    });

    test('should handle file type correctly', async () => {
        await automationService.triggerEvent('fajr', 'adhan');
        
         // Check Local (Custom file path)
         expect(playerFactory.mockPlay).toHaveBeenCalledWith(
            expect.stringContaining('custom' + path.sep + 'adhan.mp3'), // Check path
            expect.anything(),
            expect.anything()
        );
    });
});
