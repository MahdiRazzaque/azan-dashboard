const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const mockMockFactory = require('../../helpers/mockFactory');

// --- 1. Define Mocks BEFORE requiring modules ---

jest.mock('axios'); 
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

jest.mock('fs/promises', () => ({
    access: jest.fn().mockResolvedValue(),
    unlink: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue('{}'),
    writeFile: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue(),
    rename: jest.fn().mockResolvedValue(),
    readdir: jest.fn().mockResolvedValue([]),
    stat: jest.fn().mockResolvedValue({ size: 100 })
}));
const fsPromises = require('fs/promises');

// Mock Config Service
const mockConfig = {
    ...mockMockFactory.createMockConfig(),
    automation: {
        baseUrl: 'http://localhost',
        pythonServiceUrl: 'http://localhost',
        outputs: {
            local: { enabled: true, params: { audioPlayer: 'mpg123' } },
            voicemonkey: { enabled: true, params: {} }
        },
        triggers: {
            fajr: { 
                preAdhan: { enabled: false, type: 'tts', targets: [] },
                adhan: { enabled: false, type: 'tts', targets: [] },
                preIqamah: { enabled: false, type: 'tts', targets: [] },
                iqamah: { enabled: false, type: 'tts', targets: [] }
            },
            sunrise: {
                preAdhan: { enabled: false, type: 'tts', targets: [] },
                adhan: { enabled: false, type: 'tts', targets: [] }
            },
            dhuhr: {
                preAdhan: { enabled: false, type: 'tts', targets: [] },
                adhan: { enabled: false, type: 'tts', targets: [] },
                preIqamah: { enabled: false, type: 'tts', targets: [] },
                iqamah: { enabled: false, type: 'tts', targets: [] }
            },
            asr: {
                preAdhan: { enabled: false, type: 'tts', targets: [] },
                adhan: { enabled: false, type: 'tts', targets: [] },
                preIqamah: { enabled: false, type: 'tts', targets: [] },
                iqamah: { enabled: false, type: 'tts', targets: [] }
            },
            maghrib: {
                preAdhan: { enabled: false, type: 'tts', targets: [] },
                adhan: { enabled: false, type: 'tts', targets: [] },
                preIqamah: { enabled: false, type: 'tts', targets: [] },
                iqamah: { enabled: false, type: 'tts', targets: [] }
            },
            isha: {
                preAdhan: { enabled: false, type: 'tts', targets: [] },
                adhan: { enabled: false, type: 'tts', targets: [] },
                preIqamah: { enabled: false, type: 'tts', targets: [] },
                iqamah: { enabled: false, type: 'tts', targets: [] }
            }
        }
    }
};
const mockConfigService = mockMockFactory.createMockConfigService(mockConfig);
jest.mock('@config', () =>   mockConfigService);

jest.mock('@services/system/configurationWorkflowService', () => ({
    executeUpdate: jest.fn().mockResolvedValue({ message: 'Success', warnings: [], meta: {} }),
    unmaskParams: jest.fn()
}));
const workflowService = require('@services/system/configurationWorkflowService');

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

jest.mock('@services/system/audioAssetService', () => ({
    ...mockMockFactory.createMockAudioAssetService(),
    enrichMetadata: jest.fn().mockResolvedValue({ duration: 10, protected: false })
}));
const audioAssetService = require('@services/system/audioAssetService');

jest.mock('@providers', () => {
    const mockAladhanClass = {
        getMetadata: jest.fn().mockReturnValue({ id: 'aladhan', label: 'Aladhan', requiresCoordinates: true }),
        getConfigSchema: jest.fn().mockReturnValue({ 
            parse: jest.fn().mockImplementation(data => {
                if (data.type === 'aladhan' && (data.method === undefined || data.madhab === undefined)) {
                    throw new Error('Validation failed');
                }
                return data;
            })
        })
    };
    const mockMyMasjidClass = {
        getMetadata: jest.fn().mockReturnValue({ id: 'mymasjid', label: 'MyMasjid', requiresCoordinates: false }),
        getConfigSchema: jest.fn().mockReturnValue({ 
            parse: jest.fn().mockImplementation(data => {
                if (data.type === 'mymasjid' && !data.masjidId) {
                    throw new Error('Validation failed');
                }
                return data;
            })
        })
    };
    return {
        ProviderFactory: {
            create: jest.fn(() => ({
                getAnnualTimes: jest.fn().mockResolvedValue({ '2024-01-01': {} })
            })),
            getProviderClass: jest.fn((type) => {
                if (type === 'aladhan') return mockAladhanClass;
                if (type === 'mymasjid') return mockMyMasjidClass;
                return null;
            })
        },
        ProviderConnectionError: jest.requireActual('@providers').ProviderConnectionError,
        ProviderValidationError: jest.requireActual('@providers').ProviderValidationError
    };
});
const { ProviderFactory } = require('@providers');

let integrationHealth = {
    local: { healthy: true },
    tts: { healthy: true },
    voicemonkey: { healthy: true }
};

jest.mock('@services/system/healthCheck', () => ({
    ...mockMockFactory.createMockHealthCheck(),
    refresh: jest.fn().mockImplementation((target) => {
        if (target === 'tts') integrationHealth.tts = { healthy: true };
        return Promise.resolve(integrationHealth);
    }),
    getHealth: jest.fn().mockImplementation(() => integrationHealth),
    checkSource: jest.fn().mockResolvedValue({ healthy: true })
}));
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

// Mock OutputFactory
jest.mock('../../../outputs', () => {
    const mockOutputMetadata = {
        id: 'local',
        label: 'Local Audio',
        params: [{ key: 'audioPlayer', sensitive: false }]
    };
    const mockOutputStrategy = {
        execute: jest.fn().mockResolvedValue(),
        verifyCredentials: jest.fn().mockResolvedValue({ success: true }),
        constructor: { getMetadata: () => mockOutputMetadata }
    };
    return {
        getStrategy: jest.fn(() => mockOutputStrategy),
        getAllStrategies: jest.fn(() => [
            { id: 'local', label: 'Local Audio' },
            { id: 'voicemonkey', label: 'VoiceMonkey (Alexa)' }
        ]),
        getSecretRequirementKeys: jest.fn(() => [])
    };
});
const OutputFactory = require('../../../outputs');

// Mock audioValidator
jest.mock('@utils/audioValidator', () => ({
    analyseAudioFile: jest.fn().mockResolvedValue({
        format: 'mpeg',
        codec: 'mp3',
        bitrate: 128000,
        sampleRate: 44100,
        duration: 10,
        size: 100,
        mimeType: 'audio/mpeg'
    }),
    getMimeType: jest.requireActual('../../../utils/audioValidator').getMimeType
}));

// --- 2. Require App ---
const app = require('../../../server');

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
        
        // Reset fsPromises mocks
        fsPromises.access.mockResolvedValue();
        fsPromises.unlink.mockResolvedValue();
        fsPromises.readFile.mockResolvedValue('{}');
        fsPromises.writeFile.mockResolvedValue();
        fsPromises.readdir.mockResolvedValue([]);
        
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

        it('GET /api/system/audio-files - should return paginated list', async () => {
            fsPromises.readdir.mockResolvedValue(['file1.mp3']);
            const res = await request(app)
                .get('/api/system/audio-files')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            expect(res.body.files).toBeDefined();
            expect(res.body.files.length).toBeGreaterThan(0);
        });

        it('POST /api/system/regenerate-tts - should call service', async () => {
            await request(app)
                .post('/api/system/regenerate-tts')
                .set('Cookie', [`auth_token=${adminToken}`])
                .expect(200);
            expect(audioAssetService.syncAudioAssets).toHaveBeenCalled();
        });

        it('POST /api/system/outputs/:strategyId/test - should execute strategy', async () => {
            await request(app)
                .post('/api/system/outputs/local/test')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ source: { path: 'custom/test.mp3' }, filename: 'test.mp3', type: 'custom' })
                .expect(200);
            
            expect(OutputFactory.getStrategy).toHaveBeenCalledWith('local');
        });

        it('POST /api/system/outputs/:strategyId/test - should handle missing strategy', async () => {
            OutputFactory.getStrategy.mockImplementation(() => { throw new Error('Not found'); });
            
            await request(app)
                .post('/api/system/outputs/invalid/test')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ filename: 'test.mp3', type: 'custom' })
                .expect(400);
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
            const newConfig = { 
                ...mockConfig, 
                sources: { 
                    ...mockConfig.sources, 
                    primary: { type: 'aladhan', method: 1, madhab: 1 } 
                },
                automation: {
                    ...mockConfig.automation,
                    outputs: {
                        local: { enabled: true },
                        voicemonkey: { enabled: true }
                    }
                }
            };
            
            await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(200);
            
            // Check workflow call
            expect(workflowService.executeUpdate).toHaveBeenCalled();
        });

        it('POST /api/settings/update - should fail on validation error', async () => {
            workflowService.executeUpdate.mockRejectedValueOnce(new Error('Validation Failed: API Down'));

            const newConfig = {
                ...mockConfig,
                sources: {
                    ...mockConfig.sources,
                    primary: { ...mockConfig.sources.primary, method: 3 }
                }
            };

            const res = await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(400); 
            
            expect(res.body.error).toMatch(/Update Failed/);
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
            expect(fsPromises.unlink).toHaveBeenCalled();
        });

        it('DELETE /settings/files - should handle missing file', async () => {
            fsPromises.access.mockRejectedValue(new Error('ENOENT'));
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
        const testFileName = 'test_upload_integration.mp3';
        const testFilePath = path.join(__dirname, testFileName);
        const tempDir = path.join(__dirname, '../../../public/audio/temp');
        const customDir = path.join(__dirname, '../../../public/audio/custom');
        
        beforeAll(() => {
            const realFs = jest.requireActual('fs');
            
            // Create the directories that multer and the controller need
            // These must exist for the real file operations to succeed
            if (!realFs.existsSync(tempDir)) {
                realFs.mkdirSync(tempDir, { recursive: true });
            }
            if (!realFs.existsSync(customDir)) {
                realFs.mkdirSync(customDir, { recursive: true });
            }
            
            // Write a real file with valid MP3 magic bytes for supertest to stream
            const mp3Header = Buffer.from([0xFF, 0xFB, 0x90, 0x44]);
            const dummyContent = Buffer.alloc(100, 0);
            const content = Buffer.concat([mp3Header, dummyContent]);
            realFs.writeFileSync(testFilePath, content);
            
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
            const uploadedPath = path.join(customDir, testFileName);
            if (realFs.existsSync(uploadedPath)) {
                realFs.unlinkSync(uploadedPath);
            }
            
            // Cleanup the temp file if multer left one
            const tempPath = path.join(tempDir, testFileName);
            if (realFs.existsSync(tempPath)) {
                realFs.unlinkSync(tempPath);
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
             expect(fsPromises.unlink).toHaveBeenCalled();
        });

        it('DELETE /api/settings/files - should handle not found', async () => {
             fsPromises.access.mockRejectedValue(new Error('ENOENT'));
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
             expect(fsPromises.unlink).toHaveBeenCalled();
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
             workflowService.executeUpdate.mockRejectedValueOnce(new Error('Sync Fail'));
             
             const newConfig = { ...mockConfig, sources: { ...mockConfig.sources, primary: { type: 'aladhan', method: 2, madhab: 1 } } };
            
             const res = await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(500);

             expect(res.body.error).toBe('Update Failed');
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
        it('POST /api/settings/update - should successfully update MyMasjid source', async () => {
             const newConfig = { 
                 ...mockConfig, 
                 sources: { 
                     primary: { type: 'mymasjid', masjidId: '94f1c71b-7f8a-4b9a-9e1d-3b5f6a7b8c9d' } 
                 }
             };
             
             await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(200);
             
             expect(workflowService.executeUpdate).toHaveBeenCalledWith(expect.objectContaining({
                 sources: expect.objectContaining({ primary: expect.objectContaining({ type: 'mymasjid' }) })
             }));
        });

        it('POST /api/settings/update - should handle failures from workflow', async () => {
             workflowService.executeUpdate.mockRejectedValueOnce(new Error('Validation Failed: Missing ID'));
             const newConfig = { sources: { primary: { type: 'mymasjid', masjidId: '' } } };
             
             await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(newConfig)
                .expect(400); 
        });

         it('POST /api/settings/update - should return warnings from workflow', async () => {
             const warnings = ['TTS Service is offline', 'Auth Fail'];
             workflowService.executeUpdate.mockResolvedValueOnce({
                 message: 'Success',
                 warnings: warnings,
                 meta: {}
             });

             const res = await request(app)
                .post('/api/settings/update')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send(mockConfig)
                .expect(200);
             
             expect(res.body.warnings).toEqual(warnings);
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