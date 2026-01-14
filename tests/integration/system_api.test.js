const request = require('supertest');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('../../src/services/schedulerService', () => ({
    getJobs: jest.fn().mockReturnValue([{ name: 'TestJob', nextInvocation: '2023-01-01' }]),
    initScheduler: jest.fn(),
    hotReload: jest.fn()
}));

jest.mock('../../src/services/audioAssetService', () => ({
    prepareDailyAssets: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/services/automationService', () => ({
    triggerEvent: jest.fn(),
    playTestAudio: jest.fn()
}));

const app = require('../../src/server');

describe('System API Routes', () => {
    let cookie;

    beforeAll(async () => {
        process.env.ADMIN_PASSWORD = 'test';
        // Need to ensure env var is set before app usage if it used it?
        // App uses it in route handler, so effectively realtime.
        
        // Login to get cookie
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'test' });
        
        cookie = res.headers['set-cookie'];
    });
    
    afterAll(() => {
        delete process.env.ADMIN_PASSWORD;
    });

    test('GET /system/jobs should return jobs list', async () => {
        const res = await request(app)
            .get('/api/system/jobs')
            .set('Cookie', cookie);
        
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body[0].name).toBe('TestJob');
    });

    test('POST /system/regenerate-tts should success', async () => {
        const res = await request(app)
            .post('/api/system/regenerate-tts')
            .set('Cookie', cookie);
            
        expect(res.statusCode).toBe(200);
    });
    
    test('GET /system/audio-files should return files', async () => {
         // Create dummy file
         const customDir = path.join(__dirname, '../../public/audio/custom');
         if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
         fs.writeFileSync(path.join(customDir, 'test_api.mp3'), 'dummy');
         
         const res = await request(app)
            .get('/api/system/audio-files')
            .set('Cookie', cookie);
            
         expect(res.statusCode).toBe(200);
         expect(Array.isArray(res.body)).toBe(true);
         const found = res.body.find(f => f.name === 'test_api.mp3');
         expect(found).toBeDefined();
         expect(found.type).toBe('custom');
         
         // Cleanup
         try { fs.unlinkSync(path.join(customDir, 'test_api.mp3')); } catch(e){}
    });
});
