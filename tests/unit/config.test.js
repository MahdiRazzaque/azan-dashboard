const fs = require('fs/promises'); // Use promises version
const path = require('path');
const { ConfigService, ConfigNotInitializedError } = require('../../src/config/ConfigService');

// We need to mock fs/promises to prevent reading real files
jest.mock('fs/promises');
jest.mock('dotenv'); // Prevent loading real .env files

describe('ConfigService', () => {
    let configService;
    const mockPrayer = { iqamahOffset: 10, roundTo: 10, fixedTime: null, iqamahOverride: false };
    const mockTriggers = { 
        fajr: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } },
        dhuhr: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } },
        asr: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } },
        maghrib: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } },
        isha: { preAdhan: { enabled: false, type: 'tts', targets: [] }, adhan: { enabled: false, type: 'tts', targets: [] }, preIqamah: { enabled: false, type: 'tts', targets: [] }, iqamah: { enabled: false, type: 'tts', targets: [] } }
    };

    const mockDefaultConfig = JSON.stringify({
        location: { timezone: 'Europe/London', coordinates: { lat: 1, long: 1 } },
        calculation: { method: 'TEST', madhab: 'TEST' },
        prayers: { 
            fajr: mockPrayer, dhuhr: mockPrayer, asr: mockPrayer, maghrib: mockPrayer, isha: mockPrayer 
        },
        sources: { primary: { type: 'test' } },
        automation: { 
            global: {}, 
            voiceMonkey: { enabled: false },
            baseUrl: 'http://test',
            audioPlayer: 'mpg123',
            pythonServiceUrl: 'http://test',
            triggers: mockTriggers 
        },
        data: { staleCheckDays: 7 }
    });

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        configService = new ConfigService();
        // Default behavior: return valid default config
        fs.readFile.mockResolvedValue(mockDefaultConfig);
        // Default behavior: local config not found
        fs.access.mockRejectedValue({ code: 'ENOENT' });
    });

    test('should throw error if access get() before init()', () => {
        expect(() => configService.get()).toThrow(ConfigNotInitializedError);
    });

    test('should load default configuration on init', async () => {
        await configService.init();
        const config = configService.get();
        expect(config.location.timezone).toBe('Europe/London');
    });

    test('should merge local configuration', async () => {
        const localConfig = JSON.stringify({
            location: { timezone: 'Asia/Dubai' }
        });
        
        fs.access.mockResolvedValue(undefined); // File exists
        fs.readFile.mockImplementation((filepath) => {
            if (filepath.endsWith('local.json')) return Promise.resolve(localConfig);
            return Promise.resolve(mockDefaultConfig);
        });

        await configService.init();
        const config = configService.get();
        expect(config.location.timezone).toBe('Asia/Dubai');
        // Check unmodified fields
        expect(config.sources.primary.type).toBe('test');
    });

    test('should validate configuration schema', async () => {
         const invalidDefault = JSON.stringify({
            location: { timezone: 'Europe/London' } 
            // missing required fields
        });
        fs.readFile.mockResolvedValue(invalidDefault);
        
        await expect(configService.init()).rejects.toThrow();
    });

    test('update() should partial merge and save to local.json', async () => {
        // Setup initial state
        const initialLocal = JSON.stringify({ old: 'val' });
        fs.access.mockResolvedValue(undefined);
        fs.readFile.mockImplementation((filepath) => {
            if (filepath.endsWith('local.json')) return Promise.resolve(initialLocal);
            return Promise.resolve(mockDefaultConfig);
        });

        await configService.init();
        
        // Update
        const updates = { location: { timezone: 'US/Eastern' } };
        await configService.update(updates);
        
        // Verify Write
        expect(fs.writeFile).toHaveBeenCalled();
        const callArgs = fs.writeFile.mock.calls[0];
        const writtenContent = JSON.parse(callArgs[1]);
        
        expect(writtenContent.location.timezone).toBe('US/Eastern');
        expect(writtenContent.old).toBe('val'); // Should preserve existing local keys? 
        // Wait, schema validation might strip unknown keys if 'strict' or not 'passthrough'.
        // Zod defaults to stripping unknown keys unless .passthrough() is used.
        // My configSchema uses .object() which strips unknown keys by default in Zod 3? 
        // No, Zod 3 .object() by default strips unknown keys upon parse.
        // BUT MergeDeep merges them into the object. 
        // Then `configSchema.parse(fullCandidate)` is called.
        // If 'old' is not in schema, it will be stripped from 'fullCandidate' result but 'newLocalCandidate' is passed to writeFile.
        // 'newLocalCandidate' is constructed via `_mergeDeep(currentLocal, partialConfig)`.
        // So 'old' key implies it was in 'currentLocal'.
        // If 'local.json' contains keys NOT in schema, are they allowed?
        // The Service does NOT validate 'newLocalCandidate' directly, it validates 'fullCandidate'.
        // But it writes 'newLocalCandidate'.
        // So 'old' will remain in 'local.json' if it was there.
        // Verify this behavior? The ConfigService test assumes 'old' is preserved in the write.
    });

    test('update() should strip secrets before writing', async () => {
        // Mock Env
        process.env.VOICEMONKEY_access_token = 'SECRET_ENV';
        
        // User tries to save new token
        const updates = { 
            automation: { 
                voiceMonkey: { accessToken: 'USER_TOKEN' }
            } 
        };

        // Mock reads
        fs.readFile.mockResolvedValue(mockDefaultConfig);
        fs.access.mockRejectedValue({ code: 'ENOENT' });

        await configService.init();
        await configService.update(updates);
        
        const callArgs = fs.writeFile.mock.calls[0];
        const writtenContent = JSON.parse(callArgs[1]);
        
        // Should NOT contain accessToken because it's managed by env
        expect(writtenContent.automation?.voiceMonkey?.accessToken).toBeUndefined();
    });
});
