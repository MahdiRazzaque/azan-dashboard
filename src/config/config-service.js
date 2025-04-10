/**
 * config-service.js - Unified configuration service for the application
 * Handles both in-memory configuration state and database persistence
 */
import Config from '../database/models/config-model.js';
import { validateConfig } from './config-validator.js';
import readline from 'readline';
import { promisify } from 'util';
import { validateMyMasjidGuildId } from '../prayer/prayer-data-provider.js';

// ----- IN-MEMORY CONFIGURATION MANAGEMENT -----

// Private configuration object for in-memory storage
let _appConfig = {};

/**
 * Retrieves the current in-memory configuration or a specific section
 * This is for internal use - external modules should use getConfig() instead
 * 
 * @param {string} [section] - Optional specific section to retrieve (e.g., 'prayerData', 'general')
 * @returns {Object} - The requested configuration or section
 */
function _getInMemoryConfig(section = null) {
  if (section) {
    return _appConfig[section] ? structuredClone(_appConfig[section]) : null;
  }
  // Return a copy to prevent direct mutation
  return structuredClone(_appConfig);
}

/**
 * Updates the internal in-memory configuration with a new version
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
 * Updates a specific section of the in-memory configuration
 * For internal use only - external modules should use updateConfig()
 * 
 * @param {string} section - The section to update
 * @param {Object} data - The new data for the section
 * @returns {Object} - The updated configuration
 */
function _updateInMemoryConfigSection(section, data) {
  if (!section || !data) {
    console.error('❌ Cannot update config section: missing section name or data');
    return _appConfig;
  }

  // Create a deep copy of current config to avoid direct mutations
  const updatedConfig = structuredClone(_appConfig);
  updatedConfig[section] = data;
  
  // Update the internal config
  refreshConfig(updatedConfig);
  
  return _getInMemoryConfig();
}

/**
 * Initialises the in-memory configuration and validates it
 * 
 * @param {Object} initialConfig - The initial configuration object
 * @returns {boolean} - Whether initialisation was successful
 */
function initializeConfig(initialConfig) {
  try {
    // Set the config
    refreshConfig(initialConfig);
    
    // Validate the configuration
    const isValid = validateConfig(_appConfig);
    
    if (!isValid) {
      console.error('❌ Configuration validation failed during initialisation');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialise configuration:', error);
    return false;
  }
}

// ----- DATABASE CONFIGURATION MANAGEMENT -----

// Cache for database config to avoid frequent reads
let configCache = null;
let cacheTimestamp = null;
const CACHE_LIFETIME = 60000; // 1 minute cache lifetime

/**
 * Get the full configuration from database and sync with in-memory state
 * This is the primary method other modules should use to get configuration
 * 
 * @param {string|boolean} [sectionOrSync] - Optional specific section to retrieve or boolean for sync mode
 * @param {boolean} [sync] - When true, returns the in-memory config immediately without DB lookup
 * @returns {Object|Promise<Object>} - The requested configuration or section
 */
function getConfig(sectionOrSync = null, sync = false) {
  // Handle the case where the first parameter is a boolean (sync flag)
  if (typeof sectionOrSync === 'boolean') {
    sync = sectionOrSync;
    sectionOrSync = null;
  }

  // Handle synchronous mode - return from memory immediately
  if (sync === true) {
    return _getInMemoryConfig(typeof sectionOrSync === 'string' ? sectionOrSync : null);
  }
  
  // Asynchronous implementation
  return _getConfigAsync(typeof sectionOrSync === 'string' ? sectionOrSync : null);
}
  
/**
 * Internal async implementation of getConfig
 * @private
 */
async function _getConfigAsync(section = null) {
  // Return from cache if valid
  const now = Date.now();
  if (configCache && cacheTimestamp && (now - cacheTimestamp < CACHE_LIFETIME)) {
    // If the cache is valid, we can use the in-memory config which should be in sync
    return section ? _getInMemoryConfig(section) : _getInMemoryConfig();
  }
  
  try {
    // Try to get config from database
    let config = await Config.findOne();
    
    // If no config exists, initialise from defaults
    if (!config) {
      config = await initialiseNewConfig();
    }
    
    // Update cache - use lean() to get a plain JavaScript object
    // This avoids issues with Mongoose document serialization
    const cleanConfig = config.toObject ? config.toObject() : config;
    configCache = cleanConfig;
    cacheTimestamp = now;
    
    // Also update the in-memory app config
    refreshConfig(configCache);
    
    // Return the requested section or full config
    return section ? _getInMemoryConfig(section) : configCache;
  } catch (error) {
    console.error('Error retrieving configuration:', error);
    // If we have an in-memory config, return that as fallback
    if (Object.keys(_appConfig).length > 0) {
      console.log('⚠️ Using in-memory configuration as fallback');
      return section ? _getInMemoryConfig(section) : _getInMemoryConfig();
    }
    throw error;
  }
}

/**
 * Create readline interface for terminal input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Promisify the readline question
 */
function askQuestion(rl, question) {
  return new Promise(resolve => {
    rl.question(question, answer => {
      resolve(answer);
    });
  });
}

/**
 * Initialise configuration with default values, prompting for guildId
 */
async function initialiseNewConfig() {
  try {
    console.log('\n===== CONFIGURATION SETUP =====');
    console.log('No configuration found in the database. Let\'s set up your configuration.\n');
    
    // Create readline interface
    const rl = createReadlineInterface();
    
    let guildId = '';
    let isValid = false;
    
    // Keep prompting until a valid guildId is provided
    while (!isValid) {
      // Prompt for guildId
      console.log('Your myMasjid guildId is required to fetch prayer times:');
      guildId = await askQuestion(rl, 'Enter your myMasjid guildId: ');
      
      if (!guildId || guildId.trim() === '') {
        console.error('❌ Error: No guildId provided. Please enter a valid guildId.');
        continue;
      }
      
      console.log(`\nValidating guildId: ${guildId}...`);
      
      // Validate the guildId with the myMasjid API
      try {
        isValid = await validateMyMasjidGuildId(guildId.trim());
        if (!isValid) {
          console.error('❌ Error: Invalid myMasjid guildId. The API did not return valid prayer data.');
          console.log('Please check your guildId and try again.\n');
        }
      } catch (error) {
        console.error(`❌ Error validating guildId: ${error.message}`);
        console.log('Please check your internet connection and try again.\n');
      }
    }
    
    console.log('✅ guildId validated successfully!');
    
    // Close readline interface
    rl.close();
    
    // Create a new config document with default values and the provided guildId
    const defaultConfig = {
      prayerData: {
        source: 'mymasjid',
        mymasjid: {
          guildId: guildId.trim() 
        }
      },
      features: {
        azanEnabled: true,
        announcementEnabled: true,
        systemLogsEnabled: true
      },
      auth: {
        sessionTimeout: 3600000,
        maxSessions: 5
      },
      prayerSettings: {
        prayers: {
          fajr: {
            azanEnabled: false,
            announcementEnabled: false,
            azanAtIqamah: true
          },
          zuhr: {
            azanEnabled: true,
            announcementEnabled: false,
            azanAtIqamah: true
          },
          asr: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false
          },
          maghrib: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false
          },
          isha: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: true
          }
        },
        globalAzanEnabled: true,
        globalAnnouncementEnabled: true
      }
    };
    
    // Create a new config document
    const newConfig = new Config(defaultConfig);
    await newConfig.save();
    
    // Also update the in-memory config
    refreshConfig(defaultConfig);
    
    console.log('✅ Configuration initialised with user-provided values');
    return newConfig;
  } catch (error) {
    console.error('❌ Error initialising default configuration:', error);
    throw error;
  }
}

/**
 * Update a specific configuration section in the database and in-memory
 * This is the primary method other modules should use to update configuration
 * 
 * @param {string} section - The section to update (e.g., 'prayerData', 'features')
 * @param {Object} data - The new data for the section
 * @returns {Object} - The updated configuration
 */
async function updateConfig(section, data) {
  try {
    // Deep clone and remove any MongoDB specific properties
    const cleanData = JSON.parse(JSON.stringify(data));
    
    // Remove any _id fields from the data - these cause problems with Mongoose
    const removeIds = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      // Remove _id from this level
      delete obj._id;
      
      // Process each property recursively
      Object.values(obj).forEach(value => {
        if (value && typeof value === 'object') {
          // If it's an array, process each item
          if (Array.isArray(value)) {
            value.forEach(item => {
              if (item && typeof item === 'object') removeIds(item);
            });
          } else {
            // If it's an object, process recursively
            removeIds(value);
          }
        }
      });
    };
    
    // Clean out all _id fields
    removeIds(cleanData);
    
    // Log the update attempt
    console.log(`⚙️ Updating configuration section: ${section}`);
    
    // Get all existing config documents - expected to be just one
    const existingConfigs = await Config.find({});
    
    let updatedConfig;
    
    if (existingConfigs.length > 0) {
      // Use the first document
      const existingConfig = existingConfigs[0];
      
      // Determine how to update based on section
      if (section === 'prayerSettings') {
        // Special handling for prayerSettings to prevent ObjectId issues
        
        // Create a new clean prayers object if it exists in the data
        if (cleanData.prayers) {
          if (!existingConfig.prayerSettings) {
            // If prayerSettings doesn't exist yet, create it
            existingConfig.prayerSettings = { prayers: {} };
          } else if (!existingConfig.prayerSettings.prayers) {
            // If prayers doesn't exist yet, create it
            existingConfig.prayerSettings.prayers = {};
          }
          
          // Update each prayer individually to avoid ObjectId issues
          Object.keys(cleanData.prayers).forEach(prayer => {
            existingConfig.prayerSettings.prayers[prayer] = cleanData.prayers[prayer];
          });
        }
        
        // Update other properties of prayerSettings
        Object.keys(cleanData).forEach(key => {
          if (key !== 'prayers' && key !== '_id') {
            existingConfig.prayerSettings[key] = cleanData[key];
          }
        });
      } else {
        // For other sections, simply replace the entire section
        existingConfig[section] = cleanData;
      }
      
      // Update the timestamp
      existingConfig.updatedAt = new Date();
      
      // Save the updated document
      updatedConfig = await existingConfig.save();
    } else {
      // If no config exists, create a new one with this section
      const newConfig = { [section]: cleanData, updatedAt: new Date() };
      const configDoc = new Config(newConfig);
      updatedConfig = await configDoc.save();
    }
    
    if (!updatedConfig) {
      console.error(`❌ Failed to update ${section}: No document returned`);
      throw new Error(`Failed to update ${section}`);
    }
    
    // Force cache update with a clean JavaScript object
    const cleanConfig = updatedConfig.toObject();
    configCache = cleanConfig;
    cacheTimestamp = Date.now();
    
    // Update the in-memory config
    refreshConfig(configCache);
    
    // Log successful update
    console.log(`✅ Updated ${section} in configuration and refreshed config`);
    
    return configCache;
  } catch (error) {
    console.error(`❌ Error updating ${section} configuration:`, error);
    throw error;
  }
}

// Export the public API
export {
  getConfig,        // Primary method for getting config (from DB, synced to memory)
  updateConfig,     // Primary method for updating config (in DB and memory)
  refreshConfig,    // Used by server.js and internal code to update in-memory config
  initializeConfig  // Used by server.js to initialise config at startup
};
