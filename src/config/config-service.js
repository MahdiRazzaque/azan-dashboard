// src/config/config-service.js
/**
 * config-service.js - Manages configuration from a local JSON file.
 */
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { validateMyMasjidGuildId } from '../prayer/mymasjid-provider.js';
import { validateConfig, validateAladhanConfig, validateMyMasjidConfig } from './validation.js';
import { 
  CALCULATION_METHODS, 
  ASR_JURISTIC_METHODS, 
  MIDNIGHT_MODES 
} from '../prayer/aladhan/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.join(__dirname, '../../config.json');

// In-memory cache of config
let _appConfig = {};

// Flag to indicate if we're using web-based setup
let _useWebSetup = false;

/**
 * Enable web-based setup mode
 * This will prevent the console-based setup from running
 */
function enableWebSetup() {
  _useWebSetup = true;
  console.info('✅ Web-based setup mode enabled');
}

/**
 * Read configuration from file
 * @returns {Promise<Object|null>} Config object or null if file doesn't exist
 */
async function readConfigFile() {
  try {
    // Check if file exists
    try {
      await fsPromises.access(CONFIG_FILE_PATH);
    } catch (error) {
      return null; // File doesn't exist
    }
    
    // Read and parse file
    const data = await fsPromises.readFile(CONFIG_FILE_PATH, 'utf8');
    if (!data.trim()) {
      return null; // Empty file
    }
    
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error reading config file: ${error.message}`);
    return null;
  }
}

/**
 * Write configuration to file
 * @param {Object} configData - Configuration data to write
 * @returns {Promise<boolean>} Success status
 */
async function writeConfigFile(configData) {
  try {
    const dirPath = path.dirname(CONFIG_FILE_PATH);
    
    // Ensure directory exists
    try {
      await fsPromises.access(dirPath);
    } catch (error) {
      await fsPromises.mkdir(dirPath, { recursive: true });
    }
    
    // Write file
    await fsPromises.writeFile(
      CONFIG_FILE_PATH,
      JSON.stringify(configData, null, 2),
      'utf8'
    );
    
    return true;
  } catch (error) {
    console.error(`❌ Error writing config file: ${error.message}`);
    return false;
  }
}

/**
 * Get configuration
 * @param {boolean} sync - If true, return cached config synchronously
 * @param {string|null} section - Optional section name to return only that section
 * @returns {Object|Promise<Object>} Config object or specific section
 */
function getConfig(sync = false, section = null) {
  if (sync === true) {
    return section ? 
      (_appConfig[section] ? structuredClone(_appConfig[section]) : null) :
      structuredClone(_appConfig);
  }

  return (async () => {
    if (Object.keys(_appConfig).length > 0 && !section) { // If fully cached and no specific section force reload
        // return structuredClone(_appConfig); // Removed this to ensure fresh read or initialisation
    }
    
    let configFromFile = await readConfigFile();
    if (!configFromFile) {
      if (_useWebSetup) {
        // Skip console-based setup if web setup is enabled
        console.info('ℹ️ No configuration found. Web-based setup will be used.');
        return section ? null : {};
      } else {
        configFromFile = await initialiseNewConfig(); // This will also write the file
      }
    } else {
      // Handle backward compatibility for old configs without source field
      if (configFromFile.prayerData && !configFromFile.prayerData.source && configFromFile.prayerData.guildId) {
        // Migrate old format to new format
        configFromFile.prayerData = {
          source: 'mymasjid',
          mymasjid: {
            guildId: configFromFile.prayerData.guildId
          }
        };
        await writeConfigFile(configFromFile);
        console.log('✅ Migrated old config format to new format with source field');
      }
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
    
    // Ask for prayer time source
    console.log('Select prayer time source:');
    console.log('1. MyMasjid API (fetch from a specific mosque)');
    console.log('2. Aladhan API (calculate based on geographical coordinates)');
    
    let sourceChoice = '';
    while (sourceChoice !== '1' && sourceChoice !== '2') {
      sourceChoice = await askQuestion(rl, 'Enter your choice (1 or 2): ');
      if (sourceChoice !== '1' && sourceChoice !== '2') {
        console.error('❌ Invalid choice. Please enter 1 or 2.');
      }
    }
    
    const source = sourceChoice === '1' ? 'mymasjid' : 'aladhan';
    console.log(`\nSelected source: ${source === 'mymasjid' ? 'MyMasjid API' : 'Aladhan API'}`);
    
    let prayerDataConfig = { source };
    
    if (source === 'mymasjid') {
      // MyMasjid setup
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
      prayerDataConfig.mymasjid = { guildId: guildId.trim() };
    } else {
      // Aladhan setup
      console.log('\nAladhan API Configuration:');
      
      // Latitude
      let latitude = NaN;
      while (isNaN(latitude) || latitude < -90 || latitude > 90) {
        const latStr = await askQuestion(rl, 'Enter latitude (-90 to 90): ');
        latitude = parseFloat(latStr);
        if (isNaN(latitude) || latitude < -90 || latitude > 90) {
          console.error('❌ Invalid latitude. Please enter a number between -90 and 90.');
        }
      }
      
      // Longitude
      let longitude = NaN;
      while (isNaN(longitude) || longitude < -180 || longitude > 180) {
        const longStr = await askQuestion(rl, 'Enter longitude (-180 to 180): ');
        longitude = parseFloat(longStr);
        if (isNaN(longitude) || longitude < -180 || longitude > 180) {
          console.error('❌ Invalid longitude. Please enter a number between -180 and 180.');
        }
      }
      
      // Timezone
      console.log('\nEnter your timezone (e.g., America/New_York, Europe/London):');
      let timezone = '';
      let isValidTz = false;
      while (!isValidTz) {
        timezone = await askQuestion(rl, 'Timezone: ');
        try {
          Intl.DateTimeFormat(undefined, { timeZone: timezone });
          isValidTz = true;
        } catch (ex) {
          console.error('❌ Invalid timezone. Please enter a valid IANA timezone name.');
        }
      }
      
      // Calculation Method
      console.log('\nSelect Prayer Calculation Method:');
      Object.entries(CALCULATION_METHODS).forEach(([id, name]) => {
        console.log(`${id}: ${name}`);
      });
      
      let calculationMethodId = NaN;
      while (isNaN(calculationMethodId) || !CALCULATION_METHODS[calculationMethodId]) {
        const methodStr = await askQuestion(rl, 'Enter calculation method ID: ');
        calculationMethodId = parseInt(methodStr, 10);
        if (isNaN(calculationMethodId) || !CALCULATION_METHODS[calculationMethodId]) {
          console.error('❌ Invalid calculation method ID. Please enter a valid ID from the list.');
        }
      }
      
      // Asr Juristic Method
      console.log('\nSelect Asr Juristic Method (School):');
      Object.entries(ASR_JURISTIC_METHODS).forEach(([id, name]) => {
        console.log(`${id}: ${name}`);
      });
      
      let asrJuristicMethodId = NaN;
      while (isNaN(asrJuristicMethodId) || !ASR_JURISTIC_METHODS[asrJuristicMethodId]) {
        const methodStr = await askQuestion(rl, 'Enter Asr juristic method ID: ');
        asrJuristicMethodId = parseInt(methodStr, 10);
        if (isNaN(asrJuristicMethodId) || !ASR_JURISTIC_METHODS[asrJuristicMethodId]) {
          console.error('❌ Invalid Asr juristic method ID. Please enter a valid ID from the list.');
        }
      }
      
      // Midnight Mode
      console.log('\nSelect Midnight Mode:');
      Object.entries(MIDNIGHT_MODES).forEach(([id, name]) => {
        console.log(`${id}: ${name}`);
      });
      
      let midnightModeId = NaN;
      while (isNaN(midnightModeId) || !MIDNIGHT_MODES[midnightModeId]) {
        const modeStr = await askQuestion(rl, 'Enter midnight mode ID: ');
        midnightModeId = parseInt(modeStr, 10);
        if (isNaN(midnightModeId) || !MIDNIGHT_MODES[midnightModeId]) {
          console.error('❌ Invalid midnight mode ID. Please enter a valid ID from the list.');
        }
      }
      
      // Iqamah Offsets
      console.log('\nConfigure Iqamah Offsets (minutes after Azan):');
      const iqamahOffsets = {};
      const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
      
      for (const prayer of prayers) {
        let offset = NaN;
        while (isNaN(offset)) {
          const offsetStr = await askQuestion(rl, `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} offset (minutes): `);
          offset = parseInt(offsetStr, 10);
          if (isNaN(offset)) {
            console.error('❌ Invalid offset. Please enter a valid number.');
          }
        }
        iqamahOffsets[prayer] = offset;
      }
      
      prayerDataConfig.aladhan = {
        latitude,
        longitude,
        timezone,
        calculationMethodId,
        calculationMethodName: CALCULATION_METHODS[calculationMethodId],
        asrJuristicMethodId,
        asrJuristicMethodName: ASR_JURISTIC_METHODS[asrJuristicMethodId],
        latitudeAdjustmentMethodId: null, // Default to null, can be set later in UI
        midnightModeId,
        iqamahOffsets
      };
      
      console.log('\n✅ Aladhan configuration complete!');
    }
    
    rl.close();
    
    const defaultConfig = {
      prayerData: prayerDataConfig,
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
          fajr: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
          zuhr: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
          asr: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
          maghrib: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false },
          isha: { azanEnabled: true, announcementEnabled: true, azanAtIqamah: false }
        },
        globalAzanEnabled: true,
        globalAnnouncementEnabled: true
      },
      updatedAt: new Date().toISOString()
    };
    
    // Validate the config
    const validationResult = validateConfig(defaultConfig);
    if (!validationResult.isValid) {
      console.error(`❌ Configuration validation error: ${validationResult.error}`);
      throw new Error(`Configuration validation error: ${validationResult.error}`);
    }
    
    await writeConfigFile(defaultConfig); // This also updates _appConfig
    console.log('✅ Configuration initialised and saved to config.json');
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
    } else if (section === 'prayerData') {
        // Special handling for prayerData to validate source-specific configs
        currentConfig.prayerData = cleanData;
        
        // Validate the updated config
        const validationResult = validateConfig(currentConfig);
        if (!validationResult.isValid) {
            throw new Error(`Configuration validation error: ${validationResult.error}`);
        }
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
  updateConfig,
  validateConfig,
  validateAladhanConfig,
  validateMyMasjidConfig,
  enableWebSetup
};