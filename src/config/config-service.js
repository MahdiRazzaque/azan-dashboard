import Config from '../database/models/config-model.js';
import { refreshConfig, initializeConfig } from './config-manager.js';

// Cache for config to avoid frequent database reads
let configCache = null;
let cacheTimestamp = null;
const CACHE_LIFETIME = 60000; // 1 minute cache lifetime

/**
 * Get the full configuration from database or initialize it
 */
async function getConfig() {
  // Return from cache if valid
  const now = Date.now();
  if (configCache && cacheTimestamp && (now - cacheTimestamp < CACHE_LIFETIME)) {
    return configCache;
  }
  
  try {
    // Try to get config from database
    let config = await Config.findOne();
    
    // If no config exists, initialize from file
    if (!config) {
      config = await initialiseDefaultConfig();
    }
    
    // Update cache
    configCache = config.toObject();
    cacheTimestamp = now;
    
    // Also update the in-memory app config when we fetch fresh data
    refreshConfig(configCache);
    
    return configCache;
  } catch (error) {
    console.error('Error retrieving configuration:', error);
    throw error;
  }
}

/**
 * Initialize configuration with default values
 */
async function initialiseDefaultConfig() {
  try {
    // Create a new config document with default values
    const defaultConfig = {
      prayerData: {
        source: 'mymasjid',
        mymasjid: {
          guidId: '03b8d82c-5b0e-4cb9-ad68-8c7e204cae00'
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
    
    console.log('✅ Configuration initialized with default values');
    return newConfig;
  } catch (error) {
    console.error('Error initializing default configuration:', error);
    throw error;
  }
}

/**
 * Update a specific configuration section
 */
async function updateConfig(section, data) {
  try {
    const updateData = {};
    updateData[section] = data;
    updateData.updatedAt = new Date();
    
    // Log the update attempt
    console.log(`⚙️ Updating configuration section: ${section}`);
    
    const updatedConfig = await Config.findOneAndUpdate({}, updateData, { 
      new: true,      // Return the updated document
      upsert: true    // Create if doesn't exist
    });
    
    if (!updatedConfig) {
      console.error(`❌ Failed to update ${section}: No document returned`);
      throw new Error(`Failed to update ${section}`);
    }    // Force cache update with the entire new document
    configCache = updatedConfig.toObject();
    cacheTimestamp = Date.now();
    
    // Refresh the in-memory app config
    try {      
      // Update the centralized config with the new data
      refreshConfig(configCache);
      
      // Log successful update
      console.log(`✅ Updated ${section} in configuration and refreshed config`);
    } catch (error) {
      console.error('❌ Error updating config manager:', error);
    }
    
    return configCache;
  } catch (error) {
    console.error(`❌ Error updating ${section} configuration:`, error);
    throw error;
  }
}

export { getConfig, updateConfig };
