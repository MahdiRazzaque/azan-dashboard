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
const OutputFactory = require('../../../src/outputs');

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
jest.mock('../../../src/outputs');
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
    let mockLocalStrategy, mockVMStrategy;

    beforeEach(() => {
        req = { body: {} };
        res = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
        validateConfig.mockReturnValue({ value: {} });
        validateConfigSource.mockResolvedValue();
        audioAssetService.syncAudioAssets.mockResolvedValue({ warnings: [] });
        audioValidator.analyseAudioFile.mockResolvedValue({ duration: 10 });
        audioValidator.validateVoiceMonkeyCompatibility.mockReturnValue({ vmCompatible: true });
        systemControllerHelper._getAudioFilesWithMetadata.mockResolvedValue([]);

        // Default health state for mocks
        let currentHealth = {
            tts: { healthy: true },
            local: { healthy: true },
            voicemonkey: { healthy: true },
            primarySource: { healthy: true },
            backupSource: { healthy: true }
        };

        healthCheck.getHealth.mockImplementation(() => currentHealth);
        healthCheck.refresh.mockImplementation(async (target, params) => {
            if (target === 'all') {
                return currentHealth;
            }
            return currentHealth; // Simplified for basic tests
        });
        
        mockLocalStrategy = {
            id: 'local',
            label: 'Local Audio',
            validateTrigger: jest.fn().mockReturnValue([]),
            augmentAudioMetadata: jest.fn().mockReturnValue({})
        };
        mockVMStrategy = {
            id: 'voicemonkey',
            label: 'VoiceMonkey (Alexa)',
            validateTrigger: jest.fn().mockReturnValue([]),
            augmentAudioMetadata: jest.fn().mockReturnValue({})
        };

        OutputFactory.getAllStrategies.mockReturnValue([
            { id: 'local', label: 'Local Audio' },
            { id: 'voicemonkey', label: 'VoiceMonkey (Alexa)' }
        ]);
        OutputFactory.getAllStrategyInstances.mockReturnValue([mockLocalStrategy, mockVMStrategy]);
        OutputFactory.getStrategy.mockImplementation((id) => {
            if (id === 'local') return mockLocalStrategy;
            if (id === 'voicemonkey') return mockVMStrategy;
            throw new Error('Not found');
        });
        OutputFactory.getSecretRequirementKeys.mockReturnValue([
            { strategyId: 'voicemonkey', key: 'token' },
            { strategyId: 'voicemonkey', key: 'device' }
        ]);

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
                    outputs: {
                        voicemonkey: {
                            enabled: true,
                            params: {
                                token: 'secret-token',
                                device: 'secret-device'
                            }
                        }
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
                    outputs: {
                        voicemonkey: {
                            enabled: true,
                            params: {}
                        }
                    }
                }
            });
        });

        it('should handle missing outputs in public settings', async () => {
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

        it('should generate voicemonkey warnings if targets includes voicemonkey', async () => {
            const newConfig = {
                automation: {
                    triggers: {
                        fajr: { adhan: { enabled: true, targets: ['voicemonkey'] } }
                    }
                }
            };
            req.body = newConfig;
            const unhealthyHealth = { 
                voicemonkey: { healthy: false, message: 'Offline' },
                tts: { healthy: true },
                local: { healthy: true }
            };
            healthCheck.refresh.mockResolvedValue(unhealthyHealth);
            healthCheck.getHealth.mockReturnValue(unhealthyHealth);
            
            configService.get.mockReturnValue({
                automation: {
                    outputs: {
                        voicemonkey: { enabled: true }
                    },
                    triggers: newConfig.automation.triggers
                }
            });
            forceRefresh.mockResolvedValue({ meta: {} });
            
            await settingsController.updateSettings(req, res);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                warnings: expect.arrayContaining([expect.stringContaining('VoiceMonkey (Alexa) Integration: Offline')])
            }));
        });

        it('should generate warnings if VoiceMonkey audio is incompatible with Alexa', async () => {
             const newConfig = {
                 automation: {
                     triggers: {
                         fajr: { adhan: { enabled: true, type: 'file', path: 'custom/adhan.mp3', targets: ['voicemonkey'] } }
                     }
                 }
             };
             req.body = newConfig;
             const healthyStatus = { 
                 voicemonkey: { healthy: true },
                 tts: { healthy: true }
             };
             healthCheck.refresh.mockResolvedValue(healthyStatus);
             healthCheck.getHealth.mockReturnValue(healthyStatus);
             
             mockVMStrategy.validateTrigger.mockReturnValue(['Fajr Adhan: Audio incompatible with Alexa (Bitrate too high)']);

             configService.get.mockReturnValue({
                 automation: {
                     outputs: {
                         voicemonkey: { enabled: true }
                     },
                     triggers: newConfig.automation.triggers
                 }
             });
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
                        fajr: { adhan: { enabled: true, type: 'tts', targets: ['voicemonkey'] } }
                    }
                }
            };
            req.body = newConfig;
            const healthyStatus = { 
                voicemonkey: { healthy: true }, 
                tts: { healthy: true } 
            };
            healthCheck.refresh.mockResolvedValue(healthyStatus);
            healthCheck.getHealth.mockReturnValue(healthyStatus);
            
            mockVMStrategy.validateTrigger.mockReturnValue(['Fajr Adhan: Audio incompatible with Alexa (Sample rate mismatch)']);

            configService.get.mockReturnValue({
                automation: {
                    outputs: {
                        voicemonkey: { enabled: true }
                    },
                    triggers: newConfig.automation.triggers
                }
            });
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
             expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Sync Failed' }));
        });

        it('should generate warnings if services are unhealthy', async () => {
            req.body = { 
                automation: { 
                    triggers: { 
                        fajr: { 
                            preAdhan: { enabled: true, type: 'tts', targets: ['local'] } 
                        } 
                    } 
                } 
            };
            validateConfigSource.mockResolvedValue();
            configService.get.mockReturnValue({
                automation: {
                    outputs: {
                        local: { enabled: true }
                    },
                    triggers: req.body.automation.triggers
                }
            });
            forceRefresh.mockResolvedValue({ meta: {} });
            const unhealthyStatus = { 
                tts: { healthy: false }, 
                local: { healthy: false }
            };
            healthCheck.refresh.mockResolvedValue(unhealthyStatus);
            healthCheck.getHealth.mockReturnValue(unhealthyStatus);
            
            await settingsController.updateSettings(req, res);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                warnings: expect.arrayContaining([expect.stringContaining('TTS Service is offline')])
            }));
        });

        it('should generate voicemonkey warnings if offline', async () => {
            req.body = { 
                automation: { 
                    triggers: { 
                        fajr: { 
                            adhan: { enabled: true, targets: ['voicemonkey'] } 
                        } 
                    } 
                } 
            };
            validateConfigSource.mockResolvedValue();
            const unhealthyStatus = { 
                voicemonkey: { healthy: false, message: 'VM Down' },
                tts: { healthy: true }
            };
            healthCheck.refresh.mockResolvedValue(unhealthyStatus);
            healthCheck.getHealth.mockReturnValue(unhealthyStatus);
            configService.get.mockReturnValue({
                automation: {
                    outputs: {
                        voicemonkey: { enabled: true }
                    },
                    triggers: req.body.automation.triggers
                }
            });
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
            audioAssetService.syncAudioAssets.mockResolvedValue({ warnings: [] });
            
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
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Sync Failed' }));
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
});
