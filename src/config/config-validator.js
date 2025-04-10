import { config } from 'dotenv';
import { getConfig as getConfigFromDb } from './config-service.js';

// Load environment variables
config();

// App config will be loaded from database (private)
let _appConfig = {};

// Validate environment variables
function validateEnv() {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
        console.error("Error: ADMIN_USERNAME and ADMIN_PASSWORD_HASH are required in .env file");
        process.exit(1);
    }
}

/**
 * Get the current application configuration or a specific section
 * @param {string} [section] - Optional specific section to retrieve
 * @returns {Object} - The requested configuration or section
 */
function getAppConfig(section = null) {
    if (section) {
        return _appConfig[section] ? structuredClone(_appConfig[section]) : null;
    }
    // Return a copy to prevent direct mutation
    return structuredClone(_appConfig);
}

/**
 * Refresh the appConfig object with a new configuration
 * @param {Object} newConfig - The new configuration to apply
 * @returns {Object} - The updated appConfig object
 */
function refreshAppConfig(newConfig) {
    // Clear the existing appConfig object
    Object.keys(_appConfig).forEach(key => delete _appConfig[key]);
    
    // Copy all properties from the new config
    Object.assign(_appConfig, newConfig);
    
    return structuredClone(_appConfig);
}

// Load and validate config from MongoDB
async function loadConfig() {
    try {
        // Get config from database via service
        const config = await getConfigFromDb();
        // Update our private appConfig
        refreshAppConfig(config);
        
        // Validate prayer data configuration
        if (!_appConfig.prayerData) {
            console.error("Error: prayerData configuration is missing");
            return false;
        }

        if (!['mymasjid', 'local'].includes(_appConfig.prayerData.source)) {
            console.error("Error: prayerData.source must be either 'mymasjid' or 'local'");
            return false;
        }

        if (_appConfig.prayerData.source === 'mymasjid' && !_appConfig.prayerData.mymasjid?.guidId) {
            console.error("Error: guidId is required when using mymasjid as prayer data source");
            return false;
        }
        
        console.log('✅ Configuration loaded from MongoDB');
        return true;
    } catch (error) {
        console.error('❌ Failed to load configuration from MongoDB:', error);
        return false;
    }
}

// Export variables and functions
export { getAppConfig, loadConfig, validateEnv, refreshAppConfig };