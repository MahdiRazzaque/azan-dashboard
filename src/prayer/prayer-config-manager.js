/**
 * Prayer Configuration Manager
 * 
 * Handles prayer source configuration updates and data refresh with robust error handling
 * and transaction-like behavior
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig, updateConfig } from '../config/config-service.js';
import { refreshPrayerData } from './prayer-data-provider.js';
import { validatePrayerSourceSettings } from './prayer-source-validator.js';
import { CALCULATION_METHODS, ASR_JURISTIC_METHODS, MIDNIGHT_MODES } from './aladhan/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, '../../backups');
const CONFIG_FILE_PATH = path.join(__dirname, '../../config.json');
const PRAYER_TIMES_FILE_PATH = path.join(__dirname, '../../prayer_times.json');

/**
 * Ensures the backup directory exists
 * @returns {Promise<void>}
 */
async function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

/**
 * Creates a backup of the config and prayer times files
 * @returns {Promise<string>} - Path to the backup directory
 */
async function createBackup() {
    await ensureBackupDir();
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const backupDir = path.join(BACKUP_DIR, `backup-${timestamp}`);
    
    fs.mkdirSync(backupDir, { recursive: true });
    
    // Backup config.json if it exists
    if (fs.existsSync(CONFIG_FILE_PATH)) {
        fs.copyFileSync(
            CONFIG_FILE_PATH, 
            path.join(backupDir, 'config.json')
        );
    }
    
    // Backup prayer_times.json if it exists
    if (fs.existsSync(PRAYER_TIMES_FILE_PATH)) {
        fs.copyFileSync(
            PRAYER_TIMES_FILE_PATH, 
            path.join(backupDir, 'prayer_times.json')
        );
    }
    
    console.log(`📦 Created backup at ${backupDir}`);
    return backupDir;
}

/**
 * Restores from a backup directory
 * @param {string} backupDir - Path to the backup directory
 * @returns {Promise<boolean>} - True if restore was successful
 */
async function restoreFromBackup(backupDir) {
    try {
        // Restore config.json if it exists in the backup
        const backupConfigPath = path.join(backupDir, 'config.json');
        if (fs.existsSync(backupConfigPath)) {
            fs.copyFileSync(backupConfigPath, CONFIG_FILE_PATH);
        }
        
        // Restore prayer_times.json if it exists in the backup
        const backupPrayerTimesPath = path.join(backupDir, 'prayer_times.json');
        if (fs.existsSync(backupPrayerTimesPath)) {
            fs.copyFileSync(backupPrayerTimesPath, PRAYER_TIMES_FILE_PATH);
        }
        
        console.log(`🔄 Restored from backup at ${backupDir}`);
        return true;
    } catch (error) {
        console.error(`❌ Error restoring from backup: ${error.message}`);
        return false;
    }
}

/**
 * Updates prayer source configuration with transaction-like behavior
 * @param {Object} settings - Prayer source settings to update
 * @returns {Promise<Object>} - Result object with success flag, message, and error details
 */
export async function updatePrayerSourceConfig(settings) {
    const result = {
        success: false,
        message: '',
        error: null,
        backupCreated: false,
        backupDir: null
    };
    
    // Step 1: Validate settings
    try {
        const validationResult = await validatePrayerSourceSettings(settings);
        if (!validationResult.isValid) {
            result.message = 'Invalid prayer source settings';
            result.error = {
                type: 'validation',
                details: validationResult.errors
            };
            return result;
        }
    } catch (error) {
        result.message = 'Error validating prayer source settings';
        result.error = {
            type: 'validation_error',
            details: error.message
        };
        return result;
    }
    
    // Step 2: Create backup
    try {
        result.backupDir = await createBackup();
        result.backupCreated = true;
    } catch (error) {
        result.message = 'Error creating backup';
        result.error = {
            type: 'backup_error',
            details: error.message
        };
        return result;
    }
    
    // Step 3: Get current config
    let currentConfig;
    try {
        currentConfig = await getConfig();
    } catch (error) {
        result.message = 'Error getting current configuration';
        result.error = {
            type: 'config_error',
            details: error.message
        };
        return result;
    }
    
    // Step 4: Prepare new prayer data config
    let prayerData = currentConfig.prayerData || {};
    
    if (settings.source === 'mymasjid') {
        prayerData = {
            ...prayerData,
            source: 'mymasjid',
            mymasjid: {
                guildId: settings.guildId
            }
        };
        
        // Preserve Aladhan settings if they exist
        if (currentConfig.prayerData?.aladhan) {
            prayerData.aladhan = currentConfig.prayerData.aladhan;
        }
    } else if (settings.source === 'aladhan') {
        // Add method names from constants
        const calculationMethodName = CALCULATION_METHODS[settings.calculationMethodId] || 'Unknown Method';
        const asrJuristicMethodName = ASR_JURISTIC_METHODS[settings.asrJuristicMethodId] || 'Unknown Method';
        const midnightModeName = MIDNIGHT_MODES[settings.midnightModeId] || 'Unknown Mode';
        
        prayerData = {
            ...prayerData,
            source: 'aladhan',
            aladhan: {
                latitude: settings.latitude,
                longitude: settings.longitude,
                timezone: settings.timezone,
                calculationMethodId: settings.calculationMethodId,
                calculationMethodName: calculationMethodName,
                asrJuristicMethodId: settings.asrJuristicMethodId,
                asrJuristicMethodName: asrJuristicMethodName,
                latitudeAdjustmentMethodId: settings.latitudeAdjustmentMethodId,
                midnightModeId: settings.midnightModeId,
                midnightModeName: midnightModeName,
                iqamahOffsets: settings.iqamahOffsets
            }
        };
        
        // Preserve MyMasjid settings if they exist
        if (currentConfig.prayerData?.mymasjid) {
            prayerData.mymasjid = currentConfig.prayerData.mymasjid;
        }
    }
    
    // Step 5: Update config
    try {
        await updateConfig('prayerData', prayerData);
    } catch (error) {
        result.message = 'Error updating configuration';
        result.error = {
            type: 'config_update_error',
            details: error.message
        };
        
        // Try to restore from backup
        if (result.backupCreated) {
            await restoreFromBackup(result.backupDir);
            result.message += '. Restored from backup';
        }
        
        return result;
    }
    
    // Step 6: Refresh prayer data
    try {
        console.log(`🔄 Refreshing prayer data for source: ${settings.source}`);
        const refreshSuccess = await refreshPrayerData();
        
        if (!refreshSuccess) {
            result.message = 'Failed to refresh prayer data with new source';
            result.error = {
                type: 'refresh_error',
                details: 'Error occurred while fetching prayer data from the source'
            };
            
            // Try to restore from backup
            if (result.backupCreated) {
                await restoreFromBackup(result.backupDir);
                result.message += '. Restored from backup';
            }
            
            return result;
        }
    } catch (error) {
        result.message = 'Error refreshing prayer data';
        result.error = {
            type: 'refresh_error',
            details: error.message
        };
        
        // Try to restore from backup
        if (result.backupCreated) {
            await restoreFromBackup(result.backupDir);
            result.message += '. Restored from backup';
        }
        
        return result;
    }
    
    // Step 7: Success
    result.success = true;
    result.message = `Prayer source updated to ${settings.source} successfully`;
    
    return result;
}

/**
 * Gets all available prayer source settings (both MyMasjid and Aladhan)
 * @returns {Promise<Object>} - Object containing all prayer source settings
 */
export async function getAllPrayerSourceSettings() {
    try {
        const config = await getConfig();
        const prayerData = config.prayerData || {};
        
        // Define default values
        const defaultSettings = {
            // Common settings
            source: 'mymasjid', // Default source type
            
            // MyMasjid settings
            guildId: '',
            
            // Aladhan settings
            latitude: 0,
            longitude: 0,
            timezone: 'UTC',
            calculationMethodId: 2, // Default to ISNA
            calculationMethodName: CALCULATION_METHODS[2], // ISNA
            asrJuristicMethodId: 0, // Default to Shafi'i
            asrJuristicMethodName: ASR_JURISTIC_METHODS[0], // Shafi'i
            latitudeAdjustmentMethodId: 3, // Default to Angle Based
            midnightModeId: 0, // Default to Standard
            midnightModeName: MIDNIGHT_MODES[0], // Standard
            iqamahOffsets: {
                fajr: 20,
                zuhr: 10,
                asr: 10,
                maghrib: 5,
                isha: 15
            }
        };
        
        // Create a flattened result object starting with defaults
        let result = { ...defaultSettings };
        
        // Set the current source type
        result.source = prayerData.source || defaultSettings.source;
        
        // Merge MyMasjid settings if available
        if (prayerData.mymasjid) {
            result.guildId = prayerData.mymasjid.guildId || defaultSettings.guildId;
        }
        
        // Merge Aladhan settings if available
        if (prayerData.aladhan) {
            result.latitude = prayerData.aladhan.latitude !== undefined ? prayerData.aladhan.latitude : defaultSettings.latitude;
            result.longitude = prayerData.aladhan.longitude !== undefined ? prayerData.aladhan.longitude : defaultSettings.longitude;
            result.timezone = prayerData.aladhan.timezone || defaultSettings.timezone;
            result.calculationMethodId = prayerData.aladhan.calculationMethodId !== undefined ? prayerData.aladhan.calculationMethodId : defaultSettings.calculationMethodId;
            result.calculationMethodName = prayerData.aladhan.calculationMethodName || CALCULATION_METHODS[result.calculationMethodId] || defaultSettings.calculationMethodName;
            result.asrJuristicMethodId = prayerData.aladhan.asrJuristicMethodId !== undefined ? prayerData.aladhan.asrJuristicMethodId : defaultSettings.asrJuristicMethodId;
            result.asrJuristicMethodName = prayerData.aladhan.asrJuristicMethodName || ASR_JURISTIC_METHODS[result.asrJuristicMethodId] || defaultSettings.asrJuristicMethodName;
            result.latitudeAdjustmentMethodId = prayerData.aladhan.latitudeAdjustmentMethodId !== undefined ? prayerData.aladhan.latitudeAdjustmentMethodId : defaultSettings.latitudeAdjustmentMethodId;
            result.midnightModeId = prayerData.aladhan.midnightModeId !== undefined ? prayerData.aladhan.midnightModeId : defaultSettings.midnightModeId;
            result.midnightModeName = prayerData.aladhan.midnightModeName || MIDNIGHT_MODES[result.midnightModeId] || defaultSettings.midnightModeName;
            
            // Merge iqamah offsets
            if (prayerData.aladhan.iqamahOffsets) {
                result.iqamahOffsets = {
                    ...defaultSettings.iqamahOffsets,
                    ...prayerData.aladhan.iqamahOffsets
                };
            }
        }
        
        return result;
    } catch (error) {
        console.error('Error getting prayer source settings:', error);
        throw error;
    }
} 