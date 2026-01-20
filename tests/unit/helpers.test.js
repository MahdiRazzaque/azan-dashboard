const fs = require('fs/promises');
const path = require('path');
const fsHelper = require('../helpers/fsHelper');
const authHelper = require('../helpers/authHelper');
const configService = require('@config');

describe('Test Helpers', () => {
    describe('fsHelper', () => {
        afterEach(async () => {
            await fsHelper.cleanupTempConfig();
        });

        it('should create a temp config and inject it into ConfigService', async () => {
            const tempDir = await fsHelper.createTempConfig();
            
            // Verify directory exists
            const stats = await fs.stat(tempDir);
            expect(stats.isDirectory()).toBe(true);

            // Verify ConfigService has updated paths
            expect(configService._configPath).toContain(tempDir);
            
            // Verify we can init and read config
            await configService.init();
            const config = configService.get();
            expect(config.location.timezone).toBe('Europe/London');
        });
    });

    describe('authHelper', () => {
        it('should generate a valid auth token cookie', () => {
             const cookie = authHelper.getAuthToken();
             expect(cookie).toMatch(/^auth_token=eyJ/);
        });
    });
});
