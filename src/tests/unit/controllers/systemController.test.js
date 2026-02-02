const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dns = require('dns');
const systemController = require('@controllers/systemController');
const healthCheck = require('@services/system/healthCheck');
const schedulerService = require('@services/core/schedulerService');
const sseService = require('@services/system/sseService');
const automationService = require('@services/core/automationService');
const audioAssetService = require('@services/system/audioAssetService');
const diagnosticsService = require('@services/system/diagnosticsService');
const voiceService = require('@services/system/voiceService');
const configService = require('@config');
const { ProviderFactory } = require('@providers');
const OutputFactory = require('@outputs');

// Mock all dependencies
jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn(),
        readFile: jest.fn(),
        access: jest.fn(),
        mkdir: jest.fn()
    },
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readdirSync: jest.fn(),
    readFileSync: jest.fn()
}));

jest.mock('dns', () => ({
    promises: {
        lookup: jest.fn()
    }
}));

jest.mock('axios');
jest.mock('@services/system/healthCheck');
jest.mock('@services/core/schedulerService');
jest.mock('@services/system/sseService');
jest.mock('@services/core/automationService');
jest.mock('@services/system/audioAssetService');
jest.mock('@services/system/diagnosticsService');
jest.mock('@services/system/voiceService');
jest.mock('@config');
jest.mock('@providers');
jest.mock('@outputs');

describe('SystemController', () => {
    let req, res;

    beforeEach(() => {
        jest.clearAllMocks();
        req = {
            body: {},
            params: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        };
        configService.get.mockReturnValue({
            sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid', enabled: true } },
            location: { timezone: 'UTC' },
            automation: {}
        });
        // Default DNS mock
        dns.promises.lookup.mockResolvedValue({ address: '8.8.8.8' });
    });

    describe('Output Strategies', () => {
        it('should get output registry', () => {
            const mockStrategies = [{ id: 'local', name: 'Local' }];
            OutputFactory.getAllStrategies.mockReturnValue(mockStrategies);
            systemController.getOutputRegistry(req, res);
            expect(res.json).toHaveBeenCalledWith(mockStrategies);
        });

        it('should verify output credentials', async () => {
            const mockStrategy = { verifyCredentials: jest.fn().mockResolvedValue({ success: true }) };
            OutputFactory.getStrategy.mockReturnValue(mockStrategy);
            req.params.strategyId = 'voicemonkey';
            req.body = { api_key: 'test' };
            
            await systemController.verifyOutput(req, res);
            expect(mockStrategy.verifyCredentials).toHaveBeenCalledWith(req.body);
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it('should return 400 if source is missing in testOutput', async () => {
            const mockStrategy = { execute: jest.fn() };
            OutputFactory.getStrategy.mockReturnValue(mockStrategy);
            req.params.strategyId = 'voicemonkey';
            
            await systemController.testOutput(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should use provided source in testOutput', async () => {
            const mockStrategy = { execute: jest.fn().mockResolvedValue({ success: true }) };
            OutputFactory.getStrategy.mockReturnValue(mockStrategy);
            req.params.strategyId = 'voicemonkey';
            req.body = { source: { path: 'custom/test.mp3' } };
            
            await systemController.testOutput(req, res);
            expect(mockStrategy.execute).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });
    });

    describe('getHealth', () => {
        it('should return 200 if all critical services are healthy', () => {
            healthCheck.getHealth.mockReturnValue({
                local: { healthy: true },
                tts: { healthy: true },
                primarySource: { healthy: true }
            });
            systemController.getHealth(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        it('should return 503 if a critical service is unhealthy', () => {
            healthCheck.getHealth.mockReturnValue({
                local: { healthy: false },
                tts: { healthy: true },
                primarySource: { healthy: true }
            });
            systemController.getHealth(req, res);
            expect(res.status).toHaveBeenCalledWith(503);
        });

        it('should return 200 if primary is unhealthy but backup is healthy and needed', () => {
             healthCheck.getHealth.mockReturnValue({
                local: { healthy: true },
                tts: { healthy: true },
                primarySource: { healthy: false },
                backupSource: { healthy: true }
            });
            systemController.getHealth(req, res);
            expect(res.json).toHaveBeenCalled();
        });

        it('should return 503 if primary is unhealthy and backup is disabled', () => {
            configService.get.mockReturnValue({
                sources: { primary: { type: 'aladhan' }, backup: { enabled: false } }
            });
            healthCheck.getHealth.mockReturnValue({
                local: { healthy: true },
                tts: { healthy: true },
                primarySource: { healthy: false },
                backupSource: { healthy: true }
            });
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
            fs.promises.mkdir.mockResolvedValue(undefined);
            fs.promises.access.mockResolvedValue(undefined);
            fs.promises.readdir.mockResolvedValue(['test.mp3', 'other.txt']);
            fs.promises.readFile.mockResolvedValue(JSON.stringify({ vmCompatible: true }));
            
            await systemController.getAudioFiles(req, res);
            expect(fs.promises.mkdir).toHaveBeenCalled();
            expect(res.json).toHaveBeenCalled();
            const files = res.json.mock.calls[0][0];
            expect(files.some(f => f.name === 'test.mp3')).toBe(true);
            expect(files.some(f => f.name === 'other.txt')).toBe(false);
        });

        it('should filter out hidden files', async () => {
            fs.promises.mkdir.mockResolvedValue(undefined);
            fs.promises.access.mockResolvedValue(undefined);
            fs.promises.readdir.mockResolvedValue(['hidden.mp3']);
            fs.promises.readFile.mockResolvedValue(JSON.stringify({ hidden: true }));

            await systemController.getAudioFiles(req, res);
            const files = res.json.mock.calls[0][0];
            expect(files.length).toBe(0);
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
            const res = systemController._toSortedArray(null);
            expect(res).toEqual([]);
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
            diagnosticsService.getTTSStatus.mockResolvedValue({ status: 'ok' });
            await systemController.getTTSStatus(req, res);
            expect(res.json).toHaveBeenCalledWith({ status: 'ok' });
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
        });
    });

    describe('validateUrl', () => {
        it('should validate with HEAD', async () => {
            axios.head.mockResolvedValue({ status: 200 });
            req.body = { url: 'http://test.com' };
            await systemController.validateUrl(req, res);
            expect(res.json).toHaveBeenCalledWith({ valid: true });
        });

        it('should validate with GET if HEAD fails', async () => {
            axios.head.mockRejectedValue(new Error('HEAD failed'));
            axios.get.mockResolvedValue({ status: 200 });
            req.body = { url: 'http://test.com' };
            await systemController.validateUrl(req, res);
            expect(res.json).toHaveBeenCalledWith({ valid: true });
        });

        it('should fail if both HEAD and GET fail', async () => {
            axios.head.mockRejectedValue(new Error('HEAD failed'));
            axios.get.mockRejectedValue(new Error('GET failed'));
            req.body = { url: 'http://test.com' };
            await systemController.validateUrl(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ valid: false }));
        });

        it('should handle axios error with response in GET fallback', async () => {
            axios.head.mockRejectedValue(new Error('HEAD failed'));
            axios.get.mockRejectedValue({ response: { status: 404 } });
            req.body = { url: 'http://test.com' };
            await systemController.validateUrl(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ valid: false, error: 'Status 404' }));
        });

        it('should reject missing URL', async () => {
            req.body = {};
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
            configService.get.mockReturnValue({ sources: {} });
            req.body = { target: 'primary' };
            await systemController.testSource(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should reject if backup disabled', async () => {
            configService.get.mockReturnValue({ sources: { backup: { enabled: false } } });
            req.body = { target: 'backup' };
            await systemController.testSource(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should test aladhan successfully', async () => {
            const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({ '01-01': {} }) };
            ProviderFactory.create.mockReturnValue(mockProvider);
            req.body = { target: 'primary' };
            await systemController.testSource(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource');
        });

        it('should test mymasjid successfully', async () => {
            const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({ '01-01': {} }) };
            ProviderFactory.create.mockReturnValue(mockProvider);
            req.body = { target: 'backup' };
            await systemController.testSource(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
            expect(healthCheck.refresh).toHaveBeenCalledWith('backupSource');
        });

        it('should fail on unsupported source type', async () => {
            ProviderFactory.create.mockImplementation(() => { throw new Error('Unknown provider type'); });
            req.body = { target: 'primary' };
            await systemController.testSource(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should handle fetch errors and refresh health anyway', async () => {
            const mockProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('Fetch error')) };
            ProviderFactory.create.mockReturnValue(mockProvider);
            req.body = { target: 'primary' };
            
            await expect(systemController.testSource(req, res)).rejects.toThrow('Fetch error');
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource');
        });

        it('should handle health refresh failure catch block', async () => {
            const mockProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('Fetch error')) };
            ProviderFactory.create.mockReturnValue(mockProvider);
            healthCheck.refresh.mockRejectedValue(new Error('Health refresh failed'));
            req.body = { target: 'primary' };
            
            await expect(systemController.testSource(req, res)).rejects.toThrow('Fetch error');
        });
    });

    describe('getStorageStatus', () => {
        it('should return storage status', async () => {
            const storageService = require('@services/system/storageService');
            jest.mock('@services/system/storageService', () => ({
                getUsage: jest.fn().mockResolvedValue({ total: 100, custom: 50, cache: 50 }),
                getSystemStats: jest.fn().mockResolvedValue(1000),
                calculateRecommendedLimit: jest.fn().mockReturnValue(0.5)
            }), { virtual: true });

            await systemController.getStorageStatus(req, res);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                usedBytes: 100,
                systemFreeBytes: 1000
            }));
        });
    });

    describe('getVoices', () => {
        it('should return voices from voiceService', async () => {
            const voices = [{ id: 'v1', name: 'Voice 1' }];
            voiceService.getVoices.mockReturnValue(voices);
            await systemController.getVoices(req, res);
            expect(res.json).toHaveBeenCalledWith(voices);
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
            audioAssetService.previewTTS.mockResolvedValue({ url: 'test.mp3' });
            await systemController.previewTTS(req, res);
            expect(res.json).toHaveBeenCalledWith({ url: 'test.mp3' });
        });

        it('should handle errors and return 500', async () => {
            req.body = { template: 'test', prayerKey: 'fajr', voice: 'v1' };
            audioAssetService.previewTTS.mockRejectedValue(new Error('Preview Error'));
            await systemController.previewTTS(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('cleanupTempTTS', () => {
        it('should call cleanup and return 200', async () => {
            await systemController.cleanupTempTTS(req, res);
            expect(audioAssetService.cleanupTempAudio).toHaveBeenCalledWith(true);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it('should handle errors and return 500', async () => {
            audioAssetService.cleanupTempAudio.mockRejectedValue(new Error('Cleanup Error'));
            await systemController.cleanupTempTTS(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe('runJob', () => {
        it('should return 400 if jobName is missing', async () => {
            req.body = {};
            await systemController.runJob(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should call schedulerService.runJob and return result', async () => {
            req.body = { jobName: 'testJob' };
            schedulerService.runJob.mockResolvedValue({ success: true });
            await systemController.runJob(req, res);
            expect(schedulerService.runJob).toHaveBeenCalledWith('testJob');
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it('should return 400 if scheduler returns failure', async () => {
            req.body = { jobName: 'testJob' };
            schedulerService.runJob.mockResolvedValue({ success: false, message: 'fail' });
            await systemController.runJob(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 500 on unexpected error', async () => {
            req.body = { jobName: 'testJob' };
            schedulerService.runJob.mockRejectedValue(new Error('Fatal'));
            await systemController.runJob(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });
});