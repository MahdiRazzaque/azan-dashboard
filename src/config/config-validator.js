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
    
    // Validate prayer data configuration
    if (!appConfig.prayerData) {
        console.error("Error: prayerData configuration is required in config.json");
        process.exit(1);
    }

    if (!['mymasjid', 'local'].includes(appConfig.prayerData.source)) {
        console.error("Error: prayerData.source must be either 'mymasjid' or 'local'");
        process.exit(1);
    }

    if (appConfig.prayerData.source === 'mymasjid' && !appConfig.prayerData.mymasjid?.guidId) {
        console.error("Error: guidId is required when using mymasjid as prayer data source");
        process.exit(1);
    }

    return appConfig;
}

// Initialise configuration
validateEnv();
const appConfig = loadConfig();

export { appConfig }; 