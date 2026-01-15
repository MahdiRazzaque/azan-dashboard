const configService = require('../../../src/config');

jest.mock('../../../src/config', () => ({
    get: jest.fn(() => ({
        automation: {
            voiceMonkey: {
                token: 'test-token',
                device: 'test-device'
            }
        }
    }))
}));

const healthCheck = require('../../../src/services/healthCheck');
const { exec } = require('child_process');
const axios = require('axios');

jest.mock('child_process');
jest.mock('axios');

describe('Health Check Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('should pass if all services available', async () => {
        exec.mockImplementation((cmd, cb) => cb(null)); // Ensure exec is mocked for success
        axios.get.mockResolvedValue({ status: 200, data: { success: true } });
        
        const result = await healthCheck.refresh();
        expect(result.local.healthy).toBe(true);
        expect(result.tts.healthy).toBe(true);
    });

    it('should fail mpg123 if command error', async () => {
        exec.mockImplementation((cmd, cb) => cb(new Error('Not found')));
        axios.get.mockResolvedValue({ status: 200, data: { success: true } }); // Mock axios for success
        
        const result = await healthCheck.refresh();
        expect(result.local.healthy).toBe(false);
        expect(result.tts.healthy).toBe(true);
    });

    it('should fail ttsService if network error', async () => {
        exec.mockImplementation((cmd, cb) => cb(null)); // Ensure exec is mocked for success
        axios.get.mockRejectedValue(new Error('Connection refused'));

        const result = await healthCheck.refresh();
        expect(result.local.healthy).toBe(true); // Assuming local is mocking OK from previous mock or need rest
        expect(result.tts.healthy).toBe(false);
    });
});
