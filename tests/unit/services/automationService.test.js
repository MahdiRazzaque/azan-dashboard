const getPlaySoundMock = () => {
    const playMock = jest.fn((file, opts, cb) => {
        if (cb) cb(null);
        return { kill: jest.fn() };
    });
    return jest.fn(() => ({ play: playMock }));
};
// We need to mock play-sound module function that returns the player instance
jest.mock('play-sound', () => getPlaySoundMock());

const axios = require('axios');
const service = require('@services/core/automationService');
const configService = require('@config');
const sseService = require('@services/system/sseService');

jest.mock('axios');
jest.mock('@config');
jest.mock('@services/system/sseService');
jest.mock('@utils/requestQueue', () => ({
    voiceMonkeyQueue: { schedule: (fn) => fn() }
}));

describe('AutomationService', () => {
    const mockConfig = {
        automation: {
            audioPlayer: 'mpg123',
            voiceMonkey: { enabled: false },
            triggers: {
                fajr: {
                    preAdhan: { enabled: true, type: 'tts', template: '...', targets: ['local', 'browser'], path: 'test.mp3' }
                }
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        configService.get.mockReturnValue(mockConfig);
    });

    it('should trigger local playback', async () => {
         await service.triggerEvent('fajr', 'preAdhan');
         
         const playerInstance = require('play-sound')(); 
         expect(playerInstance.play).toHaveBeenCalled();
         expect(playerInstance.play).toHaveBeenCalledWith(
             expect.stringContaining('mp3'), 
             expect.objectContaining({ player: 'mpg123' }),
             expect.any(Function)
         );
    });

    it('should trigger browser broadcast', async () => {
        await service.triggerEvent('fajr', 'preAdhan');
        
        expect(sseService.broadcast).toHaveBeenCalledWith(expect.objectContaining({
            type: 'AUDIO_PLAY',
            payload: expect.objectContaining({ prayer: 'fajr', event: 'preAdhan' })
        }));
    });

    it('should disable trigger if disabled in config', async () => {
        const disabledConfig = JSON.parse(JSON.stringify(mockConfig));
        disabledConfig.automation.triggers.fajr.preAdhan.enabled = false;
        configService.get.mockReturnValue(disabledConfig);

        await service.triggerEvent('fajr', 'preAdhan');
        
        const playerInstance = require('play-sound')(); 
        expect(playerInstance.play).not.toHaveBeenCalled();
    });

    it('should handle local playback directly', () => {
        const source = { filePath: 'test.mp3', url: '/test.mp3' };
        service.handleLocal({}, 'test', 'event', source);
        const playerInstance = require('play-sound')(); 
        expect(playerInstance.play).toHaveBeenCalledWith('test.mp3', expect.objectContaining({ player: 'mpg123' }), expect.any(Function));
    });

    describe('Audio Source Types', () => {
        const path = require('path');
        it('should handle type "file"', async () => {
             const fileConfig = JSON.parse(JSON.stringify(mockConfig));
             fileConfig.automation.triggers.fajr.preAdhan.type = 'file';
             fileConfig.automation.triggers.fajr.preAdhan.path = 'adhans/makkah.mp3';
             configService.get.mockReturnValue(fileConfig);
             
             await service.triggerEvent('fajr', 'preAdhan');
             
             const playerInstance = require('play-sound')();
             expect(playerInstance.play).toHaveBeenCalledWith(
                 expect.stringContaining('adhans'),
                 expect.anything(),
                 expect.anything()
             );
        });
        
        it('should handle type "url"', async () => {
             const urlConfig = JSON.parse(JSON.stringify(mockConfig));
             urlConfig.automation.triggers.fajr.preAdhan.type = 'url';
             urlConfig.automation.triggers.fajr.preAdhan.url = 'http://example.com/audio.mp3';
             configService.get.mockReturnValue(urlConfig);
             
             await service.triggerEvent('fajr', 'preAdhan');
             
             expect(sseService.broadcast).toHaveBeenCalledWith(expect.objectContaining({
                 payload: expect.objectContaining({ url: 'http://example.com/audio.mp3' })
             }));
        });
    });

    describe('Edge Cases', () => {
        beforeEach(() => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.spyOn(console, 'warn').mockImplementation(() => {});
        });

        it('should handle VoiceMonkey trigger', async () => {
            const vmConfig = JSON.parse(JSON.stringify(mockConfig));
            vmConfig.automation.voiceMonkey = { enabled: true, token: 'token', device: 'device' };
            vmConfig.automation.triggers.fajr.preAdhan.targets = ['voiceMonkey'];
            configService.get.mockReturnValue(vmConfig);
            
            axios.get.mockResolvedValue({ data: {} });

            await service.triggerEvent('fajr', 'preAdhan');

            expect(axios.get).toHaveBeenCalledWith(
                 expect.stringContaining('announcement'),
                 expect.objectContaining({
                     params: expect.objectContaining({ token: 'token', device: 'device' })
                 })
            );
        });

        it('should handle VoiceMonkey errors', async () => {
            const vmConfig = JSON.parse(JSON.stringify(mockConfig));
            vmConfig.automation.voiceMonkey = { enabled: true, token: 'tok', device: 'dev' };
            vmConfig.automation.triggers.fajr.preAdhan.targets = ['voiceMonkey'];
            configService.get.mockReturnValue(vmConfig);
            
            axios.get.mockRejectedValue(new Error('API fail'));
            
            await service.triggerEvent('fajr', 'preAdhan');
            
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Request failed'), expect.any(String));
        });

        it('should handle VoiceMonkey missing tokens', async () => {
            const vmConfig = JSON.parse(JSON.stringify(mockConfig));
            vmConfig.automation.voiceMonkey = { enabled: true }; 
            vmConfig.automation.triggers.fajr.preAdhan.targets = ['voiceMonkey'];
            configService.get.mockReturnValue(vmConfig);
            
            await service.triggerEvent('fajr', 'preAdhan');
            
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Missing credentials'));
            expect(axios.get).not.toHaveBeenCalled();
        });

        it('should use default audio player if not configured', () => {
             const configWithoutPlayer = JSON.parse(JSON.stringify(mockConfig));
             delete configWithoutPlayer.automation.audioPlayer;
             configService.get.mockReturnValue(configWithoutPlayer);
             
             const playerInstance = require('play-sound')();
             service.handleLocal({}, 'fajr', 'adhan', { filePath: 'f.mp3' });
             expect(playerInstance.play).toHaveBeenCalledWith('f.mp3', { player: 'mpg123' }, expect.any(Function));
        });

        it('should handle local playback errors', async () => {
             const playerInstance = require('play-sound')();
             playerInstance.play.mockImplementationOnce((file, opts, cb) => {
                 cb(new Error('Play fail'));
                 return { kill: jest.fn() };
             });
             
             await service.triggerEvent('fajr', 'preAdhan');
             
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Playback error'), expect.any(Error));
        });

        it('should return nulls if audio type is unknown', () => {
             const source = service.getAudioSource({ type: 'unknown' }, 'fajr', 'adhan');
             expect(source.filePath).toBeNull();
             expect(source.url).toBeNull();
        });

        it('should return early in handlers if source is missing', async () => {
             const source = { filePath: null, url: null };
             service.handleLocal({}, 'fajr', 'adhan', source);
             service.broadcastToClients({}, 'fajr', 'adhan', source);
             await service.handleVoiceMonkey({}, 'fajr', 'adhan', source);
             
             const playerInstance = require('play-sound')();
             expect(playerInstance.play).not.toHaveBeenCalled();
             expect(sseService.broadcast).not.toHaveBeenCalled();
             expect(axios.get).not.toHaveBeenCalled();
        });

        it('should handle absolute URLs in VoiceMonkey', async () => {
            const vmConfig = {
                automation: {
                    voiceMonkey: { token: 't', device: 'd' }
                }
            };
            configService.get.mockReturnValue(vmConfig);
            const source = { url: 'http://recorded-adhan.com/adhan.mp3' };
            
            await service.handleVoiceMonkey({}, 'fajr', 'adhan', source);
            
            expect(axios.get).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    params: expect.objectContaining({ audio: 'http://recorded-adhan.com/adhan.mp3' })
                })
            );
        });

        it('should catch errors in triggerEvent', async () => {
             sseService.broadcast
                .mockImplementationOnce(() => {}) // First call (LOG)
                .mockImplementationOnce(() => { throw new Error('Broadcast Error'); }); // Second call (AUDIO_PLAY)
            
            await service.triggerEvent('fajr', 'preAdhan');
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error executing triggers'), expect.any(Error));
        });

        it('should handle unknown targets gracefully', async () => {
            const config = JSON.parse(JSON.stringify(mockConfig));
            config.automation.triggers.fajr.preAdhan.targets = ['unknown-target'];
            configService.get.mockReturnValue(config);
            
            await service.triggerEvent('fajr', 'preAdhan');
            // Simply ensures no crash and covers the map branches
        });
    });

    describe('verifyCredentials', () => {
        it('should return true for valid credentials (success)', async () => {
             axios.get.mockResolvedValue({ 
                status: 200, 
                data: { success: true } 
            });
            const result = await service.verifyCredentials('token', 'device');
            expect(result).toBe(true);
            expect(axios.get).toHaveBeenCalledWith(
                'https://api-v2.voicemonkey.io/announcement',
                expect.objectContaining({
                    params: expect.objectContaining({ token: 'token', device: 'device' })
                })
            );
        });

        it('should throw for authentication failure (401)', async () => {
             axios.get.mockRejectedValue({
                 response: {
                     status: 401,
                     data: { error: 'Authentication failed' }
                 }
             });
             
             await expect(service.verifyCredentials('token', 'device'))
                 .rejects.toThrow('Invalid Voice Monkey credentials');
        });

        it('should throw for 400 status (often used for bad args/auth)', async () => {
             axios.get.mockRejectedValue({
                 response: {
                     status: 400,
                     data: { error: 'Invalid token' }
                 }
             });
             await expect(service.verifyCredentials('token', 'device'))
                 .rejects.toThrow('Invalid Voice Monkey credentials');
        });

        it('should throw generic error for response status 500', async () => {
             const error = new Error('Server Crash');
             error.response = { status: 500, data: { error: 'Broken' } };
             axios.get.mockRejectedValue(error);
             
             await expect(service.verifyCredentials('token', 'device'))
                 .rejects.toThrow('Server Crash');
        });

        it('should throw error if API returns success=false', async () => {
             axios.get.mockResolvedValue({ 
                 status: 200, 
                 data: { success: false, error: 'Custom API Error' } 
             });
             await expect(service.verifyCredentials('token', 'device'))
                 .rejects.toThrow('Custom API Error');
        });

        it('should throw default error if API returns success=false without msg', async () => {
             axios.get.mockResolvedValue({ 
                 status: 200, 
                 data: { success: false } 
             });
             await expect(service.verifyCredentials('token', 'device'))
                 .rejects.toThrow('VoiceMonkey API verification failed');
        });

        it('should re-throw generic error if error has no response', async () => {
            axios.get.mockRejectedValue(new Error('No Response Error'));
            await expect(service.verifyCredentials('token', 'device'))
                .rejects.toThrow('No Response Error');
        });

        it('should throw if tokens missing', async () => {
             await expect(service.verifyCredentials(null, 'device'))
                 .rejects.toThrow('Missing API Token');
        });
    });
});
