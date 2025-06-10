import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConfig } from '../config/config-service.js';
import { isPrayerTimesFileValid, deletePrayerTimesFile } from './prayer-file-validator.js';
import { fetchAndSaveAladhanData, validateAladhanConfig } from './aladhan-provider.js';
import { fetchAndSaveMyMasjidData, validateMyMasjidGuildId } from './mymasjid-provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for the entire parsed prayer_times.json content
let prayerTimesFileCache = null; 

/**
 * Initializes the prayer data source based on configuration
 * Loads data from API if needed and caches it
 * @returns {Promise<boolean>} - True if initialization was successful
 */
async function initialisePrayerDataSource() {
    const prayerTimesFilePath = path.join(__dirname, '../../prayer_times.json');
    console.log(`ℹ️ Checking for prayer times file at: ${prayerTimesFilePath}`);

    try {
        const config = await getConfig();
        if (!config || !config.prayerData) {
            console.warn("⚠️ Configuration or prayerData section is missing. This is expected during initial setup.");
            return false;
        }

        // Check if the prayer times file exists
        let fileExists = fs.existsSync(prayerTimesFilePath);
        let localFileIsValid = false;
        let sourceChanged = false;

        if (fileExists) {
            try {
                // Read the file to check if the source matches the current configuration
                const fileContent = fs.readFileSync(prayerTimesFilePath, 'utf8');
                const data = JSON.parse(fileContent);
                
                // Check if the source in the file matches the source in the config
                if (data.details && data.details.sourceApi && 
                    ((data.details.sourceApi === 'mymasjid' && config.prayerData.source === 'mymasjid') ||
                     (data.details.sourceApi === 'aladhan' && config.prayerData.source === 'aladhan'))) {            
                    
                    // For MyMasjid, check if the guild ID matches
                    if (data.details.sourceApi === 'mymasjid' && 
                        data.details.guildId !== config.prayerData.mymasjid?.guildId) {
                        console.log(`⚠️ MyMasjid Guild ID has changed. Need to refresh prayer data.`);
                        sourceChanged = true;
                    }
                    
                    // For Aladhan, check if the coordinates or calculation method changed
                    if (data.details.sourceApi === 'aladhan' && 
                        (data.details.latitude !== config.prayerData.aladhan?.latitude ||
                         data.details.longitude !== config.prayerData.aladhan?.longitude ||
                         data.details.calculationMethodId !== config.prayerData.aladhan?.calculationMethodId)) {

                        console.log(`⚠️ Aladhan configuration has changed. Need to refresh prayer data.`);
                        sourceChanged = true;
                    }
                } else if (data.details && data.details.sourceApi) {
                    console.log(`⚠️ Prayer data source has changed from ${data.details.sourceApi} to ${config.prayerData.source}. Need to refresh prayer data.`);
                    sourceChanged = true;
                }
                
                // Only validate if the source hasn't changed
                if (!sourceChanged) {
                    localFileIsValid = isPrayerTimesFileValid(prayerTimesFilePath);
                }
            } catch (error) {
                console.error(`❌ Error reading or parsing prayer times file: ${error.message}`);
                localFileIsValid = false;
            }
            
            // Delete the file if it's invalid or the source changed
            if (!localFileIsValid || sourceChanged) {
                console.warn(`⚠️ Existing ${path.basename(prayerTimesFilePath)} is ${sourceChanged ? 'outdated due to configuration change' : 'invalid'}. Deleting and attempting to re-fetch.`);
                deletePrayerTimesFile(prayerTimesFilePath);
                fileExists = false;
            }
        }

        if (!fileExists || !localFileIsValid || sourceChanged) {
            console.log(fileExists ? `⚠️ ${path.basename(prayerTimesFilePath)} was ${sourceChanged ? 'outdated' : 'invalid'}.` : `📄 ${path.basename(prayerTimesFilePath)} not found. Attempting to fetch from API.`);
            
            const source = config.prayerData.source;
            
            // Delegate to the appropriate provider based on the source
            if (source === 'mymasjid') {
                await initializeMyMasjidSource(config, prayerTimesFilePath);
            } else if (source === 'aladhan') {
                await initializeAladhanSource(config, prayerTimesFilePath);
            } else {
                console.error(`❌ Error: Unknown prayer data source: ${source}`);
                return false;
            }
        }

        // At this point, prayer_times.json should exist and be valid. Load it into cache.
        loadPrayerTimesIntoCache(prayerTimesFilePath);
        
        console.info(`✅ Prayer data source initialised using ${path.basename(prayerTimesFilePath)}.`);
        return true;
    } catch (error) {
        console.error("❌ Error initialising prayer data source:", error);
        return false;
    }
}

/**
 * Initializes the MyMasjid data source
 * @param {Object} config - The application configuration
 * @param {string} filePath - Path to save the prayer times file
 * @returns {Promise<void>}
 */
async function initializeMyMasjidSource(config, filePath) {
    const guildId = config.prayerData?.mymasjid?.guildId;
    if (!guildId) {
        console.error("❌ Error: mymasjid.guildId is missing in configuration. Cannot fetch prayer times.");
        throw new Error("mymasjid.guildId is missing in configuration");
    }
    
    // Fetch, save, and validate
    await fetchAndSaveMyMasjidData(guildId, filePath);
}

/**
 * Initializes the Aladhan data source
 * @param {Object} config - The application configuration
 * @param {string} filePath - Path to save the prayer times file
 * @returns {Promise<void>}
 */
async function initializeAladhanSource(config, filePath) {
    const aladhanConfig = config.prayerData?.aladhan;
    
    // Validate Aladhan configuration
    const validation = validateAladhanConfig(aladhanConfig);
    if (!validation.isValid) {
        console.error(`❌ Error: ${validation.error}`);
        throw new Error(validation.error);
    }
    
    // Fetch, save, and validate Aladhan data
    await fetchAndSaveAladhanData(aladhanConfig, filePath);
}

/**
 * Loads the prayer times file into the cache
 * @param {string} filePath - Path to the prayer times file
 */
function loadPrayerTimesIntoCache(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        prayerTimesFileCache = JSON.parse(fileContent);
        
        if (!prayerTimesFileCache || !prayerTimesFileCache.salahTimings) {
            console.error(`❌ Error: ${path.basename(filePath)} is valid but could not be properly loaded into cache.`);
            throw new Error("Invalid prayer times file format");
        }
    } catch (error) {
        console.error(`❌ Error loading prayer times into cache: ${error.message}`);
        throw error;
    }
}

/**
 * Refreshes prayer data from the configured source
 * Used when configuration changes
 * @returns {Promise<boolean>} - True if refresh was successful
 */
export async function refreshPrayerData() {
    const prayerTimesFilePath = path.join(__dirname, '../../prayer_times.json');
    console.log(`🔄 Refreshing prayer data from configured source...`);
    
    try {
        const config = await getConfig();
        if (!config || !config.prayerData) {
            console.error("❌ Error: Configuration or prayerData section is missing.");
            return false;
        }

        const source = config.prayerData.source;
        
        // Delegate to the appropriate provider based on the source
        if (source === 'mymasjid') {
            await initializeMyMasjidSource(config, prayerTimesFilePath);
        } else if (source === 'aladhan') {
            await initializeAladhanSource(config, prayerTimesFilePath);
        } else {
            console.error(`❌ Error: Unknown prayer data source: ${source}`);
            return false;
        }

        // Reload the cache with the new data
        loadPrayerTimesIntoCache(prayerTimesFilePath);
        console.log(`✅ Prayer data refreshed successfully.`);
        return true;
    } catch (error) {
        console.error("❌ Error refreshing prayer data:", error);
        return false;
    }
}

/**
 * Gets prayer times data for a specific date from the cached file content
 * @param {Object} date - Moment.js date object
 * @returns {Promise<Object>} - Formatted prayer times data
 */
async function getPrayerTimesData(date) {
    if (!prayerTimesFileCache) {
        console.warn("⚠️ Prayer times cache is not initialised. Attempting to initialize...");
        // Attempt to re-initialize
        const initialised = await initialisePrayerDataSource();
        if (!initialised || !prayerTimesFileCache) {
            console.warn("⚠️ No prayer times available. This is expected during initial setup.");
            return null;
        }
    }

    try {
        const today = date.format('D'); // Day of the month (1-31)
        const todayMonth = date.format('M'); // Month (1-12)
        
        const todayTimings = prayerTimesFileCache.salahTimings.find(
            t => t.day === parseInt(today) && t.month === parseInt(todayMonth)
        );

        if (!todayTimings) {
            console.warn(`⚠️ No timings found for date ${date.format('YYYY-MM-DD')} (Day: ${today}, Month: ${todayMonth}) in cached file.`);
            return null;
        }

        const formattedData = {
            fajr: todayTimings.fajr,
            sunrise: todayTimings.shouruq,
            zuhr: todayTimings.zuhr,
            asr: todayTimings.asr,
            maghrib: todayTimings.maghrib,
            isha: todayTimings.isha,
            fajr_iqamah: todayTimings.iqamah_fajr,
            zuhr_iqamah: todayTimings.iqamah_zuhr,
            asr_iqamah: todayTimings.iqamah_asr,
            maghrib_iqamah: todayTimings.iqamah_maghrib,
            isha_iqamah: todayTimings.iqamah_isha
        };

        return formattedData;
    } catch (error) {
        console.error(`Error extracting prayer times for date ${date.format('YYYY-MM-DD')} from cache:`, error);
        throw error;
    }
}

/**
 * Gets information about the prayer data source
 * @returns {Object} - Source information including type and details
 */
function getPrayerDataSourceInfo() {
    if (!prayerTimesFileCache || !prayerTimesFileCache.details) {
        return { 
            sourceType: "setup_required",
            message: "Prayer times setup required"
        };
    }
    
    const details = prayerTimesFileCache.details;
    
    if (details.sourceApi === "mymasjid") {
        return {
            sourceType: "mymasjid",
            masjidName: details.masjidName || "Unknown Masjid",
            guildId: details.guildId,
            year: details.year
        };
    } else if (details.sourceApi === "aladhan") {
        return {
            sourceType: "aladhan",
            latitude: details.latitude,
            longitude: details.longitude,
            timezone: details.timezone,
            calculationMethod: details.calculationMethodName,
            year: details.year
        };
    }
    
    return { 
        sourceType: "unknown",
        message: "Unknown prayer times source"
    };
}

// Export functions
export { 
    initialisePrayerDataSource, 
    getPrayerTimesData,
    getPrayerDataSourceInfo,
    validateMyMasjidGuildId
};