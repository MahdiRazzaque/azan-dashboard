const request = require('supertest');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

// --- 1. Define Mocks BEFORE requiring modules ---

jest.mock('axios'); 

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

jest.mock('fs/promises', () => ({
    access: jest.fn().mockResolvedValue(),
    unlink: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue('{}'),
    writeFile: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue(),
    rename: jest.fn().mockResolvedValue(),
    readdir: jest.fn().mockResolvedValue([])
}));

// Mock Config
jest.mock('@config', () => ({
    get: jest.fn().mockReturnValue({
        location: { timezone: 'Europe/London', coordinates: { lat: 51.5, long: -0.1 } },
        automation: {
            baseUrl: 'http://localhost',
            outputs: {
                voicemonkey: { enabled: true, params: {} }
            },
            triggers: {}
        },
        sources: {},
        prayers: {},
        security: { tokenVersion: 1 }
    }),
    reload: jest.fn(),
    init: jest.fn().mockResolvedValue()
}));

// Mock some other services to avoid startup failures
jest.mock('@services/system/healthCheck', () => ({
    refresh: jest.fn().mockResolvedValue({}),
    getHealth: jest.fn().mockReturnValue({}),
    checkSource: jest.fn().mockResolvedValue({ healthy: true }),
    init: jest.fn(),
    runStartupChecks: jest.fn()
}));
jest.mock('@services/core/prayerTimeService', () => ({
    forceRefresh: jest.fn().mockResolvedValue({ meta: {} }),
    getPrayerTimes: jest.fn().mockResolvedValue({ prayers: {} })
}));
jest.mock('@services/core/schedulerService', () => ({
    initScheduler: jest.fn().mockResolvedValue(),
    stopAll: jest.fn().mockResolvedValue()
}));

jest.mock('@utils/audioValidator', () => ({
    analyseAudioFile: jest.fn().mockResolvedValue({
        format: 'mpeg',
        codec: 'mp3',
        bitrate: 128000,
        sampleRate: 44100,
        duration: 10,
        size: 1000,
        mimeType: 'audio/mpeg'
    }),
    getMimeType: jest.fn()
}));

// Mock app
const app = require('../../../server');

describe('File Upload Validation Integration', () => {
    const JWT_SECRET = 'test-secret';
    let adminToken;
    const testFileName = 'integration-test.mp3';
    const testFilePath = path.join(__dirname, testFileName);

    beforeAll(() => {
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.ADMIN_PASSWORD = 'hashed';
        adminToken = jwt.sign({ role: 'admin', tokenVersion: 1 }, JWT_SECRET);
        
        // Create dummy file for upload
        jest.requireActual('fs').writeFileSync(testFilePath, 'dummy content');

        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterAll(() => {
        const realFs = jest.requireActual('fs');
        if (realFs.existsSync(testFilePath)) {
            realFs.unlinkSync(testFilePath);
        }
    });

    it('POST /api/settings/upload - should include compatibility block in response', async () => {
        const res = await request(app)
            .post('/api/settings/upload')
            .set('Cookie', [`auth_token=${adminToken}`])
            .attach('file', testFilePath)
            .expect(200);

        expect(res.body.compatibility).toBeDefined();
        expect(res.body.compatibility.voicemonkey).toBeDefined();
        expect(res.body.compatibility.voicemonkey.valid).toBe(true);
        expect(res.body.compatibility.local.valid).toBe(true);
    });

    it('POST /api/settings/upload - should return 400 for invalid magic bytes', async () => {
        const audioValidator = require('@utils/audioValidator');
        audioValidator.analyseAudioFile.mockResolvedValueOnce({
            mimeType: 'text/plain'
        });

        const res = await request(app)
            .post('/api/settings/upload')
            .set('Cookie', [`auth_token=${adminToken}`])
            .attach('file', testFilePath)
            .expect(400);

        expect(res.body.error).toBe('Invalid File');
    });

    it('POST /api/settings/upload - should show warnings for incompatible files', async () => {
        const audioValidator = require('@utils/audioValidator');
        audioValidator.analyseAudioFile.mockResolvedValueOnce({
            format: 'wav',
            bitrate: 2000000,
            duration: 120,
            size: 5000000,
            mimeType: 'audio/mpeg'
        });

        const res = await request(app)
            .post('/api/settings/upload')
            .set('Cookie', [`auth_token=${adminToken}`])
            .attach('file', testFilePath)
            .expect(200);

        expect(res.body.compatibility.voicemonkey.valid).toBe(false);
        // Bitrate check has higher priority than format check in audioValidator
        expect(res.body.compatibility.voicemonkey.issues[0]).toMatch(/Bitrate too high/);
    });
});