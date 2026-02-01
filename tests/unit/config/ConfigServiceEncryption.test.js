const fs = require('fs/promises');
const fsHelper = require('../../helpers/fsHelper');
const configService = require('@config');
const encryption = require('@utils/encryption');
const dotenv = require('dotenv');

jest.mock('dotenv'); // Prevent loading real .env files

describe('ConfigService Encryption', () => {
    let tempDir;
    const TEST_KEY = 'test-jwt-secret-64-bytes-long-random-string-placeholder-!!!!!!';

    beforeAll(() => {
        // Mock providers to avoid real factory lookups if they fail in test environment
        // Actually, they should be fine as long as they are required.
    });

    beforeEach(async () => {
        tempDir = await fsHelper.createTempConfig();
        process.env.JWT_SECRET = TEST_KEY;
        // Explicitly clear env vars that might interfere
        delete process.env.VOICEMONKEY_TOKEN;
        delete process.env.VOICEMONKEY_DEVICE;
        configService.reset();
        await configService.init();
    });

    afterEach(async () => {
        await fsHelper.cleanupTempConfig();
        delete process.env.JWT_SECRET;
    });

    it('should encrypt sensitive fields when saving to local.json', async () => {
        const updateData = {
            automation: {
                outputs: {
                    voicemonkey: {
                        params: {
                            token: 'sensitive-token-123'
                        }
                    }
                }
            }
        };

        await configService.update(updateData);

        // Verify file content is encrypted
        const localContent = await fs.readFile(configService._localPath, 'utf-8');
        const localConfig = JSON.parse(localContent);
        const encryptedToken = localConfig.automation.outputs.voicemonkey.params.token;

        expect(encryptedToken).toContain(':'); // IV:AuthTag:Ciphertext
        expect(encryptedToken).not.toBe('sensitive-token-123');
        
        // Decrypt to verify
        const decrypted = encryption.decrypt(encryptedToken, TEST_KEY);
        expect(decrypted).toBe('sensitive-token-123');
    });

    it('should decrypt sensitive fields when loading from local.json', async () => {
        const encryptedToken = encryption.encrypt('loaded-token-456', TEST_KEY);
        const localData = {
            automation: {
                outputs: {
                    voicemonkey: {
                        params: {
                            token: encryptedToken
                        }
                    }
                }
            }
        };

        await fs.writeFile(configService._localPath, JSON.stringify(localData));
        await configService.reload();

        const config = configService.get();
        expect(config.automation.outputs.voicemonkey.params.token).toBe('loaded-token-456');
    });

    it('should handle sources without sensitive fields', async () => {
        const updateData = {
            sources: {
                primary: {
                    type: 'aladhan',
                    method: 15
                }
            }
        };

        await configService.update(updateData);
        const config = configService.get();
        expect(config.sources.primary.type).toBe('aladhan');
    });
});
