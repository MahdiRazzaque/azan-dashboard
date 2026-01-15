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
    syncAudioAssets: jest.fn()
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
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.ADMIN_PASSWORD = 'hashed_secret_password';
        adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
        jest.clearAllMocks();
        mockConfigService.get.mockReturnValue(mockConfig);
        
        // Default fs behavior
        fs.existsSync.mockReturnValue(true);
        fs.readdirSync.mockReturnValue([]);
    });

    describe('Auth Routes', () => {
        it('GET /api/auth/status - should report configured status', async () => {
            envManager.isConfigured.mockReturnValue(true);
            const res = await request(app).get('/api/auth/status').expect(200);
            expect(res.body.configured).toBe(true);
        });

        it('POST /api/auth/setup - should reject if already configured', async () => {
            process.env.ADMIN_PASSWORD = 'existing';
            const res = await request(app)
                .post('/api/auth/setup')
                .send({ password: 'newpass' })
                .expect(403);
            expect(res.body.error).toMatch(/already configured/);
        });

        it('POST /api/auth/setup - should reject short passwords', async () => {
            delete process.env.ADMIN_PASSWORD;
            await request(app)
                .post('/api/auth/setup')
                .send({ password: '123' })
                .expect(400);
        });

        it('POST /api/auth/setup - should set password and auto-login', async () => {
            delete process.env.ADMIN_PASSWORD;
            delete process.env.JWT_SECRET;
            
            const res = await request(app)
                .post('/api/auth/setup')
                .send({ password: 'validpassword' })
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(envManager.setEnvValue).toHaveBeenCalledWith('ADMIN_PASSWORD', 'hashed');
            expect(envManager.generateSecret).toHaveBeenCalled();
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('POST /api/auth/setup - should handle setup errors', async () => {
            delete process.env.ADMIN_PASSWORD;
            envManager.setEnvValue.mockImplementationOnce(() => {
                throw new Error('Write failed');
            });
            
            await request(app)
                .post('/api/auth/setup')
                .send({ password: 'validpassword' })
                .expect(500);
        });

        it('POST /api/auth/login - should reject if not configured', async () => {
            delete process.env.ADMIN_PASSWORD;
            const res = await request(app)
                .post('/api/auth/login')
                .send({ password: 'anypassword' })
                .expect(500);
            expect(res.body.code).toBe('SETUP_REQUIRED');
        });

        it('POST /api/auth/login - should accept correct password', async () => {
            process.env.ADMIN_PASSWORD = 'hashed';
            process.env.JWT_SECRET = 'secret';
            const authUtils = require('../../../src/utils/auth');
            authUtils.verifyPassword.mockReturnValue(true);
            
            const res = await request(app)
                .post('/api/auth/login')
                .send({ password: 'correctpass' })
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(res.headers['set-cookie']).toBeDefined();
        });

        it('POST /api/auth/login - should reject incorrect password', async () => {
            process.env.ADMIN_PASSWORD = 'hashed';
            const authUtils = require('../../../src/utils/auth');
            authUtils.verifyPassword.mockReturnValue(false);
            
            await request(app)
                .post('/api/auth/login')
                .send({ password: 'wrongpass' })
                .expect(401);
        });

        it('POST /api/auth/logout - should clear cookie', async () => {
            const res = await request(app)
                .post('/api/auth/logout')
                .expect(200);
            expect(res.body.success).toBe(true);
        });

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

        it('POST /api/auth/change-password - should handle errors', async () => {
            envManager.setEnvValue.mockImplementationOnce(() => {
                throw new Error('Write failed');
            });
            
            await request(app)
                .post('/api/auth/change-password')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ password: 'newpass' })
                .expect(500);
        });
    });

    describe('System Routes', () => {
        it('GET /api/system/health - should return health status', async () => {
            const healthCheck = require('../../../src/services/healthCheck');
            healthCheck.getHealth = jest.fn(() => ({ overall: 'healthy' }));
            
            const res = await request(app)
                .get('/api/system/health')
                .expect(200);
            expect(res.body.overall).toBe('healthy');
        });

        it('POST /api/system/health/refresh - should refresh health checks', async () => {
            const healthCheck = require('../../../src/services/healthCheck');
            healthCheck.refresh = jest.fn(() => Promise.resolve({ status: 'refreshed' }));
            
            const res = await request(app)
                .post('/api/system/health/refresh')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ target: 'tts', mode: 'loud' })
                .expect(200);
            
            expect(healthCheck.refresh).toHaveBeenCalledWith('tts', 'loud');
            expect(res.body.status).toBe('refreshed');
        });

        it('POST /api/system/health/refresh - should handle errors', async () => {
            const healthCheck = require('../../../src/services/healthCheck');
            healthCheck.refresh = jest.fn(() => Promise.reject(new Error('Refresh failed')));
            
            await request(app)
                .post('/api/system/health/refresh')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({})
                .expect(500);
        });

        it('GET /api/system/jobs - should return empty if getJobs undefined', async () => {
            const schedulerService = require('../../../src/services/schedulerService');
            delete schedulerService.getJobs;
            
            const res = await request(app)
                .get('/api/system/jobs')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            expect(res.body).toEqual({ maintenance: [], automation: [] });
            
            // Restore mock
            schedulerService.getJobs = jest.fn(() => []);
        });

        it('GET /api/system/jobs - should return jobs list', async () => {
            const schedulerService = require('../../../src/services/schedulerService');
            schedulerService.getJobs = jest.fn(() => [
                { jobName: 'Test Job', nextInvocation: '2024-01-01T00:00:00.000Z' }
            ]);
            
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

        it('GET /api/system/status/automation - should handle errors', async () => {
            diagnosticsService.getAutomationStatus.mockRejectedValueOnce(new Error('Failed'));
            
            await request(app)
                .get('/api/system/status/automation')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(500);
        });

        it('GET /api/system/status/tts - should call diagnostic service', async () => {
            await request(app)
                .get('/api/system/status/tts')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            expect(diagnosticsService.getTTSStatus).toHaveBeenCalled();
        });

        it('GET /api/system/status/tts - should handle errors', async () => {
            diagnosticsService.getTTSStatus.mockRejectedValueOnce(new Error('Failed'));
            
            await request(app)
                .get('/api/system/status/tts')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(500);
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

        it('POST /api/system/regenerate-tts - should handle errors', async () => {
            audioAssetService.syncAudioAssets.mockRejectedValueOnce(new Error('TTS failed'));
            
            await request(app)
                .post('/api/system/regenerate-tts')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(500);
        });

        it('POST /api/system/restart-scheduler - should trigger hot reload', async () => {
            await request(app)
                .post('/api/system/restart-scheduler')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            const schedulerService = require('../../../src/services/schedulerService');
            expect(schedulerService.hotReload).toHaveBeenCalled();
        });

        it('POST /api/system/restart-scheduler - should handle errors', async () => {
            const schedulerService = require('../../../src/services/schedulerService');
            schedulerService.hotReload.mockRejectedValueOnce(new Error('Reload failed'));
            
            await request(app)
                .post('/api/system/restart-scheduler')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(500);
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

        it('POST /api/system/test-audio - should handle missing file', async () => {
            fs.existsSync.mockReturnValue(false);
            
            await request(app)
                .post('/api/system/test-audio')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'missing.mp3', type: 'custom' })
                .expect(404);
        });

        it('POST /api/system/test-audio - should handle playback errors', async () => {
            fs.existsSync.mockReturnValue(true);
            automationService.playTestAudio.mockImplementationOnce(() => {
                throw new Error('Playback failed');
            });
            
            await request(app)
                .post('/api/system/test-audio')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3', type: 'custom' })
                .expect(500);
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

        it('POST /api/system/validate-url - should fallback to GET on HEAD failure', async () => {
            axios.head.mockRejectedValue(new Error('HEAD blocked'));
            axios.get.mockResolvedValue({ status: 200 });
            
            await request(app)
                .post('/api/system/validate-url')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ url: 'http://ok.com' })
                .expect(200)
                .expect(res => expect(res.body.valid).toBe(true));
        });

        it('POST /api/system/test-voicemonkey - should test VoiceMonkey credentials', async () => {
            axios.get.mockResolvedValue({ data: { success: true } });
            
            const res = await request(app)
                .post('/api/system/test-voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: 'testtoken', device: 'testdevice' })
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(axios.get).toHaveBeenCalledWith(
                'https://api-v2.voicemonkey.io/announcement',
                expect.objectContaining({
                    params: { token: 'testtoken', device: 'testdevice', text: 'Test' }
                })
            );
        });

        it('POST /api/system/test-voicemonkey - should handle missing credentials', async () => {
            await request(app)
                .post('/api/system/test-voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: 'testtoken' })
                .expect(400);
        });

        it('POST /api/system/test-voicemonkey - should handle API failures', async () => {
            axios.get.mockResolvedValue({ data: { success: false, error: 'Invalid token' } });
            
            await request(app)
                .post('/api/system/test-voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: 'badtoken', device: 'testdevice' })
                .expect(500);
        });

        it('POST /api/system/test-voicemonkey - should handle network errors', async () => {
            axios.get.mockRejectedValue({ response: { data: { error: 'Network error' } }, message: 'Timeout' });
            
            await request(app)
                .post('/api/system/test-voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: 'testtoken', device: 'testdevice' })
                .expect(400);
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

        it('POST /api/settings/upload - should handle missing file', async () => {
            await request(app)
                .post('/api/settings/upload')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(400);
        });

        it('POST /api/settings/credentials/voicemonkey - should save credentials', async () => {
            const res = await request(app)
                .post('/api/settings/credentials/voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: 'mytoken', device: 'mydevice' })
                .expect(200);
            
            expect(envManager.setEnvValue).toHaveBeenCalledWith('VOICEMONKEY_TOKEN', 'mytoken');
            expect(envManager.setEnvValue).toHaveBeenCalledWith('VOICEMONKEY_DEVICE', 'mydevice');
            expect(mockConfigService.reload).toHaveBeenCalled();
            expect(res.body.success).toBe(true);
        });

        it('POST /api/settings/credentials/voicemonkey - should validate empty strings', async () => {
            await request(app)
                .post('/api/settings/credentials/voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: '  ', device: 'mydevice' })
                .expect(400);
        });

        it('POST /api/settings/credentials/voicemonkey - should handle missing fields', async () => {
            await request(app)
                .post('/api/settings/credentials/voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: 'mytoken' })
                .expect(400);
        });

        it('POST /api/settings/credentials/voicemonkey - should handle errors', async () => {
            envManager.setEnvValue.mockImplementationOnce(() => {
                throw new Error('Write failed');
            });
            
            await request(app)
                .post('/api/settings/credentials/voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ token: 'mytoken', device: 'mydevice' })
                .expect(500);
        });

        it('DELETE /api/settings/credentials/voicemonkey - should remove credentials', async () => {
            envManager.deleteEnvValue = jest.fn(); // Reset mock
            
            const res = await request(app)
                .delete('/api/settings/credentials/voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            expect(envManager.deleteEnvValue).toHaveBeenCalledWith('VOICEMONKEY_TOKEN');
            expect(envManager.deleteEnvValue).toHaveBeenCalledWith('VOICEMONKEY_DEVICE');
            expect(mockConfigService.reload).toHaveBeenCalled();
            expect(res.body.success).toBe(true);
        });

        it('DELETE /api/settings/credentials/voicemonkey - should handle errors', async () => {
            envManager.deleteEnvValue = jest.fn(() => {
                throw new Error('Delete failed');
            });
            
            await request(app)
                .delete('/api/settings/credentials/voicemonkey')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(500);
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

        it('POST /api/settings/update - should validate MyMasjid source', async () => {
            const newConfig = { 
                ...mockConfig, 
                sources: { 
                    ...mockConfig.sources, 
                    primary: { type: 'mymasjid', masjidId: '12345' } 
                } 
            };
            
            const fetchers = require('../../../src/services/fetchers');
            fetchers.fetchMyMasjidBulk.mockResolvedValue({ prayers: {} });
            
            await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(200);
            
            expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
        });

        it('POST /api/settings/update - should reject MyMasjid without masjidId', async () => {
            const newConfig = { 
                ...mockConfig, 
                sources: { 
                    ...mockConfig.sources, 
                    primary: { type: 'mymasjid' } 
                } 
            };
            
            await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(400);
        });

        it('POST /api/settings/update - should reject invalid config format', async () => {
            await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(null) // Send null instead of 'invalid'
                .expect(400);
        });

        it('POST /api/settings/update - should handle audioAsset errors gracefully', async () => {
            audioAssetService.syncAudioAssets.mockRejectedValueOnce(new Error('TTS failed'));
            
            const res = await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(mockConfig)
                .expect(200);
            
            // Should still succeed despite audio asset failure
            expect(res.body.message).toBeDefined();
        });

        it('POST /api/settings/update - should generate warnings for unhealthy services', async () => {
            const healthCheck = require('../../../src/services/healthCheck');
            healthCheck.getHealth = jest.fn(() => ({
                tts: { healthy: false },
                local: { healthy: false },
                voiceMonkey: { healthy: false, message: 'Invalid credentials' }
            }));
            
            const configWithTriggers = {
                ...mockConfig,
                automation: {
                    triggers: {
                        fajr: {
                            azan: {
                                enabled: true,
                                type: 'tts',
                                targets: ['local', 'voiceMonkey']
                            }
                        }
                    }
                }
            };
            
            const res = await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(configWithTriggers)
                .expect(200);
            
            expect(res.body.warnings).toBeDefined();
            expect(res.body.warnings.length).toBeGreaterThan(0);
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

        it('POST /api/settings/update - should handle Schema errors as validation failure', async () => {
            mockConfigService.update.mockRejectedValueOnce(new Error('Schema validation error'));
            
            await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(mockConfig)
                .expect(400);
        });

        it('POST /settings/reset - should reset config', async () => {
            fs.existsSync.mockReturnValue(true);
            
            await request(app)
                .post('/api/settings/reset')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            expect(fs.unlinkSync).toHaveBeenCalled();
            expect(mockConfigService.reload).toHaveBeenCalled();
        });

        it('POST /settings/reset - should handle missing local.json', async () => {
            fs.existsSync.mockReturnValue(false);
            
            await request(app)
                .post('/api/settings/reset')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            expect(mockConfigService.reload).toHaveBeenCalled();
        });

        it('POST /settings/reset - should handle audioAsset errors gracefully', async () => {
            audioAssetService.syncAudioAssets.mockRejectedValueOnce(new Error('TTS failed'));
            
            const res = await request(app)
                .post('/api/settings/reset')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            expect(res.body.message).toBeDefined();
        });

        it('POST /settings/reset - should handle errors', async () => {
            mockConfigService.reload.mockRejectedValueOnce(new Error('Reload failed'));
            
            await request(app)
                .post('/api/settings/reset')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(500);
        });

        it('POST /settings/refresh-cache - should force refresh', async () => {
            const schedulerService = require('../../../src/services/schedulerService');
            schedulerService.stopAll = jest.fn();
            
            await request(app)
                .post('/api/settings/refresh-cache')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            expect(prayerTimeService.forceRefresh).toHaveBeenCalled();
            expect(schedulerService.stopAll).toHaveBeenCalled();
        });

        it('POST /settings/refresh-cache - should handle stopAll failure', async () => {
            const schedulerService = require('../../../src/services/schedulerService');
            schedulerService.stopAll = jest.fn(() => { throw new Error('Stop failed'); });
            
            // Should not fail the request
            await request(app)
                .post('/api/settings/refresh-cache')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
        });

        it('POST /settings/refresh-cache - should handle audioAsset errors', async () => {
            audioAssetService.syncAudioAssets.mockRejectedValueOnce(new Error('TTS failed'));
            
            const res = await request(app)
                .post('/api/settings/refresh-cache')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            
            expect(res.body.message).toBeDefined();
        });

        it('POST /settings/refresh-cache - should handle errors', async () => {
            prayerTimeService.forceRefresh.mockRejectedValueOnce(new Error('Refresh failed'));
            
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

        it('DELETE /settings/files - should validate filename path traversal', async () => {
            await request(app)
                .delete('/api/settings/files')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: '../../../etc/passwd' })
                .expect(400);
        });

        it('DELETE /settings/files - should handle delete errors', async () => {
            fs.existsSync.mockReturnValue(true);
            fs.unlinkSync.mockImplementationOnce(() => {
                throw new Error('Delete failed');
            });
            
            await request(app)
                .delete('/api/settings/files')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3' })
                .expect(500);
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
            
            // Cleanup the uploaded destination if it wrote to disc
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
                 meta: { date: '2024-01-01', source: 'test', cached: true },
                 prayers: {
                     fajr: '2024-01-01T05:00:00',
                     dhuhr: '2024-01-01T12:00:00',
                     asr: '2024-01-01T15:00:00',
                     maghrib: '2024-01-01T18:00:00',
                     isha: '2024-01-01T20:00:00',
                     iqamah: {}
                 }
             });
             
             const res = await request(app)
                .get('/api/prayers')
                .expect(200);
             
             expect(res.body.prayers).toBeDefined();
             expect(res.body.prayers.fajr).toBeDefined();
             expect(res.body.meta.cached).toBe(true);
        });

        it('GET /api/prayers - should use explicit iqamah times when available', async () => {
             prayerTimeService.getPrayerTimes.mockResolvedValue({
                 meta: { date: '2024-01-01', source: 'test' },
                 prayers: {
                     fajr: '2024-01-01T05:00:00',
                     dhuhr: '2024-01-01T12:00:00',
                     asr: '2024-01-01T15:00:00',
                     maghrib: '2024-01-01T18:00:00',
                     isha: '2024-01-01T20:00:00',
                     iqamah: {
                         fajr: '2024-01-01T05:30:00',
                         dhuhr: '2024-01-01T12:30:00'
                     }
                 }
             });
             
             const res = await request(app)
                .get('/api/prayers')
                .expect(200);
             
             expect(res.body.prayers.fajr.iqamah).toBe('2024-01-01T05:30:00');
             expect(res.body.prayers.dhuhr.iqamah).toBe('2024-01-01T12:30:00');
        });

        it('GET /api/prayers - should handle missing prayer time gracefully', async () => {
             prayerTimeService.getPrayerTimes.mockResolvedValue({
                 meta: { date: '2024-01-01', source: 'test' },
                 prayers: {
                     fajr: '2024-01-01T05:00:00',
                     dhuhr: '2024-01-01T12:00:00',
                     // Missing asr, maghrib, isha
                     iqamah: {}
                 }
             });
             
             const res = await request(app)
                .get('/api/prayers')
                .expect(200);
             
             expect(res.body.prayers.fajr).toBeDefined();
             expect(res.body.prayers.asr).toBeUndefined();
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
                         dhuhr: '2024-01-01T12:00:00Z',
                         asr: '2024-01-01T15:00:00Z',
                         maghrib: '2024-01-01T18:00:00Z',
                         isha: '2024-01-01T19:00:00Z',
                         iqamah: {}
                     }
                 })
                 .mockResolvedValueOnce({
                     meta: {},
                     prayers: {
                         fajr: '2024-01-02T05:01:00Z',
                         iqamah: {}
                     }
                 });

             const res = await request(app).get('/api/prayers');
             expect(res.body.nextPrayer).toBeDefined();
             expect(res.body.nextPrayer.isTomorrow).toBe(true);
             
             jest.useRealTimers();
        });

        it('GET /api/prayers - should handle tomorrow fetch failure', async () => {
             jest.useFakeTimers();
             jest.setSystemTime(new Date('2024-01-01T23:59:00Z'));
             
             prayerTimeService.getPrayerTimes
                 .mockResolvedValueOnce({
                     meta: {},
                     prayers: {
                         fajr: '2024-01-01T05:00:00Z',
                         dhuhr: '2024-01-01T12:00:00Z',
                         asr: '2024-01-01T15:00:00Z',
                         maghrib: '2024-01-01T18:00:00Z',
                         isha: '2024-01-01T19:00:00Z',
                         iqamah: {}
                     }
                 })
                 .mockRejectedValueOnce(new Error('Failed to fetch tomorrow'));

             const res = await request(app).get('/api/prayers');
             // nextPrayer will be null (not undefined) when all prayers have passed
             expect(res.body.nextPrayer).toBeNull();
             
             jest.useRealTimers();
        });

        it('GET /api/prayers - should handle API errors', async () => {
            prayerTimeService.getPrayerTimes.mockRejectedValue(new Error('API failure'));
            
            await request(app)
                .get('/api/prayers')
                .expect(500);
        });
    });
});
