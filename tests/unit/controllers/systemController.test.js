const systemController = require('@controllers/systemController');
const healthCheck = require('@services/system/healthCheck');
const schedulerService = require('@services/core/schedulerService');
const sseService = require('@services/system/sseService');
const automationService = require('@services/core/automationService');
const audioAssetService = require('@services/system/audioAssetService');
const diagnosticsService = require('@services/system/diagnosticsService');
const voiceService = require('@services/system/voiceService');
const storageService = require('@services/system/storageService');
const configService = require('@config');
const { ProviderFactory } = require('@providers');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const OutputFactory = require('../../../src/outputs');

jest.mock('@services/system/healthCheck');
jest.mock('@services/core/schedulerService');
jest.mock('@services/system/sseService');
jest.mock('@services/core/automationService');
jest.mock('@services/system/audioAssetService');
jest.mock('@services/system/diagnosticsService');
jest.mock('@services/system/voiceService');
jest.mock('@services/system/storageService');
jest.mock('@config');
jest.mock('@providers');
jest.mock('axios');
jest.mock('fs');
jest.mock('../../../src/outputs');

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

        // Default OutputFactory mock
        OutputFactory.getStrategy = jest.fn();
        OutputFactory.getAllStrategies = jest.fn();

        // Default ProviderFactory mock
        ProviderFactory.create.mockImplementation((source) => {
            if (source.type === 'aladhan' || source.type === 'mymasjid') {
                return { getAnnualTimes: jest.fn().mockResolvedValue({}) };
            }
            throw new Error(`Unknown provider type: ${source.type}`);
        });
    });

    describe('Output Strategies', () => {
        it('should get output registry', () => {
             const mockMeta = [{ id: 'test', label: 'Test' }];
             OutputFactory.getAllStrategies.mockReturnValue(mockMeta);
             systemController.getOutputRegistry(req, res);
             expect(res.json).toHaveBeenCalledWith(mockMeta);
        });
        
        it('should verify output credentials', async () => {
             req.params.strategyId = 'test';
             req.body = { token: 't' };
             const mockStrategy = { verifyCredentials: jest.fn().mockResolvedValue({ success: true }) };
             OutputFactory.getStrategy.mockReturnValue(mockStrategy);
             
             await systemController.verifyOutput(req, res);
             
             expect(OutputFactory.getStrategy).toHaveBeenCalledWith('test');
             expect(mockStrategy.verifyCredentials).toHaveBeenCalledWith({ token: 't' });
             expect(res.json).toHaveBeenCalledWith({ success: true });
        });
        
        it('should test output execution', async () => {
             req.params.strategyId = 'test';
             req.body = { foo: 'bar' };
             const mockStrategy = { execute: jest.fn().mockResolvedValue() };
             OutputFactory.getStrategy.mockReturnValue(mockStrategy);
             
             await systemController.testOutput(req, res);
             
             expect(mockStrategy.execute).toHaveBeenCalledWith(
                 expect.objectContaining({
                     params: { foo: 'bar' },
                     source: expect.objectContaining({
                         url: expect.stringContaining('test.mp3'),
                         filePath: expect.stringContaining('test.mp3')
                     })
                 }),
                 { isTest: true }
             );
             expect(res.json).toHaveBeenCalledWith({ success: true });
        });
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
            expect(healthCheck.refresh).toHaveBeenCalledWith('all', undefined);
            expect(res.json).toHaveBeenCalled();
        });

        it('should use provided target', async () => {
            req.body = { target: 'tts' };
            await systemController.refreshHealth(req, res);
            expect(healthCheck.refresh).toHaveBeenCalledWith('tts', undefined);
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
        it('should return list of audio files and create dirs if missing', async () => {
            fs.existsSync.mockReturnValueOnce(false) // audioCustomDir
                         .mockReturnValueOnce(false) // audioCacheDir
                         .mockReturnValueOnce(false) // metaCustomDir
                         .mockReturnValueOnce(false) // metaCacheDir
                         .mockReturnValue(true);    // return true for the scan and metadata checks
            fs.readdirSync.mockReturnValue(['test.mp3', 'other.txt']);
            
            await systemController.getAudioFiles(req, res);
            
            expect(fs.mkdirSync).toHaveBeenCalledTimes(4);
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
            
            const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({ '2026-01-01': {} }) };
            ProviderFactory.create.mockReturnValue(mockProvider);
            
            await systemController.testSource(req, res);
            
            expect(ProviderFactory.create).toHaveBeenCalled();
            expect(mockProvider.getAnnualTimes).toHaveBeenCalled();
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource');
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should test mymasjid successfully', async () => {
            req.body = { target: 'primary' };
            configService.get.mockReturnValue({ 
                sources: { primary: { type: 'mymasjid' } },
                location: { timezone: 'UTC' }
            });
            
            const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({ '2026-01-01': {} }) };
            ProviderFactory.create.mockReturnValue(mockProvider);
            
            await systemController.testSource(req, res);
            
            expect(ProviderFactory.create).toHaveBeenCalled();
            expect(mockProvider.getAnnualTimes).toHaveBeenCalled();
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
            const mockProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('Fetch failed')) };
            ProviderFactory.create.mockReturnValue(mockProvider);
            
            await expect(systemController.testSource(req, res)).rejects.toThrow('Fetch failed');
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource');
        });

        it('should handle health refresh failure catch block', async () => {
            req.body = { target: 'primary' };
            configService.get.mockReturnValue({ sources: { primary: { type: 'aladhan' } }, location: { timezone: 'UTC' } });
            
            const mockProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('Fetch failed')) };
            ProviderFactory.create.mockReturnValue(mockProvider);
            
            healthCheck.refresh.mockRejectedValue(new Error('Health refresh failed'));
            
            await expect(systemController.testSource(req, res)).rejects.toThrow('Fetch failed');
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource');
        });
    });

    describe('getStorageStatus', () => {
        it('should return storage status', async () => {
            storageService.getUsage.mockResolvedValue({ total: 100, custom: 50, cache: 50 });
            storageService.getSystemStats.mockResolvedValue(1000);
            storageService.calculateRecommendedLimit.mockReturnValue(2.0);
            
            configService.get.mockReturnValue({ data: { storageLimit: 1.5 } });
            
            await systemController.getStorageStatus(req, res);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                usedBytes: 100,
                limitBytes: 1.5 * 1024 * 1024 * 1024
            }));
        });
    });

    describe('getVoices', () => {
        it('should return voices from voiceService', async () => {
            const mockVoices = [{ id: 'v1', name: 'Voice 1' }];
            voiceService.getVoices.mockReturnValue(mockVoices);
            await systemController.getVoices(req, res);
            expect(res.json).toHaveBeenCalledWith(mockVoices);
        });
    });

    describe('previewTTS', () => {
        it('should return 400 if missing fields', async () => {
            req.body = { template: 'test' };
            await systemController.previewTTS(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return data from audioAssetService', async () => {
            req.body = { template: 'test', prayerKey: 'fajr', voice: 'v1' };
            const mockData = { url: 'http://temp.mp3' };
            audioAssetService.previewTTS.mockResolvedValue(mockData);
            await systemController.previewTTS(req, res);
            expect(res.json).toHaveBeenCalledWith(mockData);
        });

        it('should handle errors and return 500', async () => {
            req.body = { template: 'test', prayerKey: 'fajr', voice: 'v1' };
            audioAssetService.previewTTS.mockRejectedValue(new Error('Preview Error'));
            await systemController.previewTTS(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Preview Error' });
        });
    });

    describe('cleanupTempTTS', () => {
        it('should call cleanup and return 200', async () => {
            await systemController.cleanupTempTTS(req, res);
            expect(audioAssetService.cleanupTempAudio).toHaveBeenCalledWith(true);
            expect(res.json).toHaveBeenCalledWith({ 
                success: true, 
                message: 'Temporary TTS files cleaned up successfully.' 
            });
        });

        it('should handle errors and return 500', async () => {
            audioAssetService.cleanupTempAudio.mockRejectedValue(new Error('Cleanup Error'));
            await systemController.cleanupTempTTS(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Failed to clean up temporary files' });
        });
    });

    describe('runJob', () => {
        it('should return 400 if jobName is missing', async () => {
            await systemController.runJob(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        });

        it('should call schedulerService.runJob and return result', async () => {
            req.body = { jobName: 'Test Job' };
            schedulerService.runJob.mockResolvedValue({ success: true, message: 'OK' });
            
            await systemController.runJob(req, res);
            
            expect(schedulerService.runJob).toHaveBeenCalledWith('Test Job');
            expect(res.json).toHaveBeenCalledWith({ success: true, message: 'OK' });
            expect(sseService.log).toHaveBeenCalledWith(expect.stringContaining('Manual trigger: Test Job'), 'info');
        });

        it('should return 400 if scheduler returns failure', async () => {
            req.body = { jobName: 'Bad Job' };
            schedulerService.runJob.mockResolvedValue({ success: false, message: 'Nope' });
            
            await systemController.runJob(req, res);
            
            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Nope' });
        });

        it('should return 500 on unexpected error', async () => {
            req.body = { jobName: 'Error Job' };
            schedulerService.runJob.mockRejectedValue(new Error('Fatal'));
            
            await systemController.runJob(req, res);
            
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message: 'Fatal' }));
        });
    });
});