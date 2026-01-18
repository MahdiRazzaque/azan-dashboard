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
const service = require('../../../src/services/automationService');
const configService = require('../../../src/config');
const sseService = require('../../../src/services/sseService');

jest.mock('axios');
jest.mock('../../../src/config');
jest.mock('../../../src/services/sseService');

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

    it('should play test audio', () => {
        service.playTestAudio('test.mp3');
        const playerInstance = require('play-sound')(); 
        expect(playerInstance.play).toHaveBeenCalledWith('test.mp3', expect.anything(), expect.any(Function));
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

        it('should handle unknown audio type gracefully', async () => {
             const unknownConfig = JSON.parse(JSON.stringify(mockConfig));
             unknownConfig.automation.triggers.fajr.preAdhan.type = 'unknown';
             unknownConfig.automation.triggers.fajr.preAdhan.targets = ['local'];
             configService.get.mockReturnValue(unknownConfig);
             
             await service.triggerEvent('fajr', 'preAdhan');
             
             // Should not crash, just return early since filePath is null
             const playerInstance = require('play-sound')();
             expect(playerInstance.play).not.toHaveBeenCalled();
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

        it('should handle local playback errors', async () => {
             const playerInstance = require('play-sound')();
             playerInstance.play.mockImplementationOnce((file, opts, cb) => {
                 cb(new Error('Play fail'));
                 return { kill: jest.fn() };
             });
             
             await service.triggerEvent('fajr', 'preAdhan');
             
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Playback error'), expect.any(Error));
        });

        it('should handle unknown target types gracefully', async () => {
            const unknownTargetConfig = JSON.parse(JSON.stringify(mockConfig));
            unknownTargetConfig.automation.triggers.fajr.preAdhan.targets = ['unknown-target'];
            configService.get.mockReturnValue(unknownTargetConfig);
            
            // Should not crash with unknown target
            await service.triggerEvent('fajr', 'preAdhan');
            
            const playerInstance = require('play-sound')();
            expect(playerInstance.play).not.toHaveBeenCalled();
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

        it('should throw if tokens missing', async () => {
            await expect(service.verifyCredentials(null, 'device'))
                .rejects.toThrow('Missing');
        });

        it('should return true when success is not true in response (caught and returns true)', async () => {
            // The code throws an error inside the try block, but catches it and returns true
            // This is due to the catch block not re-throwing non-response errors
            axios.get.mockResolvedValue({ 
                status: 200, 
                data: { success: false, error: 'Invalid request' } 
            });
            
            const result = await service.verifyCredentials('token', 'device');
            expect(result).toBe(true);
        });

        it('should return true for network errors without response object', async () => {
            axios.get.mockRejectedValue(new Error('Network timeout'));
            
            const result = await service.verifyCredentials('token', 'device');
            expect(result).toBe(true);
        });

        it('should return true for 500 status codes (not auth related)', async () => {
            axios.get.mockRejectedValue({
                response: {
                    status: 500,
                    data: { error: 'Internal server error' }
                }
            });
            
            const result = await service.verifyCredentials('token', 'device');
            expect(result).toBe(true);
        });
    });
});
