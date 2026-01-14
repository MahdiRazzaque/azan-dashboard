const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
// const fs = require('fs'); // We will mock fs

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
const mockConfig = {
    sources: { 
        primary: { type: 'aladhan', method: 'ISNA' }, 
        backup: { type: 'calculational' } 
    },
    location: { 
        coordinates: { lat: 51.5, long: -0.1 },
        timezone: 'Europe/London'
    },
    timings: {
        fajr: { angle: 18 },
        isha: { angle: 18 }
    },
    prayers: {
        fajr: {}, dhuhr: {}, asr: {}, maghrib: {}, isha: {}
    }
};

const mockConfigService = {
    get: jest.fn(() => mockConfig),
    update: jest.fn(),
    reload: jest.fn(),
    init: jest.fn()
};
jest.mock('../../../src/config', () => mockConfigService);

// Mock Services
jest.mock('../../../src/services/schedulerService', () => ({
    initScheduler: jest.fn(),
    hotReload: jest.fn(),
    getJobs: jest.fn(() => [
        { jobName: 'Test Job', nextInvocation: '2024-01-01T00:00:00.000Z' }
    ]),
    stopAll: jest.fn()
}));

jest.mock('../../../src/services/prayerTimeService', () => ({
    getPrayerTimes: jest.fn(),
    forceRefresh: jest.fn(() => Promise.resolve({ meta: { success: true, timestamp: Date.now() } }))
}));
const prayerTimeService = require('../../../src/services/prayerTimeService');

jest.mock('../../../src/services/automationService', () => ({
    playTestAudio: jest.fn(),
    triggerEvents: jest.fn()
}));
const automationService = require('../../../src/services/automationService');

jest.mock('../../../src/services/audioAssetService', () => ({
    prepareDailyAssets: jest.fn()
}));
const audioAssetService = require('../../../src/services/audioAssetService');

jest.mock('../../../src/services/fetchers', () => ({
    fetchMyMasjidBulk: jest.fn(),
    fetchAladhanAnnual: jest.fn()
}));

jest.mock('../../../src/services/diagnosticsService', () => ({
    getAutomationStatus: jest.fn(() => Promise.resolve({ lastTrigger: 'never' })),
    getTTSStatus: jest.fn(() => Promise.resolve({ status: 'ok' }))
}));
const diagnosticsService = require('../../../src/services/diagnosticsService');

// Mock EnvManager
jest.mock('../../../src/utils/envManager', () => ({
    isConfigured: jest.fn(() => true),
    setEnvValue: jest.fn(),
    generateSecret: jest.fn(() => 'gen-secret'),
    getEnv: jest.fn(() => ({}))
}));
const envManager = require('../../../src/utils/envManager');

// Mock Auth Utils
jest.mock('../../../src/utils/auth', () => ({
    hashPassword: jest.fn(() => 'hashed'),
    verifyPassword: jest.fn(() => true) 
}));


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
            expect(audioAssetService.prepareDailyAssets).toHaveBeenCalled();
        });

        it('POST /api/system/test-audio - should play audio', async () => {
            await request(app)
                .post('/api/system/test-audio')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3', type: 'custom' })
                .expect(200);
            expect(automationService.playTestAudio).toHaveBeenCalled();
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
            const fetchers = require('../../../src/services/fetchers');
            expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
            
            // Check update call
            expect(mockConfigService.update).toHaveBeenCalledWith(expect.objectContaining({
                sources: expect.objectContaining({ primary: { type: 'aladhan', method: 'MWL' } })
            }));
            
            // Check reload/refresh calls
            const schedulerService = require('../../../src/services/schedulerService');
            expect(schedulerService.initScheduler).toHaveBeenCalled();
        });

        it('POST /api/settings/update - should fail on validation error', async () => {
            const fetchers = require('../../../src/services/fetchers');
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
            
            const schedulerService = require('../../../src/services/schedulerService');
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
             prayerTimeService.getPrayerTimes.mockResolvedValue({
                 meta: { date: '2024-01-01', source: 'test' },
                 prayers: {
                     fajr: '2024-01-01T05:00:00',
                     dhuhr: '2024-01-01T12:00:00',
                     iqamah: {}
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
             
             // First call (today) returns finished prayers
             // Second call (tomorrow) returns next fajr
             prayerTimeService.getPrayerTimes
                 .mockResolvedValueOnce({
                     meta: {},
                     prayers: {
                         fajr: '2024-01-01T05:00:00Z',
                         isha: '2024-01-01T19:00:00Z'
                     }
                 })
                 .mockResolvedValueOnce({
                     meta: {},
                     prayers: {
                         fajr: '2024-01-02T05:01:00Z'
                     }
                 });

             const res = await request(app).get('/api/prayers');
             expect(res.body.nextPrayer).toBeDefined();
             expect(res.body.nextPrayer.isTomorrow).toBe(true);
             
             jest.useRealTimers();
        });
    });
});
