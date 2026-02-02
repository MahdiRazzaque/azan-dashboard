const { hashPassword, verifyPassword } = require('@utils/passwordUtils');

describe('Auth Utils (Async)', () => {
    describe('hashPassword', () => {
        it('should return a promise', () => {
             const result = hashPassword('myPassword123');
             expect(result).toBeInstanceOf(Promise);
        });

        it('should resolve to a string with salt and hash separated by colon', async () => {
             const result = await hashPassword('myPassword123');
             expect(result).toContain(':');
             const parts = result.split(':');
             expect(parts).toHaveLength(2);
             expect(parts[0]).toHaveLength(32); // 16 bytes hex
             expect(parts[1]).toHaveLength(128); // 64 bytes hex
        });

        it('should produce different hashes for same password (salt)', async () => {
            const hash1 = await hashPassword('password');
            const hash2 = await hashPassword('password');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('verifyPassword', () => {
        it('should return a promise', async () => {
            const hash = await hashPassword('pass');
            const result = verifyPassword('pass', hash);
            expect(result).toBeInstanceOf(Promise);
        });

        it('should return true for correct password', async () => {
            const password = 'securePassword!';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword(password, hash);
            expect(isValid).toBe(true);
        });

        it('should return false for incorrect password', async () => {
            const password = 'securePassword!';
            const hash = await hashPassword(password);
            const isValid = await verifyPassword('wrongPassword', hash);
            expect(isValid).toBe(false);
        });

        it('should NOT support legacy plain text passwords', async () => {
             const password = 'legacyPassword';
             const isValid = await verifyPassword(password, password);
             expect(isValid).toBe(false); 
        });
    });
});