const request = require('supertest');
const app = require('../../server');

describe('Security Hardening Integration', () => {
    it('should have X-Content-Type-Options: nosniff', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should have X-Frame-Options: SAMEORIGIN or DENY', async () => {
        const res = await request(app).get('/api/health');
        expect(['SAMEORIGIN', 'DENY', 'deny', 'sameorigin']).toContain(res.headers['x-frame-options']?.toLowerCase() || res.headers['x-frame-options']);
    });

    it('should have Strict-Transport-Security header', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('should not expose server information', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['x-powered-by']).toBeUndefined();
    });
    
    it('should have Content-Security-Policy header', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['content-security-policy']).toBeDefined();
    });
});