const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const ENV_PATH = process.env.ENV_FILE_PATH || path.join(__dirname, '../../.env');

/**
 * Parses the .env file and returns its content as an object.
 * 
 * @returns {Promise<Object>} An object containing the environment variables.
 */
const parseEnv = async () => {
    try {
        await fs.access(ENV_PATH);
        const content = await fs.readFile(ENV_PATH, 'utf-8');
        const lines = content.split(/\r?\n/);
        const result = {};
        lines.forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                result[key] = value;
            }
        });
        return result;
    } catch {
        return {};
    }
};

/**
 * Sets an environment variable in the .env file and updates the current process.
 * 
 * @param {string} key - The environment variable key.
 * @param {string} value - The environment variable value.
 * @returns {Promise<void>}
 */
const setEnvValue = async (key, value) => {
    // Read existing
    let content = '';
    try {
        await fs.access(ENV_PATH);
        content = await fs.readFile(ENV_PATH, 'utf-8');
    } catch {
        // File doesn't exist, start with empty content
    }

    const lines = content.split(/\r?\n/);
    let found = false;
    
    const newLines = lines.map(line => {
        if (line.trim().startsWith(`${key}=`)) {
            found = true;
            return `${key}=${value}`;
        }
        return line;
    });

    if (!found) {
        if (newLines.length > 0 && newLines[newLines.length - 1] !== '') {
             newLines.push('');
        }
        newLines.push(`${key}=${value}`);
    }

    await fs.writeFile(ENV_PATH, newLines.join('\n'));
    
    // Update current process
    process.env[key] = value;
};

/**
 * Deletes an environment variable from the .env file and removes it from the current process.
 * 
 * @param {string} key - The environment variable key to delete.
 * @returns {Promise<void>}
 */
const deleteEnvValue = async (key) => {
    try {
        await fs.access(ENV_PATH);
        const content = await fs.readFile(ENV_PATH, 'utf-8');
        const lines = content.split(/\r?\n/);
        
        const newLines = lines.filter(line => !line.trim().startsWith(`${key}=`));

        if (newLines.length !== lines.length) {
            await fs.writeFile(ENV_PATH, newLines.join('\n'));
            delete process.env[key];
        }
    } catch {
        // File doesn't exist, nothing to delete
    }
};

/**
 * Generates a secure random secret string using the crypto module.
 * 
 * @param {number} [length=32] - The number of random bytes to generate.
 * @returns {string} A hexadecimal string.
 */
const generateSecret = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Checks if the application is correctly configured by verifying the presence of critical environment variables.
 * 
 * @returns {boolean} True if the application is configured, otherwise false.
 */
const isConfigured = () => !!process.env.ADMIN_PASSWORD;

module.exports = {
    getEnv: parseEnv,
    setEnvValue,
    deleteEnvValue,
    generateSecret,
    isConfigured
};