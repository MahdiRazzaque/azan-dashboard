/**
 * config-manager.js - Manages configuration state and access across the application
 * Handles loading, caching, and accessing configuration settings.
 */
import { validateConfig } from './config-validator.js';

// Private configuration object
let _appConfig = {};

/**
 * Retrieves the current application configuration or a specific section
 * 
 * @param {string} [section] - Optional specific section to retrieve (e.g., 'prayerData', 'general')
 * @returns {Object} - The requested configuration or section
 */
function getConfig(section = null) {
    if (section) {
        return _appConfig[section] ? structuredClone(_appConfig[section]) : null;
    }
    // Return a copy to prevent direct mutation
    return structuredClone(_appConfig);
}

/**
 * Updates the internal configuration with a new version
 * 
 * @param {Object} newConfig - The new configuration to apply
 * @returns {Object} - The updated configuration object (as a copy)
 */
function refreshConfig(newConfig) {
    // Clear the existing config object
    Object.keys(_appConfig).forEach(key => delete _appConfig[key]);
    
    // Copy all properties from the new config
    Object.assign(_appConfig, newConfig);
    
    // Return a copy to prevent direct mutation
    return structuredClone(_appConfig);
}

/**
 * Initializes the configuration
 * 
 * @param {Object} initialConfig - The initial configuration object
 * @returns {boolean} - Whether initialization was successful
 */
function initializeConfig(initialConfig) {
    try {
        // Set the config
        refreshConfig(initialConfig);
        
        // Validate the configuration
        const isValid = validateConfig(_appConfig);
        
        if (!isValid) {
            console.error('❌ Configuration validation failed during initialization');
            return false;
        }
        
        console.log('✅ Configuration initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize configuration:', error);
        return false;
    }
}

/**
 * Updates a specific section of the configuration
 * 
 * @param {string} section - The section to update
 * @param {Object} data - The new data for the section
 * @returns {Object} - The updated configuration
 */
function updateConfigSection(section, data) {
    if (!section || !data) {
        console.error('❌ Cannot update config section: missing section name or data');
        return _appConfig;
    }

    // Create a deep copy of current config to avoid direct mutations
    const updatedConfig = structuredClone(_appConfig);
    updatedConfig[section] = data;
    
    // Update the internal config
    refreshConfig(updatedConfig);
    
    return getConfig();
}

// Export the public API
export {
    getConfig,
    refreshConfig,
    initializeConfig,
    updateConfigSection
};
