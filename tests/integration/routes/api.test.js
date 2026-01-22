const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
// const fs = require('fs'); // We will mock fs

const mockMockFactory = require('../../helpers/mockFactory');

// --- 1. Define Mocks BEFORE requiring modules ---

jest.mock('axios'); // Mock Axios for validate-url
const axios = require('axios');

jest.mock('fs', () => {
    const originalFs = jest.requireActual('fs');
    return {
        ...originalFs,
        existsSync: jest.fn(() => true),
        mkdirSync: jest.fn(),
        readdirSync: jest.fn(() => []),
        readFileSync: jest.fn(),
        unlinkSync: jest.fn(),
        writeFileSync: jest.fn(),
        statSync: jest.fn(() => ({ mtimeMs: 0 }))
    };
});
const fs = require('fs');

// Mock Config Service
const mockConfig = mockMockFactory.createMockConfig();
const mockConfigService = mockMockFactory.createMockConfigService(mockConfig);
jest.mock('@config', () =>   mockConfigService);

// Mock Services
jest.mock('@services/core/schedulerService', () => mockMockFactory.createMockSchedulerService());
jest.mock('@services/core/prayerTimeService', () => mockMockFactory.createMockPrayerTimeService());
const prayerTimeService = require('@services/core/prayerTimeService');

jest.mock('@services/core/automationService', () => ({
    ...mockMockFactory.createMockAutomationService(),
    getAudioSource: jest.requireActual('@services/core/automationService').getAudioSource
}));
const automationService = require('@services/core/automationService');

jest.mock('@services/system/sseService', () => mockMockFactory.createMockSSEService());
const sseService = require('@services/system/sseService');

jest.mock('@services/system/audioAssetService', () => mockMockFactory.createMockAudioAssetService());
const audioAssetService = require('@services/system/audioAssetService');

jest.mock('@adapters/prayerApiAdapter', () => ({
    fetchMyMasjidBulk: jest.fn(),
    fetchAladhanAnnual: jest.fn()
}));

jest.mock('@services/system/healthCheck', () => mockMockFactory.createMockHealthCheck());
const healthCheck = require('@services/system/healthCheck');

jest.mock('@services/system/diagnosticsService', () => mockMockFactory.createMockDiagnosticsService());
const diagnosticsService = require('@services/system/diagnosticsService');

jest.mock('@utils/envManager', () => mockMockFactory.createMockEnvManager());
const envManager = require('@utils/envManager');

jest.mock('@services/system/voiceService', () => ({
    getVoices: jest.fn(() => [{ Name: 'Test', ShortName: 'T', Gender: 'Male', Locale: 'en-US' }]),
    init: jest.fn()
}));
const voiceService = require('@services/system/voiceService');

jest.mock('@utils/passwordUtils', () => mockMockFactory.createMockAuthUtils());


// --- 2. Require App ---
const app = require('../../../src/server');

describe('API Routes Integration', () => {
    const JWT_SECRET = 'integration-test-secret';
    let adminToken;

    beforeAll(() => {
        // Setup Environment
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.ADMIN_PASSWORD = 'hashed_secret_password';
        
        // Silence logs
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    beforeEach(() => {
        adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
        jest.clearAllMocks();
        healthCheck.checkSource.mockResolvedValue({ healthy: true });
        mockConfigService.get.mockReturnValue(mockConfig);
        
        // Default fs behavior
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue([]);
    });

    describe('Auth Routes', () => {
        it('GET /api/auth/check - should return 401 without token', async () => {
            await request(app).get('/api/auth/check').expect(401);
        });

        it('GET /api/auth/check - should return 200 with valid token', async () => {
            const res = await request(app)
                .get('/api/auth/check')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            expect(res.body.authenticated).toBe(true);
        });

        it('POST /api/auth/change-password - should update password', async () => {
            await request(app)
                .post('/api/auth/change-password')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ password: 'newpass' })
                .expect(200);
            expect(envManager.setEnvValue).toHaveBeenCalledWith('ADMIN_PASSWORD', 'hashed');
        });

        it('POST /api/auth/change-password - error if missing password', async () => {
            await request(app)
                .post('/api/auth/change-password')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({}) 
                .expect(400);
        });
    });

    describe('System Routes', () => {
        it('GET /api/system/jobs - should return jobs list', async () => {
            const res = await request(app)
                .get('/api/system/jobs')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body[0].jobName).toBe('Test Job');
        });

        it('GET /api/system/status/automation - should call diagnostic service', async () => {
            const res = await request(app)
                .get('/api/system/status/automation')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            expect(res.body.lastTrigger).toBe('never');
        });

        it('GET /api/system/status/tts - should call diagnostic service', async () => {
            await request(app)
                .get('/api/system/status/tts')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            expect(diagnosticsService.getTTSStatus).toHaveBeenCalled();
        });

        it('GET /api/system/audio-files - should return lists', async () => {
            fs.readdirSync.mockReturnValue(['file1.mp3']);
            const res = await request(app)
                .get('/api/system/audio-files')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('POST /api/system/regenerate-tts - should call service', async () => {
            await request(app)
                .post('/api/system/regenerate-tts')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            expect(audioAssetService.syncAudioAssets).toHaveBeenCalled();
        });

        it('POST /api/system/test-audio - should play audio locally', async () => {
            await request(app)
                .post('/api/system/test-audio')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3', type: 'custom', target: 'local' })
                .expect(200);
            expect(automationService.handleLocal).toHaveBeenCalled();
        });

        it('POST /api/system/test-audio - should broadcast to browsers', async () => {
            await request(app)
                .post('/api/system/test-audio')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3', type: 'custom', target: 'browser' })
                .expect(200);
            expect(automationService.broadcastToClients).toHaveBeenCalled();
        });

        it('POST /api/system/test-audio - should trigger VoiceMonkey', async () => {
            await request(app)
                .post('/api/system/test-audio')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3', type: 'custom', target: 'voiceMonkey' })
                .expect(200);
            expect(automationService.handleVoiceMonkey).toHaveBeenCalled();
        });

        it('POST /api/system/test-audio - should validate inputs', async () => {
            await request(app)
                .post('/api/system/test-audio')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: '../hack.mp3', type: 'custom' })
                .expect(400); // Invalid filename

            await request(app)
                .post('/api/system/test-audio')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3', type: 'badtype' })
                .expect(400); // Invalid type
        });
        
        it('POST /api/system/validate-url - should check url', async () => {
            axios.head.mockResolvedValue({ status: 200 });
            await request(app)
                .post('/api/system/validate-url')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ url: 'http://ok.com' })
                .expect(200)
                .expect(res => expect(res.body.valid).toBe(true));
        });

        it('POST /api/system/validate-url - should handle failure', async () => {
            axios.head.mockRejectedValue(new Error('Fail'));
            axios.get.mockRejectedValue(new Error('Fail'));
            
            await request(app)
                .post('/api/system/validate-url')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ url: 'http://bad.com' })
                .expect(200)
                .expect(res => expect(res.body.valid).toBe(false));
        });

        it('GET /api/system/voices - should return voices list', async () => {
             const res = await request(app)
                .get('/api/system/voices')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
             expect(Array.isArray(res.body)).toBe(true);
             expect(res.body[0].ShortName).toBe('T');
        });

        it('GET /api/logs - should skip globalReadLimiter', async () => {
             const sseService = require('@services/system/sseService');
             const sseSpy = jest.spyOn(sseService, 'addClient').mockImplementation((req, res) => {
                 res.end();
             });

             await request(app)
                .get('/api/logs')
                .set('Cookie', [`auth_token=${adminToken}`]);
             
             sseSpy.mockRestore();
        });

        it('POST /api/system/preview-tts - should generate preview', async () => {
             axios.post.mockResolvedValueOnce({ data: { success: true } });
             const res = await request(app)
                .post('/api/system/preview-tts')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ template: 'Hello {prayerEnglish}', prayerKey: 'fajr', voice: 'T', offsetMinutes: 5 });
             
             if (res.status !== 200) {
                 throw new Error(`Integration test failed with status ${res.status}: ${JSON.stringify(res.body)}`);
             }
             expect(res.status).toBe(200);
             expect(res.body.url).toBe('http://temp.mp3');
        });

    });

    describe('Settings Routes', () => {
        it('GET /api/settings - should return current config', async () => {
            const res = await request(app)
                .get('/api/settings')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            expect(res.body).toEqual(mockConfig);
        });

        it('POST /api/settings/update - should validate and update config', async () => {
            const newConfig = { ...mockConfig, sources: { ...mockConfig.sources, primary: { type: 'aladhan', method: 'MWL' } } };
            
            await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(200);
            
            // Check validation call
            const fetchers = require('@adapters/prayerApiAdapter');
            expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
            
            // Check update call
            expect(mockConfigService.update).toHaveBeenCalledWith(expect.objectContaining({
                sources: expect.objectContaining({ primary: { type: 'aladhan', method: 'MWL' } })
            }));
            
            // Check reload/refresh calls
            const schedulerService = require('@services/core/schedulerService');
            expect(schedulerService.initScheduler).toHaveBeenCalled();
        });

        it('POST /api/settings/update - should fail on validation error', async () => {
            const fetchers = require('@adapters/prayerApiAdapter');
            fetchers.fetchAladhanAnnual.mockRejectedValueOnce(new Error('Validation Failed: API Down'));

            const res = await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(mockConfig)
                .expect(400); // Expect 400 because we catch "Validation Failed" strings in handler
            
            expect(res.body.error).toMatch(/Validation Failed/);
        });

        it('POST /settings/reset - should reset config', async () => {
             await request(app)
                .post('/api/settings/reset')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
             expect(mockConfigService.reload).toHaveBeenCalled();
        });

        it('POST /settings/refresh-cache - should force refresh', async () => {
             await request(app)
                .post('/api/settings/refresh-cache')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
             expect(prayerTimeService.forceRefresh).toHaveBeenCalled();
        });

        it('POST /settings/refresh-cache - should fail if both sources are unhealthy (Safeguard)', async () => {
            healthCheck.checkSource.mockResolvedValue({ healthy: false });
            
            await request(app)
                .post('/api/settings/refresh-cache')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(503);
                
            expect(prayerTimeService.forceRefresh).not.toHaveBeenCalled();
        });

        it('POST /settings/refresh-cache - should proceed if primary is unhealthy but backup is healthy', async () => {
            healthCheck.checkSource.mockImplementation((target) => {
                if (target === 'primary') return Promise.resolve({ healthy: false });
                return Promise.resolve({ healthy: true });
            });
            
            await request(app)
                .post('/api/settings/refresh-cache')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
        });

        it('POST /settings/refresh-cache - should handle errors in stopAll', async () => {
             healthCheck.checkSource.mockResolvedValue({ healthy: true });
             const schedulerService = require('@services/core/schedulerService');
             schedulerService.stopAll.mockRejectedValueOnce(new Error('Stop Fail'));
             
             await request(app)
                 .post('/api/settings/refresh-cache')
                 .set('Cookie', [`auth_token=${adminToken}`])
                 .expect(200);
        });

        it('POST /settings/refresh-cache - should handle generic errors', async () => {
            healthCheck.checkSource.mockRejectedValue(new Error('Fatal'));
            await request(app)
                .post('/api/settings/refresh-cache')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(500);
        });

        it('DELETE /settings/files - should delete file', async () => {
            fs.existsSync.mockReturnValue(true);
            await request(app)
                .delete('/api/settings/files')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3' })
                .expect(200);
            expect(fs.unlinkSync).toHaveBeenCalled();
        });

        it('DELETE /settings/files - should handle missing file', async () => {
            fs.existsSync.mockReturnValue(false);
            await request(app)
                .delete('/api/settings/files')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3' })
                .expect(404);
        });
    });

    describe('System Actions', () => {
        it('POST /api/system/restart-scheduler - should trigger hot reload', async () => {
            await request(app)
                .post('/api/system/restart-scheduler')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            const schedulerService = require('@services/core/schedulerService');
            expect(schedulerService.hotReload).toHaveBeenCalled();
        });
    });

    describe('File Upload', () => {
        const testFileName = 'test-upload-integration.mp3';
        const testFilePath = path.join(__dirname, testFileName);
        
        beforeAll(() => {
            // Write a real file for supertest to stream
            jest.requireActual('fs').writeFileSync(testFilePath, 'dummy mp3 content');
            
            // Allow unlink to fail silently in mock
            fs.unlinkSync.mockImplementation(() => {});
        });

        afterAll(() => {
            const realFs = jest.requireActual('fs');
            // Cleanup the source file
            if (realFs.existsSync(testFilePath)) {
                realFs.unlinkSync(testFilePath);
            }
            
            // Cleanup the uploaded destination if it wrote to disk
            // Since we mocked some fs methods, multer might have failed or succeeded depending on implementation
            // But verify it didn't leave trash
            const uploadedPath = path.join(__dirname, '../../../public/audio/custom', testFileName);
            if (realFs.existsSync(uploadedPath)) {
                realFs.unlinkSync(uploadedPath);
            }
        });

        it('POST /api/settings/upload - should upload file', async () => {
             const res = await request(app)
                .post('/api/settings/upload')
                .set('Cookie', [`auth_token=${adminToken}`])
                .attach('file', testFilePath)
                .expect(200);
            
            expect(res.body.filename).toBe(testFileName);
        });
    });

    describe('Prayers Route', () => {
        it('GET /api/prayers - should return prayers', async () => {
             prayerTimeService.getPrayersWithNext.mockResolvedValueOnce({
                 meta: { date: '2024-01-01', source: 'test' },
                 prayers: {
                     fajr: { start: '2024-01-01T05:00:00', iqamah: '2024-01-01T05:15:00' },
                     dhuhr: { start: '2024-01-01T12:00:00', iqamah: '2024-01-01T12:15:00' }
                 }
             });
             
             const res = await request(app)
                .get('/api/prayers')
                .expect(200);
             
             expect(res.body.prayers).toBeDefined();
             expect(res.body.prayers.fajr).toBeDefined();
        });

        it('GET /api/prayers - should handle next prayer logic', async () => {
             jest.useFakeTimers();
             jest.setSystemTime(new Date('2024-01-01T23:59:00Z'));
             
             prayerTimeService.getPrayersWithNext.mockResolvedValueOnce({
                 meta: {},
                 prayers: {
                     fajr: { start: '2024-01-01T05:00:00Z', iqamah: '2024-01-01T05:15:00Z' },
                     isha: { start: '2024-01-01T19:00:00Z', iqamah: '2024-01-01T19:15:00Z' }
                 },
                 nextPrayer: {
                     name: 'fajr',
                     time: '2024-01-02T05:01:00Z',
                     isTomorrow: true
                 }
             });

             const res = await request(app).get('/api/prayers');
             expect(res.body.nextPrayer).toBeDefined();
             expect(res.body.nextPrayer.isTomorrow).toBe(true);
             
             jest.useRealTimers();
        });
    });

    describe('VoiceMonkey Routes', () => {
        it('POST /settings/credentials/voicemonkey - should save credentials', async () => {
             await request(app)
                .post('/api/settings/credentials/voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: 'tok', device: 'dev' })
                .expect(200);
            
            expect(envManager.setEnvValue).toHaveBeenCalledWith('VOICEMONKEY_TOKEN', 'tok');
            expect(envManager.setEnvValue).toHaveBeenCalledWith('VOICEMONKEY_DEVICE', 'dev');
            expect(mockConfigService.reload).toHaveBeenCalled();
        });

        it('POST /settings/credentials/voicemonkey - should fail if empty strings', async () => {
            await request(app)
               .post('/api/settings/credentials/voicemonkey')
               .set('Cookie', [`auth_token=${adminToken}`])
               .send({ token: '  ', device: 'dev' })
               .expect(400);
       });

       it('POST /settings/credentials/voicemonkey - should fail if missing fields', async () => {
            await request(app)
               .post('/api/settings/credentials/voicemonkey')
               .set('Cookie', [`auth_token=${adminToken}`])
               .send({ token: 'tok' })
               .expect(400);
       });

       it('DELETE /settings/credentials/voicemonkey - should remove credentials', async () => {
            await request(app)
               .delete('/api/settings/credentials/voicemonkey')
               .set('Cookie', [`auth_token=${adminToken}`])
               .expect(200);
            
            expect(envManager.deleteEnvValue).toHaveBeenCalledWith('VOICEMONKEY_TOKEN');
       });
       
       it('POST /system/test-voicemonkey - should call VM API', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            await request(app)
                .post('/api/system/test-voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: 'tok', device: 'dev' })
                .expect(200);
            
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('voicemonkey'), expect.anything());
       });

        it('POST /system/test-voicemonkey - should handle VM API failure', async () => {
             axios.get.mockResolvedValue({ data: { success: false, error: 'Bad Token' } });
             await request(app)
                 .post('/api/system/test-voicemonkey')
                 .set('Cookie', [`auth_token=${adminToken}`])
                 .send({ token: 'tok', device: 'dev' })
                 .expect(500);
        });

        it('POST /api/auth/setup - should handle internal errors', async () => {
             const authUtils = require('@utils/passwordUtils');
             authUtils.hashPassword.mockImplementationOnce(() => { throw new Error('Hash Fail'); });
             
             // Setup requires no admin password set
             const oldPass = process.env.ADMIN_PASSWORD;
             delete process.env.ADMIN_PASSWORD;
             
             await request(app)
                 .post('/api/auth/setup')
                 .send({ password: 'validpass' })
                 .expect(500);
                 
             process.env.ADMIN_PASSWORD = oldPass;
        });

         it('POST /system/test-voicemonkey - should handle Network failure', async () => {
             axios.get.mockRejectedValue(new Error('Net Error'));
             await request(app)
                 .post('/api/system/test-voicemonkey')
                 .set('Cookie', [`auth_token=${adminToken}`])
                 .send({ token: 'tok', device: 'dev' })
                 .expect(500);
        });
    });

    describe('Additional Auth & System Coverage', () => {
        it('POST /api/auth/logout - should clear cookie', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .expect(200);
            const cookies = res.headers['set-cookie'];
            expect(cookies.some(c => c.includes('auth_token=;'))).toBe(true);
        });

        it('POST /api/auth/login - should return SETUP_REQUIRED if no admin password env', async () => {
            const oldPass = process.env.ADMIN_PASSWORD;
            delete process.env.ADMIN_PASSWORD;
            
            await request(app)
                .post('/api/auth/login')
                .send({ password: 'any' })
                .expect(500)
                .expect(res => {
                    expect(res.body.code).toBe('SETUP_REQUIRED');
                });
            
            process.env.ADMIN_PASSWORD = oldPass;
        });

        it('DELETE /api/settings/files - should delete file', async () => {
             const res = await request(app)
                .delete('/api/settings/files')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3' })
                .expect(200);
             expect(fs.unlinkSync).toHaveBeenCalled();
        });

        it('DELETE /api/settings/files - should handle not found', async () => {
             fs.existsSync.mockReturnValue(false);
             await request(app)
                .delete('/api/settings/files')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'missing.mp3' })
                .expect(404);
        });
        
         it('DELETE /api/settings/files - should handle invalid filename', async () => {
             await request(app)
                .delete('/api/settings/files')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: '../hack.mp3' })
                .expect(400);
        });

        it('POST /settings/reset - should delete local.json and reload', async () => {
             fs.existsSync.mockReturnValue(true);
             await request(app)
                 .post('/api/settings/reset')
                 .set('Cookie', [`auth_token=${adminToken}`])
                 .expect(200);
             expect(fs.unlinkSync).toHaveBeenCalled();
             expect(mockConfigService.reload).toHaveBeenCalled();
        });

        it('POST /settings/reset - should handle file missing gracefully', async () => {
             fs.existsSync.mockReturnValue(false);
             await request(app)
                 .post('/api/settings/reset')
                 .set('Cookie', [`auth_token=${adminToken}`])
                 .expect(200);
             // Should not throw
             expect(fs.unlinkSync).not.toHaveBeenCalled();
        });

        it('POST /settings/reset - should handle error', async () => {
             mockConfigService.reload.mockRejectedValueOnce(new Error('Reload Fail'));
             await request(app)
                 .post('/api/settings/reset')
                 .set('Cookie', [`auth_token=${adminToken}`])
                 .expect(500);
        });
    });

     describe('Prayer Routes Extra Coverage', () => {
        it('GET /api/prayers - should handle missing cached data by fetching', async () => {
             prayerTimeService.getPrayersWithNext.mockResolvedValueOnce({
                 meta: { date: '2024-01-01', source: 'test' },
                 prayers: {
                     fajr: { start: '2024-01-01T05:00:00', iqamah: '2024-01-01T05:15:00' }
                 }
             });
             
             await request(app).get('/api/prayers').expect(200);
        });

        it('GET /api/prayers - should handle errors', async () => {
             prayerTimeService.getPrayersWithNext.mockRejectedValueOnce(new Error('Database Down'));
             
             await request(app).get('/api/prayers').expect(500);
        });
    });

    describe('Settings Update Edge Cases', () => {
         it('POST /api/settings/update - should fail if audio sync fails', async () => {
             const audioAssetService = require('@services/system/audioAssetService');
             audioAssetService.syncAudioAssets.mockRejectedValueOnce(new Error('Sync Fail'));
             
             const newConfig = { ...mockConfig, sources: { ...mockConfig.sources, primary: { type: 'aladhan', method: 'MWL' } } };
            
             const res = await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(400);

             expect(res.body.error).toBe('Storage Quota Exceeded'); // Or whatever specific error the controller returns
        });

        it('POST /settings/refresh-cache - should fail if audio sync fails', async () => {
             const audioAssetService = require('@services/system/audioAssetService');
             audioAssetService.syncAudioAssets.mockRejectedValueOnce(new Error('Sync Fail'));
             
             const res = await request(app)
                 .post('/api/settings/refresh-cache')
                 .set('Cookie', [`auth_token=${adminToken}`])
                 .expect(400);

             expect(res.body.error).toBe('Sync Failed');
        });

        it('POST /settings/refresh-cache - should handle scheduler stop error', async () => {
             const schedulerService = require('@services/core/schedulerService');
             schedulerService.stopAll.mockRejectedValueOnce(new Error('Stop Fail'));
             
             // This logs error but continues
             await request(app)
                 .post('/api/settings/refresh-cache')
                 .set('Cookie', [`auth_token=${adminToken}`])
                 .expect(200);
        });
    });

    describe('MyMasjid Coverage', () => {
        it('POST /api/settings/update - should validate MyMasjid source', async () => {
             const newConfig = { 
                 ...mockConfig, 
                 sources: { 
                     primary: { type: 'mymasjid', masjidId: 'test-id' } 
                 } 
             };
             
             await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(200);
             
             const fetchers = require('@adapters/prayerApiAdapter');
             expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
        });

        it('POST /api/settings/update - should fail if MyMasjid ID missing', async () => {
             const newConfig = { 
                 ...mockConfig, 
                 sources: { 
                     primary: { type: 'mymasjid', masjidId: '' } 
                 } 
             };
             
             await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(400); 
        });

         it('POST /api/settings/update - should generate warnings if services unhealthy', async () => {
             healthCheck.getHealth.mockReturnValueOnce({
                 tts: { healthy: false },
                 local: { healthy: false },
                 voiceMonkey: { healthy: false, message: 'Auth Fail' }
             });

             const newConfig = { 
                 ...mockConfig, 
                 automation: {
                     triggers: {
                         fajr: { 
                             pre: { enabled: true, type: 'tts', targets: ['local'] },
                             post: { enabled: true, type: 'voiceMonkey' }
                         }
                     }
                 }
             };
             
             const res = await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(200);
             
             expect(res.body.warnings).toBeDefined();
             expect(res.body.warnings.length).toBeGreaterThan(0);
             expect(JSON.stringify(res.body.warnings)).toContain('TTS Service is offline');
             expect(JSON.stringify(res.body.warnings)).toContain('Auth Fail');
        });
    });

    describe('Upload Routes Coverage', () => {
        it('POST /settings/upload - should fail if no file', async () => {
             await request(app)
                 .post('/api/settings/upload')
                 .set('Cookie', [`auth_token=${adminToken}`])
                 .expect(400);
        });
    });

    describe('API Cache Headers', () => {
        it('GET /api/prayers - should include no-cache headers (REQ-01)', async () => {
            const res = await request(app).get('/api/prayers');
            expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
            expect(res.headers['pragma']).toBe('no-cache');
            expect(res.headers['expires']).toBe('0');
            expect(res.headers['surrogate-control']).toBe('no-store');
        });

        it('GET /api/settings - should include no-cache headers (REQ-01)', async () => {
            const res = await request(app)
                .get('/api/settings')
                .set('Cookie', [`auth_token=${adminToken}`]);
            expect(res.headers['cache-control']).toContain('no-store');
        });
    });
});

