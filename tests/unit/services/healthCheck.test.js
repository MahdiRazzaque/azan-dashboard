const configService = require('../../../src/config');

jest.mock('../../../src/config', () => ({
    get: jest.fn(() => ({
        location: { timezone: 'Europe/London' },
        sources: {
            primary: { type: 'aladhan' },
            backup: { type: 'mymasjid', enabled: true }
        },
        automation: {
            voiceMonkey: {
                token: 'test-token',
                device: 'test-device'
            }
        }
    }))
}));

jest.mock('../../../src/services/fetchers', () => ({
    fetchAladhanAnnual: jest.fn(),
    fetchMyMasjidBulk: jest.fn()
}));

const healthCheck = require('../../../src/services/healthCheck');
const { exec } = require('child_process');
const axios = require('axios');

jest.mock('child_process');
jest.mock('axios');

describe('Health Check Service', () => {
    let fetchers;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Reset fetchers mock
        fetchers = require('../../../src/services/fetchers');
        fetchers.fetchAladhanAnnual.mockResolvedValue({});
        fetchers.fetchMyMasjidBulk.mockResolvedValue({});
        
        // Reset config mock to default
        configService.get.mockReturnValue({
            location: { timezone: 'Europe/London' },
            sources: {
                primary: { type: 'aladhan' },
                backup: { type: 'mymasjid', enabled: true }
            },
            automation: {
                voiceMonkey: {
                    token: 'test-token',
                    device: 'test-device'
                }
            }
        });
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

    it('should handle VoiceMonkey with missing token', async () => {
        configService.get.mockReturnValue({
            location: { timezone: 'Europe/London' },
            sources: {},
            automation: { voiceMonkey: {} } // No token
        });

        const result = await healthCheck.refresh('voiceMonkey');
        expect(result.voiceMonkey.healthy).toBe(false);
        expect(result.voiceMonkey.message).toContain('Token Missing');
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Token missing'));
    });

    it('should handle VoiceMonkey with missing device in loud mode', async () => {
        configService.get.mockReturnValue({
            location: { timezone: 'Europe/London' },
            sources: {},
            automation: { voiceMonkey: { token: 'test-token' } } // No device
        });

        const result = await healthCheck.refresh('voiceMonkey', 'loud');
        expect(result.voiceMonkey.healthy).toBe(false);
        expect(result.voiceMonkey.message).toContain('Device Missing');
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Device missing'));
    });

    it('should handle VoiceMonkey API failure (success = false)', async () => {
        axios.get.mockResolvedValue({ 
            status: 200, 
            data: { success: false, error: 'Invalid device' } 
        });

        const result = await healthCheck.refresh('voiceMonkey');
        expect(result.voiceMonkey.healthy).toBe(false);
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('API returned failure'), expect.anything());
    });

    it('should check primary and backup sources', async () => {
        exec.mockImplementation((cmd, cb) => cb(null));
        axios.get.mockResolvedValue({ status: 200, data: { success: true } });

        const result = await healthCheck.refresh('all');
        expect(result.primarySource.healthy).toBe(true);
        expect(result.backupSource.healthy).toBe(true);
    });

    it('should handle source check errors', async () => {
        fetchers.fetchAladhanAnnual.mockRejectedValue(new Error('API Error'));

        const result = await healthCheck.refresh('primarySource');
        expect(result.primarySource.healthy).toBe(false);
        expect(result.primarySource.message).toContain('API Error');
        expect(console.warn).toHaveBeenCalled();
    });

    it('should return health cache via getHealth', () => {
        const result = healthCheck.getHealth();
        expect(result).toBeDefined();
        expect(result).toHaveProperty('local');
        expect(result).toHaveProperty('tts');
    });

    it('should handle disabled backup source', async () => {
        configService.get.mockReturnValue({
            location: { timezone: 'Europe/London' },
            sources: {
                primary: { type: 'aladhan' },
                backup: { type: 'mymasjid', enabled: false } // Disabled
            }
        });

        const result = await healthCheck.refresh('backupSource');
        expect(result.backupSource.healthy).toBe(false);
        expect(result.backupSource.message).toContain('Disabled');
    });

    it('should handle missing source configuration', async () => {
        configService.get.mockReturnValue({
            location: { timezone: 'Europe/London' },
            sources: {} // No sources
        });

        const result = await healthCheck.refresh('primarySource');
        expect(result.primarySource.healthy).toBe(false);
        expect(result.primarySource.message).toContain('Not Configured');
    });
});
