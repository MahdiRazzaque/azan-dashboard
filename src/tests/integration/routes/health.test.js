const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../server');
const healthCheck = require('@services/system/healthCheck');
const configService = require('@config');

jest.mock('@services/system/healthCheck');
jest.mock('@config');

describe('Health Endpoints Integration', () => {
    const JWT_SECRET = 'integration-test-secret';
    let adminToken;

    beforeAll(() => {
        process.env.JWT_SECRET = JWT_SECRET;
        process.env.ADMIN_PASSWORD = 'configured';
        adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET);
        
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/system/health/toggle', () => {
        it('should return 401 without token', async () => {
            await request(app)
                .post('/api/system/health/toggle')
                .send({ serviceId: 'api', enabled: false })
                .expect(401);
        });

        it('should toggle health check with valid token', async () => {
            healthCheck.toggle.mockResolvedValue();
            
            await request(app)
                .post('/api/system/health/toggle')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ serviceId: 'api', enabled: false })
                .expect(200);
            
            expect(healthCheck.toggle).toHaveBeenCalledWith('api', false);
        });

        it('should return 400 for invalid request', async () => {
            await request(app)
                .post('/api/system/health/toggle')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ serviceId: 'api' }) // missing enabled
                .expect(400);
        });
    });

    describe('POST /api/system/health/refresh', () => {
        it('should force refresh health', async () => {
            healthCheck.refresh.mockResolvedValue({ status: 'ok' });
            
            const res = await request(app)
                .post('/api/system/health/refresh')
                .set('Cookie', [`auth_token=${adminToken}`])
                .send({ target: 'local' })
                .expect(200);
            
            expect(healthCheck.refresh).toHaveBeenCalledWith('local', undefined, { force: true });
            expect(res.body).toEqual({ status: 'ok' });
        });
    });
});
