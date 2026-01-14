const fs = require('fs/promises');
const fsHelper = require('../../helpers/fsHelper');
const configService = require('../../../src/config'); 

jest.mock('dotenv'); // Prevent loading real .env files

describe('ConfigService', () => {
    let tempDir;

    beforeEach(async () => {
        tempDir = await fsHelper.createTempConfig();
        await configService.init();
    });

    afterEach(async () => {
        await fsHelper.cleanupTempConfig();
    });

    it('should load default configuration', () => {
        const config = configService.get();
        expect(config.location.timezone).toBe('Europe/London');
        expect(config.calculation.method).toBe('MoonsightingCommittee');
    });

    it('should throw error if get() called before init()', () => {
        configService.reset();
        expect(() => configService.get()).toThrow('ConfigService not initialized');
    });

    it('should update configuration and strict merge', async () => {
        const updateData = {
            location: {
                timezone: 'Asia/Dubai'
            }
        };

        await configService.update(updateData);
        
        const config = configService.get();
        expect(config.location.timezone).toBe('Asia/Dubai');
        expect(config.location.coordinates.lat).toBe(51.5); // Should preserve other fields
    });

    it('should persist updates to local.json', async () => {
        const updateData = { data: { staleCheckDays: 14 } };
        await configService.update(updateData);

        // Verify file content
        const localContent = await fs.readFile(configService._localPath, 'utf-8');
        const localConfig = JSON.parse(localContent);
        expect(localConfig.data.staleCheckDays).toBe(14);
    });

    it('should validate updates against schema', async () => {
         const invalidData = {
             location: { timezone: 123 } // Should be string
         };
         await expect(configService.update(invalidData)).rejects.toThrow();
    });

    it('should handle concurrency locking', async () => {
         const p1 = configService.update({ data: { staleCheckDays: 1 } });
         const p2 = configService.update({ data: { staleCheckDays: 2 } });
         
         // One should succeed, one should fail or they execute sequentially if logic allowed (but here it throws)
         const results = await Promise.allSettled([p1, p2]);
         const rejected = results.filter(r => r.status === 'rejected');
         
         expect(rejected.length).toBeGreaterThanOrEqual(1);
         expect(rejected[0].reason.message).toMatch(/save in progress/);
    });

    it('should apply environment variable overrides', async () => {
        process.env.BASE_URL = 'http://env-override.com';
        process.env.PYTHON_SERVICE_URL = 'http://python-env.com';
        
        // Reload to apply
        await configService.reload();
        const config = configService.get();
        
        expect(config.automation.baseUrl).toBe('http://env-override.com');
        expect(config.automation.pythonServiceUrl).toBe('http://python-env.com');
        
        // Cleanup
        delete process.env.BASE_URL;
        delete process.env.PYTHON_SERVICE_URL;
    });

    it('should merge arrays by overwriting', async () => {
         // config.automation.triggers.fajr.preAdhan.targets is an array
         const updateData = { 
             automation: { 
                 triggers: { 
                     fajr: { 
                         preAdhan: { 
                             targets: ['voiceMonkey'] // default is ['local']
                         } 
                     } 
                 } 
             } 
         };
         
         await configService.update(updateData);
         const config = configService.get();
         expect(config.automation.triggers.fajr.preAdhan.targets).toEqual(['voiceMonkey']);
    });

    it('should ignore missing local config', async () => {
         // Ensure local.json doesn't exist
         await fs.rm(configService._localPath, { force: true });
         await configService.reload();
         const config = configService.get();
         expect(config).toBeDefined();
    });

    it('should strip existing secrets when saving', async () => {
         process.env.VOICEMONKEY_access_token = 'secret';
         
         const updateData = { 
             automation: { 
                 voiceMonkey: { accessToken: 'check' } 
             } 
         };
         
         // It should save, but strip the token because env var is present
         await configService.update(updateData);
         
         // Read file directly to ensure it's not there
         const localContent = await fs.readFile(configService._localPath, 'utf-8');
         const localConfig = JSON.parse(localContent);
         
         // Depending on logic: _stripSecrets checks if process.env.VOICEMONKEY_access_token exists,
         // then deletes config.automation.voiceMonkey.accessToken.
         
         expect(localConfig.automation.voiceMonkey.accessToken).toBeUndefined();
         
         delete process.env.VOICEMONKEY_access_token;
    });
});
