const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENV_PATH = process.env.ENV_FILE_PATH || path.join(__dirname, '../../.env');

/**
 * Parses the .env file and returns its content as an object.
 * 
 * @returns {Object} An object containing the environment variables.
 */
const parseEnv = () => {
    if (!fs.existsSync(ENV_PATH)) return {};
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    const lines = content.split('\n'); // Split by new line, handling different EOLs might be needed but usually split \n covers it or \r\n
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
};

/**
 * Sets an environment variable in the .env file and updates the current process.
 * 
 * @param {string} key - The environment variable key.
 * @param {string} value - The environment variable value.
 * @returns {void}
 */
const setEnvValue = (key, value) => {
    // Read existing
    let content = '';
    if (fs.existsSync(ENV_PATH)) {
        content = fs.readFileSync(ENV_PATH, 'utf-8');
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

    fs.writeFileSync(ENV_PATH, newLines.join('\n'));
    
    // Update current process
    process.env[key] = value;
};

/**
 * Deletes an environment variable from the .env file and removes it from the current process.
 * 
 * @param {string} key - The environment variable key to delete.
 * @returns {void}
 */
const deleteEnvValue = (key) => {
    if (!fs.existsSync(ENV_PATH)) return;

    let content = fs.readFileSync(ENV_PATH, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    const newLines = lines.filter(line => !line.trim().startsWith(`${key}=`));

    if (newLines.length !== lines.length) {
        fs.writeFileSync(ENV_PATH, newLines.join('\n'));
        delete process.env[key];
    }
};

/**
 * Generates a secure random secret string using the crypto module.
 * 
 * @returns {string} A 64-character hexadecimal string.
 */
const generateSecret = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Checks if the application is correctly configured by verifying the presence of critical environment variables.
 * 
 * @returns {boolean} True if the application is configured, otherwise false.
 */
const isConfigured = () => !!process.env.ADMIN_PASSWORD;

/**
 * Reloads environment variables from the .env file into process.env.
 */
const reloadEnv = () => {
    const dotenv = require('dotenv');
    const result = dotenv.config({ path: ENV_PATH, override: true });
    if (result.error) {
        throw result.error;
    }
};

module.exports = {
    getEnv: parseEnv,
    setEnvValue,
    setEnvValue,
    deleteEnvValue,
    generateSecret,
    isConfigured,
    reloadEnv
};
