import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPrayerTimesForYear } from './aladhan/index.js';
import { validateAndFlagPrayerTimesFile, deletePrayerTimesFile } from './prayer-file-validator.js';
import { 
    CALCULATION_METHODS, 
    ASR_JURISTIC_METHODS, 
    LATITUDE_ADJUSTMENT_METHODS, 
    MIDNIGHT_MODES,
    API_BASE_URL
} from './aladhan/constants.js';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validates Aladhan configuration parameters
 * @param {Object} config - Configuration object to validate
 * @returns {Object} - Object with isValid flag and error message
 */
export function validateAladhanConfig(config) {
    if (!config) {
        return { isValid: false, error: "Configuration is missing" };
    }

    // Required parameters
    if (typeof config.latitude !== 'number') {
        return { isValid: false, error: "Latitude must be a number", field: "latitude" };
    }
    if (config.latitude < -90 || config.latitude > 90) {
        return { isValid: false, error: "Latitude must be between -90 and 90", field: "latitude" };
    }
    
    if (typeof config.longitude !== 'number') {
        return { isValid: false, error: "Longitude must be a number", field: "longitude" };
    }
    if (config.longitude < -180 || config.longitude > 180) {
        return { isValid: false, error: "Longitude must be between -180 and 180", field: "longitude" };
    }
    
    if (!config.timezone || typeof config.timezone !== 'string') {
        return { isValid: false, error: "Timezone must be a valid IANA timezone string", field: "timezone" };
    }
    
    // Optional parameters with defaults
    if (config.calculationMethodId !== undefined && 
        !Object.keys(CALCULATION_METHODS).includes(String(config.calculationMethodId))) {
        return { isValid: false, error: `Invalid calculation method ID: ${config.calculationMethodId}`, field: "calculationMethodId" };
    }
    
    if (config.asrJuristicMethodId !== undefined && 
        !Object.keys(ASR_JURISTIC_METHODS).includes(String(config.asrJuristicMethodId))) {
        return { isValid: false, error: `Invalid Asr juristic method ID: ${config.asrJuristicMethodId}`, field: "asrJuristicMethodId" };
    }
    
    if (config.latitudeAdjustmentMethodId !== null && 
        config.latitudeAdjustmentMethodId !== undefined && 
        !Object.keys(LATITUDE_ADJUSTMENT_METHODS).includes(String(config.latitudeAdjustmentMethodId))) {
        return { isValid: false, error: `Invalid latitude adjustment method ID: ${config.latitudeAdjustmentMethodId}`, field: "latitudeAdjustmentMethodId" };
    }
    
    if (config.midnightModeId !== undefined && 
        !Object.keys(MIDNIGHT_MODES).includes(String(config.midnightModeId))) {
        return { isValid: false, error: `Invalid midnight mode ID: ${config.midnightModeId}`, field: "midnightModeId" };
    }
    
    // Validate iqamah offsets
    if (!config.iqamahOffsets) {
        return { isValid: false, error: "Iqamah offsets are missing", field: "iqamahOffsets" };
    }
    
    const requiredOffsets = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
    for (const prayer of requiredOffsets) {
        if (typeof config.iqamahOffsets[prayer] !== 'number') {
            return { isValid: false, error: `Iqamah offset for ${prayer} must be a number`, field: `iqamahOffsets.${prayer}` };
        }
        // Offsets should be reasonable (between 0 and 120 minutes)
        if (config.iqamahOffsets[prayer] < 0 || config.iqamahOffsets[prayer] > 120) {
            return { isValid: false, error: `Iqamah offset for ${prayer} must be between 0 and 120 minutes`, field: `iqamahOffsets.${prayer}` };
        }
    }
    
    return { isValid: true };
}

/**
 * Fetches prayer times from Aladhan API and saves them to the local file system
 * @param {Object} config - Aladhan configuration parameters
 * @param {string} filePath - Path to save the prayer_times.json file
 * @returns {Promise<Object>} - The transformed prayer times data
 */
export async function fetchAndSaveAladhanData(config, filePath) {
    console.log(`📡 Fetching prayer times data from Aladhan API for coordinates: ${config.latitude}, ${config.longitude}...`);

    try {
        // Validate configuration
        const validation = validateAladhanConfig(config);
        if (!validation.isValid) {
            throw new Error(`Invalid Aladhan configuration: ${validation.error}`);
        }
        
        // Get current year
        const year = new Date().getFullYear();
        
        // Fetch prayer times from Aladhan API
        const prayerTimesData = await getPrayerTimesForYear(year, config);
        
        // The getPrayerTimesForYear function already returns data in the correct format
        // with details and salahTimings, so we can use it directly
        
        // Write transformed data to file
        fs.writeFileSync(filePath, JSON.stringify(prayerTimesData, null, 2), 'utf8');
        console.log(`✅ Prayer times data successfully fetched from Aladhan API and saved to ${path.basename(filePath)}.`);
        
        // Validate the newly created file
        if (!validateAndFlagPrayerTimesFile(filePath)) {
            throw new Error(`Failed to validate the newly created ${path.basename(filePath)}. Check validation logic and API response structure.`);
        }
        
        return prayerTimesData;
    } catch (error) {
        console.error("❌ Error fetching and saving Aladhan prayer times:", error);
        
        // Clean up potentially corrupt file
        deletePrayerTimesFile(filePath);
        
        throw error;
    }
}

/**
 * Fetches prayer times for a single day from Aladhan API
 * Used for testing API connectivity
 * @param {Object} config - Configuration object with Aladhan API parameters
 * @returns {Promise<Object>} - Promise resolving to the API response data for a single day
 */
export async function fetchSingleDayFromAladhan(config) {
    try {
        // Validate configuration
        const validation = validateAladhanConfig(config);
        if (!validation.isValid) {
            throw new Error(`Invalid Aladhan configuration: ${validation.error}`);
        }
        
        // Get current date
        const now = new Date();
        const date = now.getDate();
        const month = now.getMonth() + 1; // JavaScript months are 0-indexed
        const year = now.getFullYear();
        
        // Build parameters for API request
        const params = new URLSearchParams({
            latitude: config.latitude,
            longitude: config.longitude,
            method: config.calculationMethodId || 2, // Default to ISNA if not specified
            school: config.asrJuristicMethodId || 0, // Default to Shafi'i if not specified
            date: `${date}-${month}-${year}` // Format: DD-MM-YYYY
        });
        
        if (config.latitudeAdjustmentMethodId !== null && config.latitudeAdjustmentMethodId !== undefined) {
            params.append('latitudeAdjustmentMethod', config.latitudeAdjustmentMethodId);
        }
        
        if (config.midnightModeId !== null && config.midnightModeId !== undefined) {
            params.append('midnightMode', config.midnightModeId);
        }
        
        if (config.timezone) {
            params.append('timezone', config.timezone);
        }
        
        // Construct API URL for timings endpoint
        const url = `${API_BASE_URL}/timings/${date}-${month}-${year}?${params.toString()}`;
        console.log(`Testing Aladhan API connectivity: ${url}`);
        
        // Make API request
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 200 || !data.data) {
            throw new Error(`API returned an error or unexpected data structure: ${data.status || JSON.stringify(data)}`);
        }
        
        return data.data;
    } catch (error) {
        console.error("Error testing Aladhan API connectivity:", error);
        throw error;
    }
}

// Helper functions to get descriptive names for calculation methods and parameters
export function getCalculationMethodName(id) {
    return CALCULATION_METHODS[id] || "Unknown";
}

export function getAsrMethodName(id) {
    return ASR_JURISTIC_METHODS[id] || "Unknown";
}

export function getLatitudeAdjustmentMethodName(id) {
    return LATITUDE_ADJUSTMENT_METHODS[id] || "Unknown";
}

export function getMidnightModeName(id) {
    return MIDNIGHT_MODES[id] || "Unknown";
} 