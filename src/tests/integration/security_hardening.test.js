const request = require('supertest');
const jwt = require('jsonwebtoken');
const dns = require('dns');

// Mock Config
jest.mock('@config', () => ({
    get: jest.fn().mockReturnValue({
        location: { timezone: 'Europe/London', coordinates: { lat: 51.5, long: -0.1 } },
        automation: { outputs: {} },
        sources: {},
        prayers: {},
        security: { tokenVersion: 1 }
    }),
    reload: jest.fn(),
    init: jest.fn().mockResolvedValue()
}));

// Mock HealthCheck
jest.mock('@services/system/healthCheck', () => ({
    init: jest.fn(),
    runStartupChecks: jest.fn(),
    getHealth: jest.fn().mockReturnValue({})
}));

// Mock scheduler
jest.mock('@services/core/schedulerService', () => ({
    initScheduler: jest.fn().mockResolvedValue(),
    stopAll: jest.fn().mockResolvedValue()
}));

// Mock EnvManager
jest.mock('@utils/envManager', () => ({
    setEnvValue: jest.fn().mockResolvedValue(true)
}));

const app = require('../../server');

describe('Security Hardening Integration', () => {
    const JWT_SECRET = 'test-secret';
    let adminToken;

    beforeAll(() => {
        process.env.JWT_SECRET = JWT_SECRET;
        adminToken = jwt.sign({ role: 'admin', tokenVersion: 1 }, JWT_SECRET);
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('Environment Whitelist', () => {
        it('POST /api/settings/env - should reject blacklisted keys (PATH)', async () => {
            const res = await request(app)
                .post('/api/settings/env')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ key: 'PATH', value: '/bin' })
                .expect(400);

            expect(res.body.message).toBe('Validation failed');
        });

        it('POST /api/settings/env - should reject non-whitelisted keys', async () => {
            const res = await request(app)
                .post('/api/settings/env')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ key: 'RANDOM_VAR', value: 'value' })
                .expect(400);
        });

        it('POST /api/settings/env - should allow whitelisted keys (AZAN_TEST)', async () => {
            await request(app)
                .post('/api/settings/env')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ key: 'AZAN_TEST', value: '1' })
                .expect(200);
        });
    });

    describe('SSRF Protection (validateUrl)', () => {
        it('POST /api/system/validate-url - should reject private IPs', async () => {
            // Mock dns.lookup to simulate a hostname resolving to a private IP
            const lookupSpy = jest.spyOn(dns, 'lookup').mockImplementation((hostname, options, callback) => {
                const cb = typeof options === 'function' ? options : callback;
                cb(null, '192.168.1.50', 4);
            });
            
            const res = await request(app)
                .post('/api/system/validate-url')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ url: 'http://malicious-internal.com' })
                .expect(200); 

            expect(res.body.valid).toBe(false);
            expect(res.body.error).toMatch(/Private IP ranges are not allowed/);
            
            lookupSpy.mockRestore();
        });
    });
});