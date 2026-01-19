const crypto = require('crypto');

/**
 * Hashes a plain text password using a random salt and the scrypt algorithm.
 * 
 * @param {string} password - The plain text password to hash.
 * @returns {string} A string containing the salt and hash, separated by a colon.
 */
const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
};

/**
 * Verifies a plain text password against a stored salt-and-hash string.
 * Supports backward compatibility for plain text passwords.
 * 
 * @param {string} password - The plain text password to verify.
 * @param {string} storedHash - The stored hash string (salt:hash) or legacy plain text.
 * @returns {boolean} True if the password is valid, otherwise false.
 */
const verifyPassword = (password, storedHash) => {
    if (!storedHash) return false;
    
    // Support legacy plain text (backward compatibility)
    if (!storedHash.includes(':')) {
        return password === storedHash;
    }

    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;

    const verifyHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return originalHash === verifyHash;
};

module.exports = { hashPassword, verifyPassword };
