const fs = require('fs');
const path = require('path');

describe('Configuration Loader - Automation', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('should load automation settings from default.json', () => {
        const config = require('../../src/config');
        expect(config.automation).toBeDefined();
        expect(config.automation.global.enabled).toBe(false);
        expect(config.automation.triggers.fajr.preAdhan.offsetMinutes).toBe(15);
    });

    test('should override automation settings with environment variables', () => {
        process.env.BASE_URL = 'http://test-url.com';
        process.env.PYTHON_SERVICE_URL = 'http://test-python.com';
        process.env.VOICEMONKEY_access_token = 'secret_access';
        process.env.VOICEMONKEY_secret_token = 'secret_token';

        const config = require('../../src/config');

        expect(config.automation.baseUrl).toBe('http://test-url.com');
        expect(config.automation.pythonServiceUrl).toBe('http://test-python.com');
        expect(config.automation.voiceMonkey.accessToken).toBe('secret_access');
        expect(config.automation.voiceMonkey.secretToken).toBe('secret_token');
    });

    test('should validate automation schema strictly', () => {
        // Mock fs.readFileSync to return config with invalid target
        const defaultConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../../src/config/default.json'), 'utf-8'));
        const invalidConfig = { ...defaultConfig };
        invalidConfig.automation.triggers.fajr.preAdhan.targets = ['invalid_target'];

        jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(invalidConfig));

        expect(() => {
            require('../../src/config');
        }).toThrow('Configuration validation failed');
    });
});
