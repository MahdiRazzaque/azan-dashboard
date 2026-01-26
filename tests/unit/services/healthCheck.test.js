jest.mock('@config', () => ({
    get: jest.fn(() => ({
        location: { timezone: 'Europe/London' },
        sources: {
            primary: { type: 'aladhan' },
            backup: { type: 'mymasjid', enabled: true }
        },
        automation: {
            baseUrl: 'https://test.com',
            voiceMonkey: {
                token: 'test-token',
                device: 'test-device'
            }
        }
    }))
}));

const configService = require('@config');
jest.mock('@providers', () => ({
    ProviderFactory: {
        create: jest.fn()
    }
}));
const { ProviderFactory } = require('@providers');

const fs = require('fs');

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn()
}));

const healthCheck = require('@services/system/healthCheck');
const { exec } = require('child_process');
const axios = require('axios');

jest.mock('child_process');
jest.mock('axios');

describe('Health Check Service', () => {
    let originalPlatform;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        originalPlatform = process.platform;
        fs.existsSync.mockReturnValue(true);
    });

    afterEach(() => {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
        console.log.mockRestore();
        console.warn.mockRestore();
        console.error.mockRestore();
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

    describe('checkLocalAudio Linux Edge Cases', () => {
        it('should report unhealthy on Linux if /dev/snd is missing', async () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });
            exec.mockImplementation((cmd, cb) => cb(null));
            fs.existsSync.mockImplementation((path) => {
                if (path === '/dev/snd') return false;
                if (path === '/.dockerenv') return false;
                return true;
            });
            
            const result = await healthCheck.refresh('local');
            expect(result.local.healthy).toBe(false);
            expect(result.local.message).toBe('No Audio Device');
        });

        it('should report Docker-specific message on Linux if inside Docker and /dev/snd missing', async () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });
            exec.mockImplementation((cmd, cb) => cb(null));
            fs.existsSync.mockImplementation((path) => {
                if (path === '/dev/snd') return false;
                if (path === '/.dockerenv') return true;
                return true;
            });
            
            const result = await healthCheck.refresh('local');
            expect(result.local.healthy).toBe(false);
            expect(result.local.message).toBe('Docker: No Audio HW');
        });
        
        it('should detect Docker via cgroup if .dockerenv is missing', async () => {
             Object.defineProperty(process, 'platform', { value: 'linux' });
             exec.mockImplementation((cmd, cb) => cb(null));
             fs.existsSync.mockImplementation((path) => {
                 if (path === '/dev/snd') return false;
                 if (path === '/.dockerenv') return false;
                 return true;
             });
             fs.readFileSync.mockReturnValue('1:name=systemd:/docker/123456');

             const result = await healthCheck.refresh('local');
             expect(result.local.healthy).toBe(false);
             expect(result.local.message).toBe('Docker: No Audio HW');
        });
    });

    describe('checkVoiceMonkey Edge Cases', () => {
        it('should report unhealthy if baseUrl is missing', async () => {
            configService.get.mockReturnValue({
                location: { timezone: 'Europe/London' },
                automation: { voiceMonkey: { token: 't' } }
            });

            const result = await healthCheck.refresh('voiceMonkey');
            expect(result.voiceMonkey.healthy).toBe(false);
            expect(result.voiceMonkey.message).toBe('Offline: HTTPS Base URL required');
        });

        it('should report unhealthy if baseUrl is not HTTPS', async () => {
            configService.get.mockReturnValue({
                location: { timezone: 'Europe/London' },
                automation: { baseUrl: 'http://test.com', voiceMonkey: { token: 't' } }
            });

            const result = await healthCheck.refresh('voiceMonkey');
            expect(result.voiceMonkey.healthy).toBe(false);
            expect(result.voiceMonkey.message).toBe('Offline: HTTPS Base URL required');
        });

        it('should skip if token is missing', async () => {
            configService.get.mockReturnValue({
                location: { timezone: 'Europe/London' },
                automation: { baseUrl: 'https://test.com', voiceMonkey: { token: null } }
            });
            
            const result = await healthCheck.refresh('voiceMonkey');
            expect(result.voiceMonkey.healthy).toBe(false);
            expect(result.voiceMonkey.message).toBe('Token Missing');
        });

        it('should skip loud check if device is missing', async () => {
             configService.get.mockReturnValue({
                 location: { timezone: 'Europe/London' },
                 automation: { baseUrl: 'https://test.com', voiceMonkey: { token: 't', device: null } }
             });
             
             const result = await healthCheck.refresh('voiceMonkey', 'loud');
             expect(result.voiceMonkey.healthy).toBe(false);
             expect(result.voiceMonkey.message).toBe('Device Missing');
        });

        it('should handle API success false', async () => {
             configService.get.mockReturnValue({
                 automation: { baseUrl: 'https://test.com', voiceMonkey: { token: 't' } }
             });
             axios.get.mockResolvedValue({ data: { success: false, error: 'API Error' } });
             const result = await healthCheck.refresh('voiceMonkey');
             expect(result.voiceMonkey.healthy).toBe(false);
             expect(result.voiceMonkey.message).toBe('API Error');
        });

        it('should handle axios error response with data error', async () => {
             configService.get.mockReturnValue({
                 automation: { baseUrl: 'https://test.com', voiceMonkey: { token: 't' } }
             });
             axios.get.mockRejectedValue({
                 response: { data: { error: 'Network Error' } }
             });
             const result = await healthCheck.refresh('voiceMonkey');
             expect(result.voiceMonkey.healthy).toBe(false);
             expect(result.voiceMonkey.message).toBe('Network Error');
        });

        it('should handle axios error without response data', async () => {
             configService.get.mockReturnValue({
                 automation: { baseUrl: 'https://test.com', voiceMonkey: { token: 't' } }
             });
             axios.get.mockRejectedValue(new Error('Generic Error'));
             const result = await healthCheck.refresh('voiceMonkey');
             expect(result.voiceMonkey.healthy).toBe(false);
             expect(result.voiceMonkey.message).toBe('Generic Error');
        });

        it('should pass loud check if all available', async () => {
             configService.get.mockReturnValue({
                 location: { timezone: 'Europe/London' },
                 automation: { baseUrl: 'https://test.com', voiceMonkey: { token: 't', device: 'd' } }
             });
             axios.get.mockResolvedValue({ data: { success: true } });
             const result = await healthCheck.refresh('voiceMonkey', 'loud');
             expect(result.voiceMonkey.healthy).toBe(true);
             expect(axios.get).toHaveBeenCalledWith(
                 expect.any(String),
                 expect.objectContaining({ params: expect.objectContaining({ device: 'd' }) })
             );
        });
    });

    describe('checkSource Edge Cases', () => {
        it('should report not configured if source is missing', async () => {
             configService.get.mockReturnValue({ 
                 location: { timezone: 'Europe/London' },
                 sources: {} 
             });
             const result = await healthCheck.refresh('primarySource');
             expect(result.primarySource.message).toBe('Not Configured');
        });

        it('should report disabled for backup if enabled is false', async () => {
             configService.get.mockReturnValue({ 
                 location: { timezone: 'Europe/London' },
                 sources: { backup: { enabled: false } } 
             });
             const result = await healthCheck.refresh('backupSource');
             expect(result.backupSource.message).toBe('Disabled');
        });

        it('should test MyMasjid successfully', async () => {
             configService.get.mockReturnValue({ 
                 location: { timezone: 'Europe/London' },
                 sources: { primary: { type: 'mymasjid' } } 
             });
             const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({}) };
             ProviderFactory.create.mockReturnValue(mockProvider);
             const result = await healthCheck.refresh('primarySource');
             expect(result.primarySource.healthy).toBe(true);
        });

        it('should handle source errors', async () => {
             configService.get.mockReturnValue({ 
                 sources: { primary: { type: 'aladhan' } },
                 location: { timezone: 'UTC' } 
             });
             const mockProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('Fetch Fail')) };
             ProviderFactory.create.mockReturnValue(mockProvider);
             const result = await healthCheck.refresh('primarySource');
             expect(result.primarySource.healthy).toBe(false);
             expect(result.primarySource.message).toBe('Fetch Fail');
        });

        it('should handle MyMasjid source errors', async () => {
             configService.get.mockReturnValue({ 
                 location: { timezone: 'Europe/London' },
                 sources: { primary: { type: 'mymasjid' } } 
             });
             const mockProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new Error('MyMasjid Fail')) };
             ProviderFactory.create.mockReturnValue(mockProvider);
             const result = await healthCheck.checkSource('primary');
             expect(result.healthy).toBe(false);
             expect(result.message).toBe('MyMasjid Fail');
        });
    });

    describe('General', () => {
        it('should return cached health via getHealth', () => {
             const health = healthCheck.getHealth();
             expect(health).toHaveProperty('local');
             expect(health).toHaveProperty('lastChecked');
        });

        it('should refresh individual targets like silent', async () => {
            // 'silent' target refreshes local, tts, and voiceMonkey
            exec.mockImplementation((cmd, cb) => cb(null));
            axios.get.mockResolvedValue({ status: 200, data: { success: true } });
            
            await healthCheck.refresh('silent');
            expect(exec).toHaveBeenCalled();
            expect(axios.get).toHaveBeenCalled(); // For both TTS and VM
        });

        it('should refresh lowercase voicemonkey target', async () => {
             configService.get.mockReturnValue({
                 automation: { baseUrl: 'https://test.com', voiceMonkey: { token: 't' } }
             });
             axios.get.mockResolvedValue({ status: 200, data: { success: true } });
             const result = await healthCheck.refresh('voicemonkey');
             expect(result.voiceMonkey.healthy).toBe(true);
        });

        it('should update tts port from environment if present', async () => {
             process.env.PYTHON_SERVICE_URL = 'http://localhost:9999';
             const result = await healthCheck.refresh('local'); 
             expect(result.ports.tts).toBe('9999');
             delete process.env.PYTHON_SERVICE_URL;
        });

        it('should handle PYTHON_SERVICE_URL without port', async () => {
             process.env.PYTHON_SERVICE_URL = 'http://localhost';
             const result = await healthCheck.refresh('local');
             // Should keep previous port if not specified in URL
             expect(result.ports.tts).toBeDefined();
             delete process.env.PYTHON_SERVICE_URL;
        });

        it('should use default PORT if process.env.PORT is missing', async () => {
             const originalPort = process.env.PORT;
             delete process.env.PORT;
             const result = await healthCheck.refresh('local');
             expect(result.ports.api).toBe(3000);
             process.env.PORT = originalPort;
        });

        it('should use process.env.PORT if present', async () => {
             process.env.PORT = '4000';
             const result = await healthCheck.refresh('local');
             expect(result.ports.api).toBe('4000');
             delete process.env.PORT;
        });

        it('should handle invalid PYTHON_SERVICE_URL gracefully', async () => {
             process.env.PYTHON_SERVICE_URL = 'invalid-url';
             const result = await healthCheck.refresh('local');
             expect(result.ports.tts).toBeDefined();
             delete process.env.PYTHON_SERVICE_URL;
        });
    });
});
