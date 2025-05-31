// src/config/config-service.js
/**
 * config-service.js - Manages configuration from a local JSON file.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { validateMyMasjidGuildId } from '../prayer/prayer-data-provider.js'; // Keep this

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.join(__dirname, '../../config.json'); // Points to root/config.json

let _appConfig = {}; // In-memory cache

/**
 * Helper function to read the config file.
 * @private
 */
async function readConfigFile() {
  try {
    const data = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') { // File not found
      console.log(`Config file not found at ${CONFIG_FILE_PATH}. Will attempt to initialize.`);
      return null; // Indicate file not found, so initialisation can occur
    }
    console.error('Error reading config file:', error);
    throw error; // Re-throw other errors
  }
}

/**
 * Helper function to write to the config file.
 * @private
 */
async function writeConfigFile(configData) {
  try {
    const dataToWrite = JSON.stringify(configData, null, 2);
    await fs.writeFile(CONFIG_FILE_PATH, dataToWrite, 'utf-8');
    _appConfig = JSON.parse(JSON.stringify(configData)); // Update in-memory cache
  } catch (error) {
    console.error('Error writing config file:', error);
    throw error;
  }
}

/**
 * Get the configuration.
 * @param {boolean} [sync=false] - If true, returns in-memory config immediately.
 * @param {string} [section=null] - Optional specific section to retrieve.
 * @returns {Object|Promise<Object>} - The requested configuration or section.
 */
function getConfig(sync = false, section = null) {
  if (sync === true) {
    return section ? 
      (_appConfig[section] ? structuredClone(_appConfig[section]) : null) :
      structuredClone(_appConfig);
  }

  return (async () => {
    if (Object.keys(_appConfig).length > 0 && !section) { // If fully cached and no specific section force reload
        // return structuredClone(_appConfig); // Removed this to ensure fresh read or initialization
    }
    
    let configFromFile = await readConfigFile();
    if (!configFromFile) {
      configFromFile = await initialiseNewConfig(); // This will also write the file
    }
    _appConfig = structuredClone(configFromFile); // Deep clone to avoid mutation issues

    return section ? _appConfig[section] || null : _appConfig;
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
 * Initialise configuration with default values, prompting for guildId, and save to file.
 */
async function initialiseNewConfig() {
  try {
    console.log('\n===== CONFIGURATION SETUP (File Based) =====');
    console.log(`No configuration file found or it's empty. Setting up default configuration at ${CONFIG_FILE_PATH}...\n`);
    
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
      },
      updatedAt: new Date().toISOString()
    };
    
    await writeConfigFile(defaultConfig); // This also updates _appConfig
    console.log('✅ Default configuration initialised and saved to config.json');
    return defaultConfig;
  } catch (error) {
    console.error('❌ Error initialising default configuration for file:', error);
    // Fallback to a very basic in-memory config if file init fails, to prevent crashes
    const minimalConfig = { prayerData: {}, features: {}, auth: {}, prayerSettings: { prayers: {} }, updatedAt: new Date().toISOString() };
    _appConfig = minimalConfig;
    return minimalConfig; 
  }
}

/**
 * Update a specific configuration section in the file and in-memory.
 * @param {string} section - The section to update.
 * @param {Object} data - The new data for the section.
 * @returns {Object} - The updated configuration.
 */
async function updateConfig(section, data) {
  try {
    console.log(`⚙️ Updating configuration section in file: ${section}`);
    
    // Ensure current config is loaded into _appConfig
    if (Object.keys(_appConfig).length === 0) {
        await getConfig(); // Load from file if not already loaded
    }

    const currentConfig = structuredClone(_appConfig); // Work with a copy
    
    const cleanData = JSON.parse(JSON.stringify(data)); // Deep clone and remove Mongoose specifics if any residual

    if (section === 'prayerSettings' && cleanData.prayers) {
        if (!currentConfig.prayerSettings) currentConfig.prayerSettings = { prayers: {} };
        if (!currentConfig.prayerSettings.prayers) currentConfig.prayerSettings.prayers = {};
        
        Object.keys(cleanData.prayers).forEach(prayer => {
            currentConfig.prayerSettings.prayers[prayer] = cleanData.prayers[prayer];
        });
        Object.keys(cleanData).forEach(key => {
            if (key !== 'prayers') currentConfig.prayerSettings[key] = cleanData[key];
        });
    } else {
        currentConfig[section] = cleanData;
    }
    
    currentConfig.updatedAt = new Date().toISOString();
    await writeConfigFile(currentConfig);
    
    console.log(`✅ Updated ${section} in config.json`);
    return currentConfig;
  } catch (error) {
    console.error(`❌ Error updating ${section} in config.json:`, error);
    throw error;
  }
}

export {
  getConfig,
  updateConfig
};