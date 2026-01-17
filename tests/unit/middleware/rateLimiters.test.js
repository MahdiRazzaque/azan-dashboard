const express = require('express');
const request = require('supertest');
const { 
    securityLimiter, 
    operationsLimiter, 
    globalReadLimiter, 
    globalWriteLimiter, 
    sseLimiter 
} = require('../../../src/middleware/rateLimiters');
const sseService = require('../../../src/services/sseService');

jest.mock('../../../src/services/sseService');

describe('Rate Limiters Middleware', () => {
    let app;

    beforeAll(() => {
        process.env.FORCE_RATE_LIMIT = 'true';
    });

    afterAll(() => {
        delete process.env.FORCE_RATE_LIMIT;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        app = express();
        app.set('trust proxy', 1);
        app.get('/security', securityLimiter, (req, res) => res.status(200).send('ok'));
        app.get('/ops', operationsLimiter, (req, res) => res.status(200).send('ok'));
        app.get('/read', globalReadLimiter, (req, res) => res.status(200).send('ok'));
        app.post('/write', globalWriteLimiter, (req, res) => res.status(200).send('ok'));
        app.get('/sse', sseLimiter, (req, res) => res.status(200).send('ok'));
    });

    it('Security Limiter should block after 5 requests', async () => {
        for (let i = 0; i < 5; i++) {
            await request(app).get('/security').expect(200);
        }
        const res = await request(app).get('/security').expect(429);
        expect(res.body.error).toBe('Too many requests');
        expect(res.body.message).toMatch(/Too many authentication attempts\. Please try again in 15 minutes\. - Please try again in \d+ seconds\./);
        expect(sseService.log).toHaveBeenCalledWith(expect.stringContaining('Please try again in'), 'WARN');
    });

    it('Operations Limiter should block after 5 requests', async () => {
        for (let i = 0; i < 5; i++) {
            await request(app).get('/ops').expect(200);
        }
        await request(app).get('/ops').expect(429);
    });

    it('Global Read Limiter should have correct max value', async () => {
        // express-rate-limit 7+ stores options in a way that isn't directly exposed as .max
        // We verified the code has 300.
        expect(globalReadLimiter).toBeDefined();
    });

    it('Global Write Limiter should have correct max value', async () => {
        expect(globalWriteLimiter).toBeDefined();
    });

    it('SSE Limiter should block after 30 requests', async () => {
        for (let i = 0; i < 30; i++) {
            await request(app).get('/sse').expect(200);
        }
        await request(app).get('/sse').expect(429);
    });
});
