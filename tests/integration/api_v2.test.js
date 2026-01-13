const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../../src/server');

// Mock scheduler
jest.mock('../../src/services/schedulerService', () => ({
    hotReload: jest.fn().mockResolvedValue()
}));

describe('API V2 Endpoints', () => {
    const TEMP_LOCAL_CONFIG = path.join(__dirname, '../../src/config/local.json');
    const CUSTOM_AUDIO_DIR = path.join(__dirname, '../../public/audio/custom');
    const TEMP_AUDIO = path.join(CUSTOM_AUDIO_DIR, 'test_upload.mp3');

    beforeAll(() => {
        // Ensure dir exists (in case app didn't run to create it yet)
        if (!fs.existsSync(CUSTOM_AUDIO_DIR)) fs.mkdirSync(CUSTOM_AUDIO_DIR, { recursive: true });
    });

    afterAll(() => {
        if (fs.existsSync(TEMP_LOCAL_CONFIG)) fs.unlinkSync(TEMP_LOCAL_CONFIG);
        if (fs.existsSync(TEMP_AUDIO)) fs.unlinkSync(TEMP_AUDIO);
    });

    test('POST /api/settings/upload should handle file upload', async () => {
        const buffer = Buffer.from('fake mp3 content');
        const res = await request(app)
            .post('/api/settings/upload')
            .attach('file', buffer, 'test_upload.mp3');
        
        expect(res.status).toBe(200);
        expect(res.body.filename).toBe('test_upload.mp3');
        expect(fs.existsSync(TEMP_AUDIO)).toBe(true);
    });

    test('POST /api/settings/update should update config and reload scheduler', async () => {
        const newSettings = { automation: { enabled: true } };
        const res = await request(app)
            .post('/api/settings/update')
            .send(newSettings);

        expect(res.status).toBe(200);
        expect(require('../../src/services/schedulerService').hotReload).toHaveBeenCalled();
        
        expect(fs.existsSync(TEMP_LOCAL_CONFIG)).toBe(true);
        const content = JSON.parse(fs.readFileSync(TEMP_LOCAL_CONFIG, 'utf-8'));
        expect(content.automation.enabled).toBe(true);
    });
});
