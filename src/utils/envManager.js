const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENV_PATH = path.join(__dirname, '../../.env');

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

const generateSecret = () => {
    return crypto.randomBytes(32).toString('hex');
};

module.exports = {
    getEnv: parseEnv,
    setEnvValue,
    generateSecret,
    isConfigured: () => !!process.env.ADMIN_PASSWORD
};
