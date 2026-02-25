const request = require('supertest');

const mockConfigService = {
    init: jest.fn(),
    reload: jest.fn(),
    get: jest.fn(() => ({
        location: {},
        prayers: {},
        sources: {},
        automation: {},
        system: { tours: { dashboardSeen: false, adminSeen: false } },
        security: { tokenVersion: 1 }
    })),
    update: jest.fn().mockResolvedValue(),
    _localPath: 'local.json'
};
jest.mock('@config', () => mockConfigService);

jest.mock('@services/system/sseService', () => ({ broadcast: jest.fn(), addClient: jest.fn(), log: jest.fn() }));
jest.mock('@services/core/schedulerService', () => ({ initScheduler: jest.fn() }));
jest.mock('@services/system/healthCheck', () => ({ getHealth: jest.fn(() => ({})), refresh: jest.fn() }));
jest.mock('../../../outputs', () => ({
    getStrategy: jest.fn(() => { throw new Error('Not found'); }),
    getAllStrategies: jest.fn(() => []),
    getAllStrategyInstances: jest.fn(() => []),
    getSecretRequirementKeys: jest.fn(() => [])
}));

const app = require('../../../server');

describe('PATCH /api/settings/tour-state — auth integration', () => {
    beforeAll(() => {
        process.env.JWT_SECRET = 'test-secret';
        process.env.ADMIN_PASSWORD = 'hashed_password';
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockConfigService.update.mockResolvedValue();
    });

    it('should return 401 when no auth token is provided', async () => {
        await request(app)
            .patch('/api/settings/tour-state')
            .send({ dashboardSeen: true })
            .expect(401);
    });
});
