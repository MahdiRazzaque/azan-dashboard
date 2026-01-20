/* tests/integration/routes/auth_lifecycle.test.js */
const request = require('supertest');

// 1. Mock EnvManager
const mockEnvManager = {
    isConfigured: jest.fn(() => false),
    setEnvValue: jest.fn(),
    generateSecret: jest.fn(() => 'generated-secret'),
    getEnvValue: jest.fn()
};
jest.mock('@utils/envManager', () => mockEnvManager);

// 2. Mock others
jest.mock('@config', () => ({
    init: jest.fn(),
    get: jest.fn(() => ({ sources: {}, location: { coordinates: {} } })),
    update: jest.fn()
}));
jest.mock('@services/core/schedulerService', () => ({ initScheduler: jest.fn() }));
jest.mock('@services/core/prayerTimeService', () => ({ forceRefresh: jest.fn() }));

const app = require('../../../src/server');

describe('Auth Lifecycle Integration', () => {
    
    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.ADMIN_PASSWORD;
        delete process.env.JWT_SECRET;
    });

    it('GET /api/auth/status - should report not configured', async () => {
        mockEnvManager.isConfigured.mockReturnValue(false); // Force not configured
        const res = await request(app).get('/api/auth/status').expect(200);
        // Logic: requiresSetup = !process.env.ADMIN_PASSWORD
        // Since we deleted env.ADMIN_PASSWORD, it should be true
        expect(res.body.requiresSetup).toBe(true);
    });

    it('POST /api/auth/setup - should set password', async () => {
        const res = await request(app)
            .post('/api/auth/setup')
            .send({ password: 'securePassword123' })
            .expect(200);
            
        expect(mockEnvManager.setEnvValue).toHaveBeenCalledWith('ADMIN_PASSWORD', expect.any(String));
        expect(mockEnvManager.setEnvValue).toHaveBeenCalledWith('JWT_SECRET', expect.any(String));
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('POST /api/auth/setup - should fail if already configured', async () => {
        process.env.ADMIN_PASSWORD = 'existingHash'; 
        
        await request(app)
            .post('/api/auth/setup')
            .send({ password: 'newPassword' })
            .expect(403);
    });

    it('POST /api/auth/login - should login with correct password', async () => {
        const { hashPassword } = require('@utils/passwordUtils');
        process.env.ADMIN_PASSWORD = hashPassword('correctPassword');
        
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'correctPassword' })
            .expect(200);
            
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('POST /api/auth/login - should fail with wrong password', async () => {
        const { hashPassword } = require('@utils/passwordUtils');
        process.env.ADMIN_PASSWORD = hashPassword('correctPassword');
        
        await request(app)
            .post('/api/auth/login')
            .send({ password: 'wrongPassword' })
            .expect(401);
    });
});
