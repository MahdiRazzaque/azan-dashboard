const request = require('supertest');
const express = require('express');
const systemRouter = require('../../../src/routes/system');
const configService = require('../../../src/config');
const fetchers = require('../../../src/services/fetchers');
const healthCheck = require('../../../src/services/healthCheck');
const errorHandler = require('../../../src/middleware/errorHandler');

// Mock middleware
jest.mock('../../../src/middleware/auth', () => (req, res, next) => next());

// Mock services
jest.mock('../../../src/config', () => ({
    get: jest.fn(),
    reload: jest.fn().mockResolvedValue()
}));
jest.mock('../../../src/services/fetchers', () => ({
    fetchAladhanAnnual: jest.fn(),
    fetchMyMasjidBulk: jest.fn()
}));
jest.mock('../../../src/services/healthCheck', () => ({
    refresh: jest.fn().mockResolvedValue()
}));

const app = express();
app.use(express.json());
app.use('/system', systemRouter);
app.use(errorHandler);

describe('System Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('GET /system/constants', () => {
        it('should return system constants', async () => {
            const res = await request(app).get('/system/constants');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('calculationMethods');
            expect(res.body).toHaveProperty('madhabs');
            expect(res.body).toHaveProperty('latitudeAdjustments');
            expect(res.body).toHaveProperty('midnightModes');
            
            // Verify structure of one array
            expect(Array.isArray(res.body.calculationMethods)).toBe(true);
            if (res.body.calculationMethods.length > 0) {
                expect(res.body.calculationMethods[0]).toHaveProperty('id');
                expect(res.body.calculationMethods[0]).toHaveProperty('label');
            }
        });
    });

    describe('POST /system/source/test', () => {
        it('should return 400 for invalid target', async () => {
            const res = await request(app)
                .post('/system/source/test')
                .send({ target: 'invalid' });
            
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid target');
        });

        it('should return 400 if target source not configured', async () => {
            configService.get.mockReturnValue({ sources: {} });
            
            const res = await request(app)
                .post('/system/source/test')
                .send({ target: 'primary' });
            
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('is not configured');
        });

        it('should return 400 if backup is disabled', async () => {
            configService.get.mockReturnValue({ 
                sources: { backup: { type: 'mymasjid', enabled: false } } 
            });
            
            const res = await request(app)
                .post('/system/source/test')
                .send({ target: 'backup' });
            
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('currently disabled');
        });

        it('should test aladhan successfully', async () => {
            configService.get.mockReturnValue({
                sources: { primary: { type: 'aladhan' } },
                location: { timezone: 'Europe/London', coordinates: { lat: 0, long: 0 } }
            });
            fetchers.fetchAladhanAnnual.mockResolvedValue({ '2023-01-01': {} });

            const res = await request(app)
                .post('/system/source/test')
                .send({ target: 'primary' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource');
        });

        it('should test mymasjid successfully', async () => {
            configService.get.mockReturnValue({
                sources: { primary: { type: 'mymasjid' } }
            });
            fetchers.fetchMyMasjidBulk.mockResolvedValue({ '2023-01-01': {} });

            const res = await request(app)
                .post('/system/source/test')
                .send({ target: 'primary' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
        });

        it('should return 400 for unsupported source type', async () => {
            configService.get.mockReturnValue({
                sources: { primary: { type: 'unsupported' } }
            });

            const res = await request(app)
                .post('/system/source/test')
                .send({ target: 'primary' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Unsupported source type');
        });

        it('should handle fetch errors and refresh health anyway', async () => {
            configService.get.mockReturnValue({
                sources: { primary: { type: 'aladhan' } },
                location: { timezone: 'Europe/London' }
            });
            fetchers.fetchAladhanAnnual.mockRejectedValue(new Error('API Failure'));

            const res = await request(app)
                .post('/system/source/test')
                .send({ target: 'primary' });

            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('API Failure');
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource');
        });
        
        it('should handle fetch errors when healthCheck.refresh also fails', async () => {
            configService.get.mockReturnValue({
                sources: { primary: { type: 'aladhan' } },
                location: { timezone: 'Europe/London' }
            });
            fetchers.fetchAladhanAnnual.mockRejectedValue(new Error('API Failure'));
            healthCheck.refresh.mockRejectedValue(new Error('Health Failure'));

            const res = await request(app)
                .post('/system/source/test')
                .send({ target: 'primary' });

            expect(res.status).toBe(500);
            expect(healthCheck.refresh).toHaveBeenCalled();
        });
    });
});
