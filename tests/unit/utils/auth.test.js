const { hashPassword, verifyPassword } = require('../../../src/utils/auth');

describe('Auth Utils', () => {
    describe('hashPassword', () => {
        it('should return a string with salt and hash separated by colon', () => {
             const result = hashPassword('myPassword123');
             expect(result).toContain(':');
             const parts = result.split(':');
             expect(parts).toHaveLength(2);
             expect(parts[0]).toHaveLength(32); // 16 bytes hex
             expect(parts[1]).toHaveLength(128); // 64 bytes hex
        });

        it('should produce different hashes for same password (salt)', () => {
            const hash1 = hashPassword('password');
            const hash2 = hashPassword('password');
            expect(hash1).not.toBe(hash2);
        });
    });

    describe('verifyPassword', () => {
        it('should return true for correct password', () => {
            const password = 'securePassword!';
            const hash = hashPassword(password);
            expect(verifyPassword(password, hash)).toBe(true);
        });

        it('should return false for incorrect password', () => {
            const password = 'securePassword!';
            const hash = hashPassword(password);
            expect(verifyPassword('wrongPassword', hash)).toBe(false);
        });

        it('should support legacy plain text passwords', () => {
             const password = 'legacyPassword';
             // Simulating old storage format (no colon)
             expect(verifyPassword(password, password)).toBe(true); 
        });

        it('should return false for legacy mismatch', () => {
             expect(verifyPassword('wrong', 'right')).toBe(false);
        });
        
        it('should return false for empty/null stored hash', () => {
            expect(verifyPassword('pass', null)).toBe(false);
            expect(verifyPassword('pass', '')).toBe(false);
        });
        
        it('should return false for malformed hash', () => {
            expect(verifyPassword('pass', 'nosalt:hash')).toBe(false); // Wait, length check logic? 
            // The code splits by ':' and checks if both parts exist.
            expect(verifyPassword('pass', ':')).toBe(false);
        });
    });
});
