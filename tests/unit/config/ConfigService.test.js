const fs = require('fs/promises');
const fsHelper = require('../../helpers/fsHelper');
const configService = require('@config');
const dotenv = require('dotenv');

jest.mock('dotenv'); // Prevent loading real .env files

describe('ConfigService', () => {
    let tempDir;

    beforeAll(() => {
        process.env.JWT_SECRET = 'test-jwt-secret';
        process.env.ENCRYPTION_SALT = 'test-encryption-salt';
    });

    beforeEach(async () => {
        tempDir = await fsHelper.createTempConfig();
        await configService.init();
    });

    afterEach(async () => {
        await fsHelper.cleanupTempConfig();
    });

    afterAll(() => {
        delete process.env.JWT_SECRET;
        delete process.env.ENCRYPTION_SALT;
    });

    it('should load default configuration', () => {
        const config = configService.get();
        expect(config.location.timezone).toBe('Europe/London');
        expect(config.sources.primary.method).toBe(15);
    });

    it('should throw error if get() called before init()', () => {
        configService.reset();
        expect(() => configService.get()).toThrow('ConfigService not initialised. Call init() first.');
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
        process.env.VOICEMONKEY_TOKEN = 'env-token';
        process.env.VOICEMONKEY_DEVICE = 'env-device';
        
        // Reload to apply
        await configService.reload();
        const config = configService.get();
        
        expect(config.automation.baseUrl).toBe('http://env-override.com');
        expect(config.automation.pythonServiceUrl).toBe('http://python-env.com');
        // V2 Structure
        expect(config.automation.outputs.voicemonkey.params.token).toBe('env-token');
        expect(config.automation.outputs.voicemonkey.params.device).toBe('env-device');
        
        // Cleanup
        delete process.env.BASE_URL;
        delete process.env.PYTHON_SERVICE_URL;
        delete process.env.VOICEMONKEY_TOKEN;
        delete process.env.VOICEMONKEY_DEVICE;
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

    it('should migrate and encrypt existing secrets from env when updating', async () => {
         process.env.VOICEMONKEY_TOKEN = 'secret-env';
         
         const updateData = { 
             automation: { 
                 outputs: {
                     voicemonkey: { params: { token: 'check' } }
                 }
             } 
         };
         
         // It should save and encrypt
         await configService.update(updateData);
         
         // Read file directly to ensure it's encrypted
         const localContent = await fs.readFile(configService._localPath, 'utf-8');
         const localConfig = JSON.parse(localContent);
         
         expect(localConfig.automation.outputs.voicemonkey.params.token).toContain(':');
         
         delete process.env.VOICEMONKEY_TOKEN;
    });

    it('should log warning if local config fails to load with non-ENOENT error', async () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(fs, 'access').mockRejectedValue({ code: 'EACCES', message: 'Permission denied' });
        
        await configService.reload();
        
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Warning: Failed to load local config'), expect.anything());
        spy.mockRestore();
        fs.access.mockRestore();
    });

    it('should handle empty local.json gracefully', async () => {
        await fs.writeFile(configService._localPath, '   ');
        await configService.reload();
        const config = configService.get();
        expect(config).toBeDefined();
        // Should still be at defaults
        expect(config.location.timezone).toBe('Europe/London');
    });

    it('should handle corrupt local.json gracefully in reload', async () => {
        const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        await fs.writeFile(configService._localPath, '{ invalid: json }');
        await configService.reload();
        
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Warning: Failed to load local config'), expect.anything());
        spy.mockRestore();
    });

    it('should handle corrupt local.json gracefully in update', async () => {
        await fs.writeFile(configService._localPath, '{ invalid: json }');
        
        const updateData = { location: { timezone: 'Asia/Dubai' } };
        await configService.update(updateData);
        
        const config = configService.get();
        expect(config.location.timezone).toBe('Asia/Dubai');
    });

    it('should throw error if local config fails to load with non-ENOENT error in update', async () => {
        const originalReadFile = fs.readFile;
        jest.spyOn(fs, 'readFile').mockImplementation(async (path, opts) => {
            if (path && typeof path === 'string' && path.includes('local.json')) {
                throw { code: 'EACCES' };
            }
            return originalReadFile(path, opts);
        });

        await expect(configService.update({})).rejects.toMatchObject({ code: 'EACCES' });
        fs.readFile.mockRestore();
    });

    it('should skip env overrides if automation is missing', () => {
        const config = { location: {} };
        configService._applyEnvOverrides(config);
        expect(config.automation).toBeUndefined();
    });

    it('should not initialize twice', async () => {
        // configService is already initialized in beforeEach
        const spy = jest.spyOn(configService, 'reload');
        await configService.init();
        expect(spy).not.toHaveBeenCalled();
    });

    it('should handle nulls in mergeDeep', () => {
        const res = configService._mergeDeep(null, { a: 1 });
        expect(res).toEqual({ a: 1 });
        const res2 = configService._mergeDeep({ a: 1 }, null);
        expect(res2).toEqual({ a: 1 });
    });

    it('should migrate V1 local config to V3 on reload', async () => {
        const v1Local = {
            automation: {
                voiceMonkey: {
                    enabled: true,
                    token: 'migToken',
                    device: 'migDevice'
                }
            }
        };
        await fs.writeFile(configService._localPath, JSON.stringify(v1Local));
        
        // reload should trigger migration
        await configService.reload();
        
        // Check file content updated
        const localContent = await fs.readFile(configService._localPath, 'utf-8');
        const localConfig = JSON.parse(localContent);
        
        expect(localConfig.version).toBe(3);
        expect(localConfig.automation.voiceMonkey).toBeUndefined();
        expect(localConfig.automation.outputs.voicemonkey).toBeDefined();
        // Encrypted in file
        expect(localConfig.automation.outputs.voicemonkey.params.token).toContain(':');
        
        // Decrypted in memory
        const config = configService.get();
        expect(config.automation.outputs.voicemonkey.params.token).toBe('migToken');
    });

    it('should clamp leadTimeMs if it exceeds constraints', async () => {
        const invalidConfig = {
            automation: {
                outputs: {
                    voicemonkey: {
                        enabled: true,
                        leadTimeMs: 40000 // Exceeds max (30000)
                    }
                }
            }
        };
        await fs.writeFile(configService._localPath, JSON.stringify(invalidConfig));
        await configService.reload();
        
        const config = configService.get();
        expect(config.automation.outputs.voicemonkey.leadTimeMs).toBe(30000);
    });

    it('should clamp leadTimeMs to default minimum of -30000', async () => {
        const invalidConfig = {
            automation: {
                outputs: {
                    local: {
                        enabled: true,
                        leadTimeMs: -40000 // Below min (-30000)
                    }
                }
            }
        };
        await fs.writeFile(configService._localPath, JSON.stringify(invalidConfig));
        await configService.reload();
        
        const config = configService.get();
        expect(config.automation.outputs.local.leadTimeMs).toBe(-30000);
    });

    it('should sanitise audioPlayer if it is not in allowlist', async () => {
        const invalidConfig = {
            automation: {
                outputs: {
                    local: {
                        params: {
                            audioPlayer: 'malicious_cmd; rm -rf /'
                        }
                    }
                }
            }
        };
        await fs.writeFile(configService._localPath, JSON.stringify(invalidConfig));
        await configService.reload();
        
        const config = configService.get();
        expect(config.automation.outputs.local.params.audioPlayer).toBe('mpg123');
    });
});