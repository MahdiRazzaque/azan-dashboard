const { encrypt, decrypt, mask, isMasked } = require('@utils/encryption');

describe('Encryption Utils', () => {
    const secretKey = 'test-secret-key-32-chars-long-!!!';
    const plaintext = 'sensitive-data-123';
    const originalSalt = process.env.ENCRYPTION_SALT;

    beforeAll(() => {
        // Set salt for tests
        process.env.ENCRYPTION_SALT = 'test-salt-for-unit-tests';
    });

    afterAll(() => {
        process.env.ENCRYPTION_SALT = originalSalt;
    });

    describe('encrypt/decrypt', () => {
        it('should encrypt and decrypt back to original value', async () => {
            const ciphertext = await encrypt(plaintext, secretKey);
            expect(ciphertext).not.toBe(plaintext);
            expect(ciphertext).toContain(':'); // Expecting iv:authTag:encrypted format
            
            const decrypted = await decrypt(ciphertext, secretKey);
            expect(decrypted).toBe(plaintext);
        });

        it('should produce different ciphertexts for same plaintext (IV)', async () => {
            const cipher1 = await encrypt(plaintext, secretKey);
            const cipher2 = await encrypt(plaintext, secretKey);
            expect(cipher1).not.toBe(cipher2);
        });

        it('should throw error for invalid key', async () => {
            const ciphertext = await encrypt(plaintext, secretKey);
            await expect(decrypt(ciphertext, 'wrong-key-32-chars-long-!!!!!!!')).rejects.toThrow();
        });

        it('should throw error for tampered ciphertext', async () => {
            const ciphertext = await encrypt(plaintext, secretKey);
            const tampered = ciphertext.slice(0, -1) + (ciphertext.slice(-1) === 'a' ? 'b' : 'a');
            await expect(decrypt(tampered, secretKey)).rejects.toThrow();
        });

        it('should return plaintext if empty or null', async () => {
            expect(await encrypt('', secretKey)).toBe('');
            expect(await encrypt(null, secretKey)).toBe(null);
        });

        it('should return ciphertext if empty or does not contain colon', async () => {
            expect(await decrypt('', secretKey)).toBe('');
            expect(await decrypt('not-encrypted', secretKey)).toBe('not-encrypted');
            expect(await decrypt(null, secretKey)).toBe(null);
        });

        it('should throw error for invalid ciphertext format (wrong number of parts)', async () => {
            await expect(decrypt('part1:part2', secretKey)).rejects.toThrow('Invalid ciphertext format');
            await expect(decrypt('part1:part2:part3:part4', secretKey)).rejects.toThrow('Invalid ciphertext format');
        });

        it('should throw error if ENCRYPTION_SALT is missing', async () => {
            const currentSalt = process.env.ENCRYPTION_SALT;
            delete process.env.ENCRYPTION_SALT;
            try {
                await expect(encrypt(plaintext, secretKey)).rejects.toThrow('ENCRYPTION_SALT environment variable is required');
            } finally {
                process.env.ENCRYPTION_SALT = currentSalt;
            }
        });
    });

    describe('masking', () => {
        it('should mask values', () => {
            expect(mask('secret')).toBe('********');
        });

        it('should correctly identify masked values', () => {
            expect(isMasked('********')).toBe(true);
            expect(isMasked('secret')).toBe(false);
            expect(isMasked('')).toBe(false);
            expect(isMasked(null)).toBe(false);
        });
    });
});