const request = require('supertest');
const app = require('../../src/server');

// Mock scheduler
jest.mock('../../src/services/schedulerService', () => ({
    getJobs: jest.fn().mockReturnValue({
        maintenance: [{ name: 'Test Maintenance', nextInvocation: '2023-01-01T00:00:00.000Z' }],
        automation: [{ name: 'Test Automation', nextInvocation: '2023-01-01T00:00:00.000Z' }]
    }),
    hotReload: jest.fn().mockResolvedValue(),
    initScheduler: jest.fn().mockResolvedValue(),
    stopAll: jest.fn().mockResolvedValue()
}));

describe('Diagnostics API Smoke Tests', () => {
    let cookie;
    
    beforeAll(async () => {
        // Initialize ConfigService
        const configService = require('../../src/config');
        await configService.init();
        process.env.ADMIN_PASSWORD = 'testpassword';
        
        // Login
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ password: 'testpassword' });
        cookie = loginRes.headers['set-cookie'];
    });

    afterAll(() => {
        delete process.env.ADMIN_PASSWORD;
    });

    test('GET /api/system/jobs should return 200', async () => {
        const res = await request(app)
            .get('/api/system/jobs')
            .set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('maintenance');
    });

    test('GET /api/system/status/automation should return 200', async () => {
        const res = await request(app)
            .get('/api/system/status/automation')
            .set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('fajr');
    });

    test('GET /api/system/status/tts should return 200', async () => {
        const res = await request(app)
            .get('/api/system/status/tts')
            .set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('fajr');
    });
});
