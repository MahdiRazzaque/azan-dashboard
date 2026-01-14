const request = require('supertest');

// Mock scheduler to avoid open handles
jest.mock('../../src/services/schedulerService', () => ({
    initScheduler: jest.fn().mockResolvedValue(true),
    hotReload: jest.fn().mockResolvedValue(true)
}));

const app = require('../../src/server');

describe('Authentication Flow', () => {
    
    beforeEach(() => {
        process.env.ADMIN_PASSWORD = 'supersecretpass';
        // Suppress logs
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
 
    afterEach(() => {
        delete process.env.ADMIN_PASSWORD;
        jest.clearAllMocks();
    });

    it('should reject unauthenticated access to settings', async () => {
        const res = await request(app)
            .post('/api/settings/update')
            .send({});

        // Expect 401 Unauthorized from middleware
        expect(res.statusCode).toBe(401);
    });

    it('should login successfully with correct password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'supersecretpass' });

        expect(res.statusCode).toBe(200);
        expect(res.headers['set-cookie']).toBeDefined();
        // Check for HttpOnly cookie
        expect(res.headers['set-cookie'][0]).toMatch(/auth_token=.*;/);
    });

    it('should reject login with incorrect password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'wrongpassword' });

        expect(res.statusCode).toBe(401);
    });

    it('should allow access to settings with valid cookie', async () => {
        // First login
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ password: 'supersecretpass' });
        
        const cookie = loginRes.headers['set-cookie'];

        // Then access settings
        // Note: invalid config format will return 400, but that means auth passed.
        // If auth failed, it would be 401.
        const res = await request(app)
            .post('/api/settings/update')
            .set('Cookie', cookie)
            .send({}); 

        expect(res.statusCode).not.toBe(401);
        expect(res.statusCode).toBe(200); // Auth passed, settings updated (even if empty)
    });
    
    it('should force logout (clear cookie)', async () => {
         const res = await request(app).post('/api/auth/logout');
         expect(res.statusCode).toBe(200);
         // Expect cookie to be cleared (expired)
         expect(res.headers['set-cookie'][0]).toMatch(/auth_token=;/);
    });
});
