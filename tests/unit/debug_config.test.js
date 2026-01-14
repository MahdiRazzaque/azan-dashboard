const fsPromises = require('fs/promises');
const path = require('path');
const fsReal = require('fs'); // Real fs for logging
const { ConfigService, ConfigNotInitializedError } = require('../../src/config/ConfigService');

jest.mock('fs/promises');

function logError(msg) {
    fsReal.appendFileSync('debug_error.log', msg + '\n');
}

describe('ConfigService Debug', () => {
    let configService;
    const mockPrayer = { iqamahOffset: 10, roundTo: 10, fixedTime: null, iqamahOverride: false };
    const mockTriggers = { 
        fajr: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } },
        dhuhr: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } },
        asr: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } },
        maghrib: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } },
        isha: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } }
    };

    const mockDefaultConfig = JSON.stringify({
        location: { timezone: 'Europe/London', coordinates: { lat: 1, long: 1 } },
        calculation: { method: 'TEST', madhab: 'TEST' },
        prayers: { 
            fajr: mockPrayer, dhuhr: mockPrayer, asr: mockPrayer, maghrib: mockPrayer, isha: mockPrayer 
        },
        sources: { primary: { type: 'test' } },
        automation: { 
            enabled: true, 
            global: {}, 
            voiceMonkey: { enabled: false },
            baseUrl: 'http://test',
            audioPlayer: 'mpg123',
            pythonServiceUrl: 'http://test',
            triggers: mockTriggers 
        },
        data: { staleCheckDays: 7 }
    });

    test('update() should strip secrets before writing', async () => {
        try {
            // Mock Env
            process.env.VOICEMONKEY_access_token = 'SECRET_ENV';
            
            // Re-init for this test since beforeEach was removed
            configService = new ConfigService();
            fsPromises.readFile.mockResolvedValue(mockDefaultConfig);
            fsPromises.access.mockRejectedValue({ code: 'ENOENT' });

            const updates = { 
                automation: { 
                    voiceMonkey: { accessToken: 'USER_TOKEN' }
                } 
            };

            await configService.init();
            
            if (!process.env.VOICEMONKEY_access_token) logError('Process Env missing token!');
            else logError('Process Env token present: ' + process.env.VOICEMONKEY_access_token);

            await configService.update(updates);
            
            expect(fsPromises.writeFile).toHaveBeenCalled();
            const callArgs = fsPromises.writeFile.mock.calls[0];
            const writtenContent = JSON.parse(callArgs[1]);
            
            if (writtenContent.automation && writtenContent.automation.voiceMonkey && writtenContent.automation.voiceMonkey.accessToken) {
                logError('AccessToken was NOT stripped! Value: ' + writtenContent.automation.voiceMonkey.accessToken);
                throw new Error('AccessToken not stripped');
            }
            logError('AccessToken successfully stripped or missing.');

        } catch (e) {
            logError('Test Failed: ' + e.message + '\n' + e.stack);
            throw e;
        }
    });
});
