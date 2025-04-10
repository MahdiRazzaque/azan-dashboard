import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Validate environment variables
 * @returns {boolean} - Whether environment variables are valid
 */
function validateEnv() {
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH) {
        console.error("Error: ADMIN_USERNAME and ADMIN_PASSWORD_HASH are required in .env file");
        process.exit(1);
    }
    return true;
}

/**
 * Validate configuration object
 * @param {Object} configToValidate - Config object to validate
 * @returns {boolean} - Whether configuration is valid
 */
function validateConfig(configToValidate) {
    try {
        // Validate prayer data configuration
        if (!configToValidate.prayerData) {
            console.error("Error: prayerData configuration is missing");
            return false;
        }

        if (!['mymasjid', 'local'].includes(configToValidate.prayerData.source)) {
            console.error("Error: prayerData.source must be either 'mymasjid' or 'local'");
            return false;
        }

        if (configToValidate.prayerData.source === 'mymasjid' && !configToValidate.prayerData.mymasjid?.guidId) {
            console.error("Error: guidId is required when using mymasjid as prayer data source");
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to validate configuration:', error);
        return false;
    }
}

// Export functions
export { validateEnv, validateConfig };