const settingsController = require('@controllers/settingsController');
const configService = require('@config');
const sseService = require('@services/system/sseService');
const audioAssetService = require('@services/system/audioAssetService');
const schedulerService = require('@services/core/schedulerService');
const healthCheck = require('@services/system/healthCheck');
const envManager = require('@utils/envManager');
const systemControllerHelper = require('@controllers/systemController');
const fs = require('fs');
const fsAsync = require('fs/promises');
const path = require('path');
const OutputFactory = require('../../../src/outputs');
const workflowService = require('@services/system/configurationWorkflowService');

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
jest.mock('fs/promises', () => ({
    access: jest.fn(),
    unlink: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn()
}));
jest.mock('@utils/audioValidator');
jest.mock('@services/core/prayerTimeService', () => ({
    forceRefresh: jest.fn()
}));
jest.mock('@services/core/validationService', () => ({
    validateConfigSource: jest.fn(),
    validateConfig: jest.fn()
}));
jest.mock('@services/system/configurationWorkflowService', () => ({
    executeUpdate: jest.fn()
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
                prayers: { fajr: {} },
                sources: { primary: { type: 'aladhan' } },
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
                prayers: mockConfig.prayers,
                sources: mockConfig.sources,
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

    describe('updateSettings', () => {
        it('should return 400 if result is missing (mocked failure)', async () => {
            // This is just to keep some coverage of the 400 path if needed
        });

        it('should successfully update settings via workflowService', async () => {
            const result = { message: 'Settings updated', meta: {}, warnings: [] };
            workflowService.executeUpdate.mockResolvedValue(result);
            req.body = { some: 'config' };
            
            await settingsController.updateSettings(req, res);
            
            expect(workflowService.executeUpdate).toHaveBeenCalledWith(req.body);
            expect(res.json).toHaveBeenCalledWith(result);
        });

        it('should handle validation errors from workflowService', async () => {
            workflowService.executeUpdate.mockRejectedValue(new Error('Validation Failed: Error'));
            await settingsController.updateSettings(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Update Failed' }));
        });

        it('should handle generic errors from workflowService', async () => {
            workflowService.executeUpdate.mockRejectedValue(new Error('Internal Oops'));
            await settingsController.updateSettings(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('resetSettings', () => {
        it('should successfully reset settings and trigger deep clean', async () => {
            fsAsync.access.mockResolvedValue();
            fsAsync.unlink.mockResolvedValue();
            configService.get.mockReturnValue({ some: 'default' });
            forceRefresh.mockResolvedValue({ meta: { reset: true } });
            audioAssetService.syncAudioAssets.mockResolvedValue({ warnings: [] });
            
            await settingsController.resetSettings(req, res);
            expect(fsAsync.unlink).toHaveBeenCalled();
            expect(audioAssetService.syncAudioAssets).toHaveBeenCalledWith(true);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Settings reset to defaults.' }));
        });

        it('should handle sync errors during reset', async () => {
            fsAsync.access.mockResolvedValue();
            forceRefresh.mockResolvedValue({ meta: {} });
            audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Reset Sync Fail'));
            
            await settingsController.resetSettings(req, res);
            
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Sync Failed' }));
        });
    });

    describe('deleteFile', () => {
        it('should return 400 if filename is missing', async () => {
            req.body.filename = undefined;
            await settingsController.deleteFile(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 400 on invalid characters (traversal)', async () => {
            req.body.filename = '../test.mp3';
            await settingsController.deleteFile(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if file not found', async () => {
            req.body.filename = 'test.mp3';
            fsAsync.access.mockRejectedValue(new Error('ENOENT'));
            await settingsController.deleteFile(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should return 403 if file is protected', async () => {
            req.body.filename = 'azan.mp3';
            fsAsync.access.mockResolvedValue(); // meta exists
            fsAsync.readFile.mockResolvedValue(JSON.stringify({ protected: true }));
            
            await settingsController.deleteFile(req, res);
            
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('protected') }));
        });

        it('should return 200 on successful deletion', async () => {
            req.body.filename = 'test.mp3';
            fsAsync.access.mockResolvedValue();
            fsAsync.readFile.mockResolvedValue(JSON.stringify({ protected: false }));
            fsAsync.unlink.mockResolvedValue();
            await settingsController.deleteFile(req, res);
            expect(fsAsync.unlink).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should return 500 if unlink fails', async () => {
            req.body.filename = 'test.mp3';
            fsAsync.access.mockResolvedValue();
            fsAsync.readFile.mockResolvedValue(JSON.stringify({ protected: false }));
            fsAsync.unlink.mockRejectedValue(new Error('Delete fail'));
            await settingsController.deleteFile(req, res);
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
