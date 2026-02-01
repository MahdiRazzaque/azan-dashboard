const { encrypt, decrypt, mask, isMasked } = require('@utils/encryption');

describe('Encryption Utils', () => {
    const secretKey = 'test-secret-key-32-chars-long-!!!';
    const plaintext = 'sensitive-data-123';

    describe('encrypt/decrypt', () => {
        it('should encrypt and decrypt back to original value', () => {
            const ciphertext = encrypt(plaintext, secretKey);
            expect(ciphertext).not.toBe(plaintext);
            expect(ciphertext).toContain(':'); // Expecting iv:authTag:encrypted format
            
            const decrypted = decrypt(ciphertext, secretKey);
            expect(decrypted).toBe(plaintext);
        });

        it('should produce different ciphertexts for same plaintext (IV)', () => {
            const cipher1 = encrypt(plaintext, secretKey);
            const cipher2 = encrypt(plaintext, secretKey);
            expect(cipher1).not.toBe(cipher2);
        });

        it('should throw error for invalid key', () => {
            const ciphertext = encrypt(plaintext, secretKey);
            expect(() => decrypt(ciphertext, 'wrong-key-32-chars-long-!!!!!!!')).toThrow();
        });

        it('should throw error for tampered ciphertext', () => {
            const ciphertext = encrypt(plaintext, secretKey);
            const tampered = ciphertext.slice(0, -1) + (ciphertext.slice(-1) === 'a' ? 'b' : 'a');
            expect(() => decrypt(tampered, secretKey)).toThrow();
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
