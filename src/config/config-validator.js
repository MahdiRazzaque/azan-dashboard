import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

// Validate environment variables
function validateEnv() {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
        console.error("Error: ADMIN_USERNAME and ADMIN_PASSWORD_HASH are required in .env file");
        process.exit(1);
    }
}

// Load and validate config
function loadConfig() {
    const configPath = path.join(__dirname, '../../config.json');
    const appConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    if (!appConfig.GuidId) {
        console.error("Error: GuidId is required in config.json");
        process.exit(1);
    }

    return appConfig;
}

// Initialize configuration
validateEnv();
const appConfig = loadConfig();

export { appConfig }; 