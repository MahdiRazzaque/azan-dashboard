const settingsController = require('@controllers/settingsController');
const configService = require('@config');
const sseService = require('@services/system/sseService');
const audioAssetService = require('@services/system/audioAssetService');
const schedulerService = require('@services/core/schedulerService');
const healthCheck = require('@services/system/healthCheck');
const envManager = require('@utils/envManager');
const systemControllerHelper = require('@controllers/systemController');
const fs = require('fs');
const path = require('path');

jest.mock('@config');
jest.mock('@services/system/sseService');
jest.mock('@services/system/audioAssetService');
jest.mock('@services/core/schedulerService', () => ({
    initScheduler: jest.fn(),
    stopAll: jest.fn()
}));
jest.mock('@services/system/healthCheck');
jest.mock('@utils/envManager');
jest.mock('@controllers/systemController');
jest.mock('fs');
jest.mock('@utils/audioValidator');
jest.mock('@services/core/prayerTimeService', () => ({
    forceRefresh: jest.fn()
}));
jest.mock('@services/core/validationService', () => ({
    validateConfigSource: jest.fn(),
    validateConfig: jest.fn()
}));

const { forceRefresh } = require('@services/core/prayerTimeService');
const { validateConfigSource, validateConfig } = require('@services/core/validationService');
const audioValidator = require('@utils/audioValidator');

describe('settingsController Unit Tests', () => {
    let req, res;

    beforeEach(() => {
        req = { body: {} };
        res = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
        validateConfig.mockReturnValue({ value: {} });
        validateConfigSource.mockResolvedValue();
        audioAssetService.syncAudioAssets.mockResolvedValue();
        audioValidator.analyseAudioFile.mockResolvedValue({ duration: 10 });
        audioValidator.validateVoiceMonkeyCompatibility.mockReturnValue({ vmCompatible: true });
        systemControllerHelper._getAudioFilesWithMetadata.mockResolvedValue([]);
        
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('getSettings', () => {
        it('should reload and return settings', async () => {
            const mockConfig = { key: 'value' };
            configService.get.mockReturnValue(mockConfig);
            await settingsController.getSettings(req, res);
            expect(configService.reload).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(mockConfig);
        });
    });

    describe('getPublicSettings', () => {
        it('should reload and return sanitised settings for public access', async () => {
            const mockConfig = {
                location: { city: 'London' },
                calculation: { method: 'ISNA' },
                prayers: { fajr: {} },
                automation: {
                    voiceMonkey: {
                        enabled: true,
                        token: 'secret-token',
                        device: 'secret-device'
                    }
                }
            };
            configService.get.mockReturnValue(mockConfig);
            
            await settingsController.getPublicSettings(req, res);
            
            expect(configService.reload).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                location: mockConfig.location,
                calculation: mockConfig.calculation,
                prayers: mockConfig.prayers,
                automation: {
                    voiceMonkey: {
                        enabled: true
                    }
                }
            });
        });

        it('should handle missing voiceMonkey config in public settings', async () => {
            const mockConfig = {
                location: { city: 'London' },
                automation: {}
            };
            configService.get.mockReturnValue(mockConfig);
            
            await settingsController.getPublicSettings(req, res);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                automation: {}
            }));
        });
    });

    describe('updateSettings Edge Cases', () => {
        it('should handle non-MasjidID validation errors', async () => {
            validateConfigSource.mockRejectedValue(new Error('Other Error'));
            req.body = { data: {} };
            await settingsController.updateSettings(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Validation Failed: Other Error' });
        });

        it('should generate voiceMonkey warnings if type is voiceMonkey', async () => {
            const newConfig = {
                automation: {
                    triggers: {
                        fajr: { adhan: { enabled: true, type: 'voiceMonkey' } }
                    }
                }
            };
            req.body = newConfig;
            healthCheck.getHealth.mockReturnValue({ voiceMonkey: { healthy: false, message: 'Offline' } });
            
            configService.get.mockReturnValue({});
            forceRefresh.mockResolvedValue({});
            
            await settingsController.updateSettings(req, res);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                warnings: expect.arrayContaining(['Fajr Adhan: Offline'])
            }));
        });

        it('should generate voiceMonkey warnings if targets includes voiceMonkey', async () => {
             const newConfig = {
                 automation: {
                     triggers: {
                         fajr: { adhan: { enabled: true, targets: ['voiceMonkey'] } }
                     }
                 }
             };
             req.body = newConfig;
             healthCheck.getHealth.mockReturnValue({ voiceMonkey: { healthy: false, message: 'Offline' } });
             
             configService.get.mockReturnValue({});
             forceRefresh.mockResolvedValue({});
             
             await settingsController.updateSettings(req, res);
             
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                 warnings: expect.arrayContaining(['Fajr Adhan: Offline'])
             }));
         });

         it('should cover all branches in warning loops', async () => {
             const newConfig = {
                 automation: {
                     triggers: {
                         fajr: { 
                             adhan: { enabled: true, type: 'tts' },
                             preAdhan: { enabled: false }
                         },
                         sunrise: {
                             adhan: { enabled: true, targets: ['local'] }
                         }
                     }
                 }
             };
             req.body = newConfig;
             healthCheck.getHealth.mockReturnValue({ 
                 tts: { healthy: false }, 
                 local: { healthy: false },
                 voiceMonkey: { healthy: true } 
             });
             
             configService.get.mockReturnValue({});
             forceRefresh.mockResolvedValue({});
             
             await settingsController.updateSettings(req, res);
             
             expect(res.json).toHaveBeenCalled();
         });

         it('should generate warnings if VoiceMonkey audio is incompatible with Alexa', async () => {
             const newConfig = {
                 automation: {
                     triggers: {
                         fajr: { adhan: { enabled: true, type: 'file', path: 'custom/adhan.mp3', targets: ['voiceMonkey'] } }
                     }
                 }
             };
             req.body = newConfig;
             healthCheck.getHealth.mockReturnValue({ voiceMonkey: { healthy: true } });
             systemControllerHelper._getAudioFilesWithMetadata.mockResolvedValue([
                 { path: 'custom/adhan.mp3', vmCompatible: false, vmIssues: ['Bitrate too high'] }
             ]);
             
             configService.get.mockReturnValue({});
             forceRefresh.mockResolvedValue({ meta: {} });
             
             await settingsController.updateSettings(req, res);
             
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                 warnings: expect.arrayContaining(['Fajr Adhan: Audio incompatible with Alexa (Bitrate too high)'])
             }));
         });

         it('should handle VoiceMonkey audio compatibility for TTS files', async () => {
            const newConfig = {
                automation: {
                    triggers: {
                        fajr: { adhan: { enabled: true, type: 'tts', targets: ['voiceMonkey'] } }
                    }
                }
            };
            req.body = newConfig;
            healthCheck.getHealth.mockReturnValue({ voiceMonkey: { healthy: true } });
            systemControllerHelper._getAudioFilesWithMetadata.mockResolvedValue([
                { name: 'tts_fajr_adhan.mp3', vmCompatible: false, vmIssues: ['Sample rate mismatch'] }
            ]);
            
            configService.get.mockReturnValue({});
            forceRefresh.mockResolvedValue({ meta: {} });
            
            await settingsController.updateSettings(req, res);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                warnings: expect.arrayContaining(['Fajr Adhan: Audio incompatible with Alexa (Sample rate mismatch)'])
            }));
        });
    });

    describe('updateSettings', () => {
        it('should return 400 if newConfig is not an object', async () => {
            req.body = null;
            await settingsController.updateSettings(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle validation errors for masjid ID', async () => {
            req.body = { masjidId: 'invalid' };
            validateConfigSource.mockRejectedValue(new Error('Masjid ID not found.'));
            
            await settingsController.updateSettings(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Masjid ID not found.' }));
            
            validateConfigSource.mockRejectedValue(new Error('Invalid Masjid ID format'));
            await settingsController.updateSettings(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
        
        it('should rollback if audio sync fails', async () => {
             req.body = { some: 'config' };
             configService.get.mockReturnValue({ old: 'config' });
             forceRefresh.mockResolvedValue({ meta: {} });
             audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Quota'));
             
             await settingsController.updateSettings(req, res);
             
             expect(audioAssetService.syncAudioAssets).toHaveBeenCalled();
             expect(configService.update).toHaveBeenCalledWith({ old: 'config' }); // Rollback
             expect(res.status).toHaveBeenCalledWith(400);
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Storage Quota Exceeded' }));
        });

        it('should generate warnings if services are unhealthy', async () => {
            req.body = { 
                automation: { 
                    triggers: { 
                        fajr: { 
                            preAdhan: { enabled: true, type: 'tts' } 
                        } 
                    } 
                } 
            };
            validateConfigSource.mockResolvedValue();
            configService.get.mockReturnValue(req.body);
            forceRefresh.mockResolvedValue({ meta: {} });
            healthCheck.getHealth.mockReturnValue({ 
                tts: { healthy: false }, 
                local: { healthy: false },
                voiceMonkey: { healthy: true } 
            });
            
            await settingsController.updateSettings(req, res);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                warnings: expect.arrayContaining([expect.stringContaining('TTS Service is offline')])
            }));
        });

        it('should generate voiceMonkey warnings if offline', async () => {
            req.body = { 
                automation: { 
                    triggers: { 
                        fajr: { 
                            adhan: { enabled: true, type: 'voiceMonkey' } 
                        } 
                    } 
                } 
            };
            validateConfigSource.mockResolvedValue();
            healthCheck.getHealth.mockReturnValue({ 
                voiceMonkey: { healthy: false, message: 'VM Down' },
                tts: { healthy: true },
                local: { healthy: true }
            });
            configService.get.mockReturnValue(req.body);
            forceRefresh.mockResolvedValue({ meta: {} });
            
            await settingsController.updateSettings(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                warnings: expect.arrayContaining([expect.stringContaining('VM Down')])
            }));
        });
    });

    describe('resetSettings', () => {
        it('should successfully reset settings', async () => {
            fs.existsSync.mockReturnValue(true);
            configService.get.mockReturnValue({ some: 'default' });
            forceRefresh.mockResolvedValue({ meta: { reset: true } });
            audioAssetService.syncAudioAssets.mockResolvedValue();
            
            await settingsController.resetSettings(req, res);
            expect(fs.unlinkSync).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Settings reset to defaults.' }));
        });

        it('should handle sync errors during reset', async () => {
            fs.existsSync.mockReturnValue(true);
            forceRefresh.mockResolvedValue({ meta: {} });
            audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Reset Sync Fail'));
            
            await settingsController.resetSettings(req, res);
            
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Reset Failed' }));
        });
    });

    describe('deleteFile', () => {
        it('should return 400 if filename is missing', () => {
            req.body.filename = undefined;
            settingsController.deleteFile(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 on invalid characters (traversal)', () => {
            req.body.filename = '../test.mp3';
            settingsController.deleteFile(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if file not found', () => {
            req.body.filename = 'test.mp3';
            fs.existsSync.mockReturnValue(false);
            settingsController.deleteFile(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should return 200 on successful deletion', () => {
            req.body.filename = 'test.mp3';
            fs.existsSync.mockReturnValue(true);
            settingsController.deleteFile(req, res);
            expect(fs.unlinkSync).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should return 500 if unlinkSync fails', () => {
            req.body.filename = 'test.mp3';
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementation(() => { throw new Error('Delete fail'); });
            settingsController.deleteFile(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('refreshCache', () => {
        it('should return 503 if all sources are offline', async () => {
             configService.get.mockReturnValue({ sources: { backup: { enabled: true } } });
             healthCheck.checkSource.mockResolvedValue({ healthy: false });
             
             await settingsController.refreshCache(req, res);
             expect(res.status).toHaveBeenCalledWith(503);
        });

        it('should successfully refresh if primary is online', async () => {
             configService.get.mockReturnValue({ sources: { backup: { enabled: false } } });
             healthCheck.checkSource.mockResolvedValue({ healthy: true });
             forceRefresh.mockResolvedValue({ meta: { lastUpdated: 'now' } });
             
             await settingsController.refreshCache(req, res);
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ meta: { lastUpdated: 'now' } }));
        });

        it('should handle stop scheduler failures', async () => {
             healthCheck.checkSource.mockResolvedValue({ healthy: true });
             forceRefresh.mockResolvedValue({ meta: {} });
             schedulerService.stopAll.mockRejectedValue(new Error('Stop Fail'));
             
             await settingsController.refreshCache(req, res);
             expect(console.error).toHaveBeenCalled();
             expect(res.json).toHaveBeenCalled();
        });

        it('should handle audio sync failures', async () => {
             healthCheck.checkSource.mockResolvedValue({ healthy: true });
             forceRefresh.mockResolvedValue({ meta: {} });
             audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Sync Fail'));
             
             await settingsController.refreshCache(req, res);
             expect(res.status).toHaveBeenCalledWith(400);
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Sync Failed' }));
        });
    });

    describe('uploadFile', () => {
        it('should return 400 if no file', () => {
             settingsController.uploadFile(req, res);
             expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 200 if file present', async () => {
             req.file = { originalname: 'test.mp3' };
             await settingsController.uploadFile(req, res);
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ filename: 'test.mp3' }));
        });
    });

    describe('saveVoiceMonkey', () => {
        it('should return 400 if missing fields', async () => {
             req.body = { token: 't' };
             await settingsController.saveVoiceMonkey(req, res);
             expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 if empty fields', async () => {
             req.body = { token: ' ', device: ' ' };
             await settingsController.saveVoiceMonkey(req, res);
             expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should save and return 200', async () => {
             req.body = { token: 'real_token', device: 'real_device' };
             await settingsController.saveVoiceMonkey(req, res);
             expect(envManager.setEnvValue).toHaveBeenCalledWith('VOICEMONKEY_TOKEN', 'real_token');
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });
    });

    describe('deleteVoiceMonkey', () => {
        it('should delete and return 200', async () => {
             await settingsController.deleteVoiceMonkey(req, res);
             expect(envManager.deleteEnvValue).toHaveBeenCalledWith('VOICEMONKEY_TOKEN');
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });
    });
});
