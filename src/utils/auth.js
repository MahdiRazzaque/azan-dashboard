const crypto = require('crypto');

const hashPassword = (password) => {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
};

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
