/* eslint-disable no-undef */
const request = require('supertest');
const express = require('express');

jest.mock('../../src/services/schedulerService');
jest.mock('../../src/services/sseService');
jest.mock('../../src/services/prayerTimeService');
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue('{}'),
    writeFileSync: jest.fn()
}));

const mockConfig = {
    location: { timezone: 'Europe/London' },
    prayers: {},
    sources: { primary: { type: 'aladhan' } }
};
jest.mock('../../src/config', () => mockConfig);

const apiRoutes = require('../../src/routes/api');
const prayerTimeService = require('../../src/services/prayerTimeService');
const schedulerService = require('../../src/services/schedulerService');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Refresh Endpoint', () => {
    test('POST /api/settings/refresh-cache triggers forceRefresh', async () => {
        prayerTimeService.forceRefresh.mockResolvedValue({
            meta: { cached: false, lastFetched: '2023-01-01' }
        });
        schedulerService.hotReload.mockResolvedValue();

        const res = await request(app).post('/api/settings/refresh-cache');
        
        expect(res.statusCode).toBe(200);
        expect(prayerTimeService.forceRefresh).toHaveBeenCalled();
        expect(schedulerService.hotReload).toHaveBeenCalled();
        expect(res.body.message).toContain('refreshed');
    });
});
