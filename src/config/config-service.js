/**
 * config-service.js - Minimalist configuration service for the application
 * Focused on direct database interaction with minimal state management
 */
import Config from '../database/models/config-model.js';
import readline from 'readline';
import { validateMyMasjidGuildId } from '../prayer/prayer-data-provider.js';

// For backward compatibility with existing code that uses sync mode
// This is a minimal in-memory store for sync operations only
let _appConfig = {};

/**
 * Get the configuration from database
 * This is the primary method other modules should use to get configuration
 * 
 * @param {boolean} [sync=false] - If true, returns in-memory config immediately without DB lookup
 * @param {string} [section=null] - Optional specific section to retrieve
 * @returns {Object|Promise<Object>} - The requested configuration or section
 */
function getConfig(sync = false, section = null) {
  // Parameters are now clearly defined - no type checking needed
  // Handle synchronous mode - return from memory immediately
  if (sync === true) {
    return section ? 
      (_appConfig[section] ? structuredClone(_appConfig[section]) : null) :
      structuredClone(_appConfig);
  }
  
  // Asynchronous implementation - always get from database
  return (async () => {
    try {
      const config = await Config.findOne() || await initialiseNewConfig();
      const cleanConfig = config.toObject ? config.toObject() : config;
      _appConfig = cleanConfig; // Update memory reference
      return section ? cleanConfig[section] || null : cleanConfig;
    } catch (error) {
      console.error('Error retrieving configuration:', error);
      // Fallback to memory if available
      if (Object.keys(_appConfig).length > 0) {
        console.log('⚠️ Using in-memory configuration as fallback');
        return section ? _appConfig[section] || null : structuredClone(_appConfig);
      }
      throw error;
    }
  })();
}

/**
 * Helper function to create readline interface for terminal input
 * @private
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Helper function for command-line input
 * @private
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
    console.log('No configuration found in the database. Setting up configuration...\n');
    
    // Get and validate guildId
    const rl = createReadlineInterface();
    let guildId = '';
    let isValid = false;
    
    while (!isValid) {
      console.log('Your myMasjid guildId is required to fetch prayer times:');
      guildId = await askQuestion(rl, 'Enter your myMasjid guildId: ');
      
      if (!guildId?.trim()) {
        console.error('❌ Error: No guildId provided. Please enter a valid guildId.');
        continue;
      }
      
      console.log(`\nValidating guildId: ${guildId}...`);
      
      try {
        isValid = await validateMyMasjidGuildId(guildId.trim());
        if (!isValid) {
          console.error('❌ Error: Invalid guildId. The API did not return valid prayer data.');
        }
      } catch (error) {
        console.error(`❌ Error validating guildId: ${error.message}`);
      }
    }
    
    console.log('✅ guildId validated successfully!');
    rl.close();
    
    // Create default configuration with the validated guildId
    const defaultConfig = {
      prayerData: {
        source: 'mymasjid',
        mymasjid: { guildId: guildId.trim() }
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
          fajr: { azanEnabled: false, announcementEnabled: false, azanAtIqamah: true },
          zuhr: { azanEnabled: true, announcementEnabled: false, azanAtIqamah: true },
          asr: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
          maghrib: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
          isha: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: true }
        },
        globalAzanEnabled: true,
        globalAnnouncementEnabled: true
      }
    };
    
    // Create and save config document
    const newConfig = new Config(defaultConfig);
    await newConfig.save();
    
    // Update in-memory reference
    _appConfig = defaultConfig;
    
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
    // Deep clone and remove MongoDB specific properties
    const cleanData = JSON.parse(JSON.stringify(data));
    
    // Simple recursive function to remove _id fields
    const removeIds = obj => {
      if (!obj || typeof obj !== 'object') return;
      delete obj._id;
      Object.values(obj).forEach(val => {
        if (val && typeof val === 'object') removeIds(val);
      });
    };
    removeIds(cleanData);
    
    console.log(`⚙️ Updating configuration section: ${section}`);
    
    // Get or create config document
    let config = await Config.findOne();
    if (!config) {
      config = new Config({ updatedAt: new Date() });
    }
    
    // Handle special case for prayerSettings
    if (section === 'prayerSettings' && cleanData.prayers) {
      // Ensure the structure exists
      if (!config.prayerSettings) config.prayerSettings = {};
      if (!config.prayerSettings.prayers) config.prayerSettings.prayers = {};
      
      // Update prayers and other properties
      Object.keys(cleanData.prayers).forEach(prayer => {
        config.prayerSettings.prayers[prayer] = cleanData.prayers[prayer];
      });
      
      Object.keys(cleanData).forEach(key => {
        if (key !== 'prayers') config.prayerSettings[key] = cleanData[key];
      });
    } else {
      // For other sections, simply replace the entire section
      config[section] = cleanData;
    }
    
    // Update timestamp and save
    config.updatedAt = new Date();
    const updatedConfig = await config.save();
    
    if (!updatedConfig) throw new Error(`Failed to update ${section}`);
    
    // Update in-memory reference and return
    const result = updatedConfig.toObject();
    _appConfig = result;
    console.log(`✅ Updated ${section} in configuration`);
    return result;
  } catch (error) {
    console.error(`❌ Error updating ${section} configuration:`, error);
    throw error;
  }
}

// Export the public API
export {
  getConfig,        // Primary method for getting config (from DB, synced to memory)
  updateConfig      // Primary method for updating config (in DB and memory)
};
