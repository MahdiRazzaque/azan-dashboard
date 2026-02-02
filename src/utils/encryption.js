const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Derives a 32-byte key from a secret string using scrypt.
 * @param {string} secret - The raw secret string used to derive the cryptographic key.
 * @returns {Promise<Buffer>} A Promise resolving to a 32-byte Buffer containing the derived key.
 * @private
 */
async function _deriveKey(secret) {
    const salt = process.env.ENCRYPTION_SALT;
    
    if (!salt) {
        throw new Error('ENCRYPTION_SALT environment variable is required');
    }

    // 16384 cost, 8 block size, 1 parallelisation - robust but fast enough for small secrets
    return scrypt(secret, salt, 32, { N: 16384, r: 8, p: 1 });
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} plaintext - The text to encrypt.
 * @param {string} key - The secret key (will be derived via scrypt).
 * @returns {Promise<string>} A Promise resolving to the encrypted string in format iv:authTag:ciphertext.
 */
async function encrypt(plaintext, key) {
    if (!plaintext) return plaintext;
    
    const derivedKey = await _deriveKey(key);
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, derivedKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string using AES-256-GCM.
 * @param {string} ciphertext - The encrypted string in format iv:authTag:ciphertext.
 * @param {string} key - The secret key (must match encryption key).
 * @returns {Promise<string>} A Promise resolving to the decrypted plaintext.
 */
async function decrypt(ciphertext, key) {
    if (!ciphertext || !ciphertext.includes(':')) return ciphertext;
    
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid ciphertext format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const derivedKey = await _deriveKey(key);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

/**
 * Returns a masked representation of a sensitive value.
 * @returns {string} A string consisting of eight asterisks to represent a masked value.
 */
function mask() {
    return '********';
}

/**
 * Checks if a value is masked.
 * @param {any} value - The value to check for masking.
 * @returns {boolean} True if the value matches the standard mask string, false otherwise.
 */
function isMasked(value) {
    return value === '********';
}

module.exports = {
    encrypt,
    decrypt,
    mask,
    isMasked
};