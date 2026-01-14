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
        exec.mockImplementation((cmd, cb) => cb(null)); // Success
        axios.get.mockResolvedValue({ status: 200 });
        
        const result = await healthCheck.checkSystemHealth();
        expect(result.mpg123).toBe(true);
        expect(result.ttsService).toBe(true);
    });

    it('should fail mpg123 if command error', async () => {
        exec.mockImplementation((cmd, cb) => cb(new Error('Command not found')));
        axios.get.mockResolvedValue({ status: 200 });

        const result = await healthCheck.checkSystemHealth();
        expect(result.mpg123).toBe(false);
        expect(result.ttsService).toBe(true);
    });

    it('should fail ttsService if network error', async () => {
        exec.mockImplementation((cmd, cb) => cb(null));
        axios.get.mockRejectedValue(new Error('Connection refused'));

        const result = await healthCheck.checkSystemHealth();
        expect(result.mpg123).toBe(true);
        expect(result.ttsService).toBe(false);
    });
});
