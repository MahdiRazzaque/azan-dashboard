const systemController = require('../../../src/controllers/systemController');
const healthCheck = require('../../../src/services/healthCheck');
const schedulerService = require('../../../src/services/schedulerService');
const sseService = require('../../../src/services/sseService');
const automationService = require('../../../src/services/automationService');
const audioAssetService = require('../../../src/services/audioAssetService');
const diagnosticsService = require('../../../src/services/diagnosticsService');
const configService = require('../../../src/config');
const fetchers = require('../../../src/services/fetchers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

jest.mock('../../../src/services/healthCheck');
jest.mock('../../../src/services/schedulerService');
jest.mock('../../../src/services/sseService');
jest.mock('../../../src/services/automationService');
jest.mock('../../../src/services/audioAssetService');
jest.mock('../../../src/services/diagnosticsService');
jest.mock('../../../src/config');
jest.mock('../../../src/services/fetchers');
jest.mock('axios');
jest.mock('fs');

describe('SystemController', () => {
    let req, res;

    beforeEach(() => {
        req = { body: {}, params: {}, query: {}, headers: {}, socket: {} };
        res = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
    });

    describe('getHealth', () => {
        it('should return 200 if all critical services are healthy', () => {
            const health = {
                local: { healthy: true },
                tts: { healthy: true },
                primarySource: { healthy: true }
            };
            healthCheck.getHealth.mockReturnValue(health);
            configService.get.mockReturnValue({ sources: { backup: { enabled: false } } });
            
            systemController.getHealth(req, res);
            
            expect(res.json).toHaveBeenCalledWith(health);
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should return 503 if a critical service is unhealthy', () => {
            const health = {
                local: { healthy: false },
                tts: { healthy: true },
                primarySource: { healthy: true }
            };
            healthCheck.getHealth.mockReturnValue(health);
            configService.get.mockReturnValue({ sources: { backup: { enabled: false } } });
            
            systemController.getHealth(req, res);
            
            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith(health);
        });

        it('should return 200 if primary is unhealthy but backup is healthy and needed', () => {
            const health = {
                local: { healthy: true },
                tts: { healthy: true },
                primarySource: { healthy: false },
                backupSource: { healthy: true }
            };
            healthCheck.getHealth.mockReturnValue(health);
            configService.get.mockReturnValue({ sources: { backup: { enabled: true } } });
            
            systemController.getHealth(req, res);
            
            expect(res.json).toHaveBeenCalledWith(health);
            expect(res.status).not.toHaveBeenCalled();
        });

        it('should return 503 if primary is unhealthy and backup is disabled', () => {
            const health = {
                local: { healthy: true },
                tts: { healthy: true },
                primarySource: { healthy: false },
                backupSource: { healthy: true } // even if healthy, it's disabled
            };
            healthCheck.getHealth.mockReturnValue(health);
            configService.get.mockReturnValue({ sources: { backup: { enabled: false } } });
            
            systemController.getHealth(req, res);
            
            expect(res.status).toHaveBeenCalledWith(503);
        });
    });

    describe('refreshHealth', () => {
        it('should call healthCheck.refresh with defaults', async () => {
            healthCheck.refresh.mockResolvedValue({ success: true });
            await systemController.refreshHealth(req, res);
            expect(healthCheck.refresh).toHaveBeenCalledWith('all', 'silent');
            expect(res.json).toHaveBeenCalled();
        });

        it('should use provided target and mode', async () => {
            req.body = { target: 'tts', mode: 'verbose' };
            await systemController.refreshHealth(req, res);
            expect(healthCheck.refresh).toHaveBeenCalledWith('tts', 'verbose');
        });
    });

    describe('getJobs', () => {
        it('should return jobs from schedulerService', () => {
            const jobs = { maintenance: [], automation: [] };
            schedulerService.getJobs.mockReturnValue(jobs);
            systemController.getJobs(req, res);
            expect(res.json).toHaveBeenCalledWith(jobs);
        });

        it('should return empty jobs if schedulerService.getJobs is missing', () => {
            const original = schedulerService.getJobs;
            delete schedulerService.getJobs;
            systemController.getJobs(req, res);
            expect(res.json).toHaveBeenCalledWith({ maintenance: [], automation: [] });
            schedulerService.getJobs = original;
        });
    });

    describe('getLogs', () => {
        it('should call sseService.addClient', () => {
            systemController.getLogs(req, res);
            expect(sseService.addClient).toHaveBeenCalledWith(res);
        });
    });

    describe('getAudioFiles', () => {
        it('should return list of audio files and create dirs if missing', () => {
            fs.existsSync.mockReturnValue(false);
            fs.readdirSync.mockReturnValue(['test.mp3', 'other.txt']);
            
            systemController.getAudioFiles(req, res);
            
            expect(fs.mkdirSync).toHaveBeenCalledTimes(2);
            expect(res.json).toHaveBeenCalledWith(expect.arrayContaining([
                expect.objectContaining({ name: 'test.mp3', type: 'custom' }),
                expect.objectContaining({ name: 'test.mp3', type: 'cache' })
            ]));
        });
    });

    describe('getConstants', () => {
        it('should return sorted constants', () => {
            systemController.getConstants(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                calculationMethods: expect.any(Array),
                madhabs: expect.any(Array)
            }));
        });

        it('_toSortedArray should handle null', () => {
            const result = systemController._toSortedArray(null);
            expect(result).toEqual([]);
        });
    });

    describe('getAutomationStatus', () => {
        it('should return automation status', async () => {
            diagnosticsService.getAutomationStatus.mockResolvedValue({ status: 'ok' });
            await systemController.getAutomationStatus(req, res);
            expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
        });
    });

    describe('getTTSStatus', () => {
        it('should return TTS status', async () => {
            diagnosticsService.getTTSStatus.mockResolvedValue({ status: 'generated' });
            await systemController.getTTSStatus(req, res);
            expect(res.json).toHaveBeenCalledWith({ status: 'generated' });
        });
    });

    describe('restartScheduler', () => {
        it('should restart scheduler', async () => {
            await systemController.restartScheduler(req, res);
            expect(schedulerService.hotReload).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Scheduler restarted.' });
        });
    });

    describe('regenerateTTS', () => {
        it('should resync audio assets', async () => {
            await systemController.regenerateTTS(req, res);
            expect(audioAssetService.syncAudioAssets).toHaveBeenCalledWith(true);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should handle errors', async () => {
            audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Sync failed'));
            await systemController.regenerateTTS(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });
    });

    describe('testAudio', () => {
        it('should reject missing filename/type', async () => {
            await systemController.testAudio(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should reject invalid type', async () => {
            req.body = { filename: 'test.mp3', type: 'invalid' };
            await systemController.testAudio(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should reject invalid target', async () => {
            req.body = { filename: 'test.mp3', type: 'custom', target: 'invalid' };
            await systemController.testAudio(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should reject directory traversal', async () => {
            req.body = { filename: '../secret.mp3', type: 'custom' };
            await systemController.testAudio(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 404 if file not found', async () => {
            req.body = { filename: 'miss.mp3', type: 'custom' };
            fs.existsSync.mockReturnValue(false);
            await systemController.testAudio(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        it('should trigger local automation', async () => {
            req.body = { filename: 'test.mp3', type: 'custom', target: 'local' };
            fs.existsSync.mockReturnValue(true);
            await systemController.testAudio(req, res);
            expect(automationService.handleLocal).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should trigger browser broadcast', async () => {
            req.body = { filename: 'test.mp3', type: 'cache', target: 'browser' };
            fs.existsSync.mockReturnValue(true);
            await systemController.testAudio(req, res);
            expect(automationService.broadcastToClients).toHaveBeenCalled();
        });

        it('should trigger VoiceMonkey', async () => {
            req.body = { filename: 'test.mp3', type: 'custom', target: 'voiceMonkey' };
            fs.existsSync.mockReturnValue(true);
            await systemController.testAudio(req, res);
            expect(automationService.handleVoiceMonkey).toHaveBeenCalled();
        });
    });

    describe('validateUrl', () => {
        it('should validate with HEAD', async () => {
            req.body = { url: 'http://ok.com' };
            axios.head.mockResolvedValue({});
            await systemController.validateUrl(req, res);
            expect(res.json).toHaveBeenCalledWith({ valid: true });
        });

        it('should validate with GET if HEAD fails', async () => {
            req.body = { url: 'http://ok.com' };
            axios.head.mockRejectedValue(new Error('HEAD failed'));
            axios.get.mockResolvedValue({});
            await systemController.validateUrl(req, res);
            expect(axios.get).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ valid: true });
        });

        it('should fail if both HEAD and GET fail', async () => {
            req.body = { url: 'http://bad.com' };
            axios.head.mockRejectedValue(new Error('HEAD failed'));
            axios.get.mockRejectedValue(new Error('GET failed'));
            await systemController.validateUrl(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ valid: false }));
        });

        it('should handle axios error with response in GET fallback', async () => {
            req.body = { url: 'http://bad.com' };
            axios.head.mockRejectedValue(new Error('HEAD failed'));
            axios.get.mockRejectedValue({ response: { status: 404 } });
            await systemController.validateUrl(req, res);
            expect(res.json).toHaveBeenCalledWith({ valid: false, error: 'Status 404' });
        });

        it('should reject missing URL', async () => {
            await systemController.validateUrl(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('testSource', () => {
        it('should reject invalid target', async () => {
            req.body = { target: 'invalid' };
            await systemController.testSource(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should reject if source not configured', async () => {
            req.body = { target: 'backup' };
            configService.get.mockReturnValue({ sources: {} });
            await systemController.testSource(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should reject if backup disabled', async () => {
            req.body = { target: 'backup' };
            configService.get.mockReturnValue({ sources: { backup: { enabled: false } } });
            await systemController.testSource(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should test aladhan successfully', async () => {
            req.body = { target: 'primary' };
            configService.get.mockReturnValue({ 
                sources: { primary: { type: 'aladhan' } },
                location: { timezone: 'UTC' }
            });
            fetchers.fetchAladhanAnnual.mockResolvedValue({ '2026-01-01': {} });
            
            await systemController.testSource(req, res);
            
            expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should test mymasjid successfully', async () => {
            req.body = { target: 'primary' };
            configService.get.mockReturnValue({ 
                sources: { primary: { type: 'mymasjid' } }
            });
            fetchers.fetchMyMasjidBulk.mockResolvedValue({ '2026-01-01': {} });
            
            await systemController.testSource(req, res);
            
            expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should fail on unsupported source type', async () => {
            req.body = { target: 'primary' };
            configService.get.mockReturnValue({ 
                sources: { primary: { type: 'unsupported' } }
            });
            await systemController.testSource(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle fetch errors and refresh health anyway', async () => {
            req.body = { target: 'primary' };
            configService.get.mockReturnValue({ 
                sources: { primary: { type: 'aladhan' } },
                location: { timezone: 'UTC' }
            });
            fetchers.fetchAladhanAnnual.mockRejectedValue(new Error('Fetch failed'));
            
            await expect(systemController.testSource(req, res)).rejects.toThrow('Fetch failed');
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource');
        });

        it('should handle health refresh failure catch block', async () => {
            req.body = { target: 'primary' };
            configService.get.mockReturnValue({ sources: { primary: { type: 'aladhan' } }, location: { timezone: 'UTC' } });
            fetchers.fetchAladhanAnnual.mockRejectedValue(new Error('Fetch failed'));
            healthCheck.refresh.mockRejectedValue(new Error('Health refresh failed'));
            
            await expect(systemController.testSource(req, res)).rejects.toThrow('Fetch failed');
        });
    });

    describe('testVoiceMonkey', () => {
        it('should reject missing params', async () => {
            await systemController.testVoiceMonkey(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return success if API returns success', async () => {
            req.body = { token: 'tok', device: 'dev' };
            axios.get.mockResolvedValue({ data: { success: true } });
            await systemController.testVoiceMonkey(req, res);
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it('should throw if API returns failure', async () => {
            req.body = { token: 'tok', device: 'dev' };
            axios.get.mockResolvedValue({ data: { success: false, error: 'API Error' } });
            await expect(systemController.testVoiceMonkey(req, res)).rejects.toThrow('API Error');
        });

        it('should use default error message if API returns failure without msg', async () => {
            req.body = { token: 'tok', device: 'dev' };
            axios.get.mockResolvedValue({ data: { success: false } });
            await expect(systemController.testVoiceMonkey(req, res)).rejects.toThrow('VoiceMonkey API returned failure');
        });
    });

    describe('getStorageStatus', () => {
        it('should return storage status', async () => {
            const storageService = require('../../../src/services/storageService');
            jest.mock('../../../src/services/storageService', () => ({
                getUsage: jest.fn().mockResolvedValue({ total: 100, custom: 50, cache: 50 }),
                getSystemStats: jest.fn().mockResolvedValue(1000),
                calculateRecommendedLimit: jest.fn().mockReturnValue(2.0)
            }));
            
            configService.get.mockReturnValue({ data: { storageLimit: 1.5 } });
            
            await systemController.getStorageStatus(req, res);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                usedBytes: 100,
                limitBytes: 1.5 * 1024 * 1024 * 1024
            }));
        });
    });
});
