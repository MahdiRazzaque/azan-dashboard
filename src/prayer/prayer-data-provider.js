import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { getConfig } from '../config/config-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for the entire parsed prayer_times.json content
let prayerTimesFileCache = null; 

// Validate myMasjid API GuildId
async function validateMyMasjidGuildId(guildId) {
    try {
        const response = await fetch(`https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=${guildId}`);
        const data = await response.json();

        if (!data.model?.salahTimings) {
            return false;
        }
        return true;
    } catch (error) {
        console.error("Error validating myMasjid GuildId:", error);
        return false;
    }
}

// Validate local prayer times file and add 'validated: true' flag if checks pass
// Returns true if valid, false otherwise.
function validateAndFlagLocalPrayerTimesFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        if (data.validated === true) {
            console.info(`📄 Local prayer times file ${path.basename(filePath)} is already flagged as validated.`);
            return true;
        }

        if (!data.model?.masjidDetails?.year || !data.model?.salahTimings) {
            console.error(`Error: Invalid prayer times file format in ${path.basename(filePath)}. Missing model.masjidDetails.year or model.salahTimings.`);
            console.error(`Content of masjidDetails: ${JSON.stringify(data.model?.masjidDetails)}`);
            return false;
        }

        const currentYear = new Date().getFullYear();
        const fileYear = data.model.masjidDetails.year;
        
        if (parseInt(fileYear) !== currentYear) {
            console.error(`Error: Prayer times file ${path.basename(filePath)} is for year ${fileYear}, but current year is ${currentYear}`);
            return false;
        }

        const daysInYear = ((currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0) ? 366 : 365;
        const days = data.model.salahTimings ? data.model.salahTimings.length : 0;
        
        if (days < 365) {
            console.error(`Error: Prayer times file ${path.basename(filePath)} should contain at least 365 days, but found ${days} days`);
            return false;
        }

        const requiredPrayers = ['fajr', 'shouruq', 'zuhr', 'asr', 'maghrib', 'isha'];
        for (const dayEntry of data.model.salahTimings) {
            for (const prayer of requiredPrayers) {
                if (!dayEntry[prayer]) {
                    console.error(`Error: Missing ${prayer} prayer time in ${path.basename(filePath)} for day ${dayEntry.day}/${dayEntry.month}`);
                    return false;
                }
            }
        }

        data.validated = true;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.info(`✅ Local prayer times file ${path.basename(filePath)} validated and flagged.`);
        return true;
    } catch (error) {
        console.error(`Error validating local prayer times file ${path.basename(filePath)}:`, error);
        return false;
    }
}

// Helper function to fetch full prayer data from MyMasjid and save it locally
async function fetchAndSaveMyMasjidData(guildId, filePath) {
    console.log(`📡 Fetching full prayer times data from MyMasjid for guildId: ${guildId}...`);
    let fetchedData;
    try {
        const response = await fetch(`https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=${guildId}`);
        if (!response.ok) {
            throw new Error(`MyMasjid API request failed with status ${response.status}`);
        }
        fetchedData = await response.json();

        // Basic structural validation of API response
        if (!fetchedData || !fetchedData.model || !fetchedData.model.salahTimings || fetchedData.model.salahTimings.length === 0) {
            console.error("Error: Invalid or empty data structure received from MyMasjid API.", JSON.stringify(fetchedData, null, 2));
            throw new Error('Invalid or empty data structure received from MyMasjid API.');
        }

        // Ensure model.masjidDetails exists and inject/overwrite the year
        if (!fetchedData.model.masjidDetails) {
            fetchedData.model.masjidDetails = {}; 
        }
        fetchedData.model.masjidDetails.year = new Date().getFullYear();

        // Write the enriched data (with year) to the file
        fs.writeFileSync(filePath, JSON.stringify(fetchedData, null, 2), 'utf8');
        console.log(`✅ Prayer times data successfully fetched from API and saved to ${path.basename(filePath)}.`);
        
        // Now validate the newly created file (this will also add the 'validated: true' flag and re-save)
        if (!validateAndFlagLocalPrayerTimesFile(filePath)) {
            // This error means the file we just wrote (with year) is still not passing validation.
            // This could be due to other structural issues or incorrect year logic if API behavior changes.
            throw new Error(`Failed to validate the newly created ${path.basename(filePath)} even after injecting the year. Check validation logic and API response structure.`);
        }
        return fetchedData; // Return the enriched data
    } catch (error) {
        console.error(`Error fetching or saving MyMasjid data for ${path.basename(filePath)}:`, error);
        if (fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
                console.log(`🗑️ Deleted potentially corrupt file: ${path.basename(filePath)}`);
            } catch (delError) {
                console.error(`Error deleting file ${path.basename(filePath)}:`, delError);
            }
        }
        throw error;
    }
}

// Initialise prayer data source
async function initialisePrayerDataSource() {
    const prayerTimesFilePath = path.join(__dirname, '../../prayer_times.json');
    console.log(`ℹ️ Checking for prayer times file at: ${prayerTimesFilePath}`);

    try {
        const config = await getConfig();
        if (!config || !config.prayerData) {
            console.error("❌ Error: Configuration or prayerData section is missing.");
            process.exit(1);
        }

        let fileExists = fs.existsSync(prayerTimesFilePath);
        let localFileIsValid = false;

        if (fileExists) {
            console.log(`📄 File ${path.basename(prayerTimesFilePath)} found. Validating...`);
            if (validateAndFlagLocalPrayerTimesFile(prayerTimesFilePath)) {
                localFileIsValid = true;
            } else {
                console.warn(`⚠️ Existing ${path.basename(prayerTimesFilePath)} is invalid or outdated. Deleting and attempting to re-fetch.`);
                try {
                    fs.unlinkSync(prayerTimesFilePath);
                    fileExists = false;
                } catch (e) {
                    console.error(`❌ Failed to delete invalid file ${path.basename(prayerTimesFilePath)}:`, e);
                    process.exit(1);
                }
            }
        }

        if (!fileExists || !localFileIsValid) {
            console.log(fileExists ? `⚠️ ${path.basename(prayerTimesFilePath)} was invalid.` : `📄 ${path.basename(prayerTimesFilePath)} not found. Attempting to fetch from MyMasjid API.`);
            
            const guildId = config.prayerData?.mymasjid?.guildId;
            if (!guildId) {
                console.error("❌ Error: mymasjid.guildId is missing in configuration. Cannot fetch prayer times.");
                process.exit(1);
            }
            // Fetch, save (with year injected), and validate (which includes flagging)
            await fetchAndSaveMyMasjidData(guildId, prayerTimesFilePath);
        }

        // At this point, prayer_times.json should exist and be valid. Load it into cache.
        const fileContent = fs.readFileSync(prayerTimesFilePath, 'utf8');
        prayerTimesFileCache = JSON.parse(fileContent);
        
        if (!prayerTimesFileCache || !prayerTimesFileCache.model || !prayerTimesFileCache.model.salahTimings) {
             console.error(`❌ Error: ${path.basename(prayerTimesFilePath)} is valid but could not be properly loaded into cache.`);
             process.exit(1);
        }

        console.info(`✅ Prayer data source initialised using ${path.basename(prayerTimesFilePath)}.`);
    } catch (error) {
        console.error("❌ Fatal error initialising prayer data source:", error);
        process.exit(1);
    }
}

// Get prayer times data for a specific date from the cached file content
async function getPrayerTimesData(date) {
    if (!prayerTimesFileCache) {
        console.error("❌ Prayer times cache is not initialised. Call initialisePrayerDataSource first.");
        // Attempt to re-initialize as a last resort, or throw.
        await initialisePrayerDataSource();
        if (!prayerTimesFileCache) {
             throw new Error("Prayer times cache failed to initialise even after re-attempt.");
        }
    }

    try {
            const today = date.format('D'); // Day of the month (1-31)
            const todayMonth = date.format('M'); // Month (1-12)
            
            const todayTimings = prayerTimesFileCache.model.salahTimings.find(
                t => t.day === parseInt(today) && t.month === parseInt(todayMonth)
            );

            if (!todayTimings) {
                throw new Error(`No timings found for date ${date.format('YYYY-MM-DD')} (Day: ${today}, Month: ${todayMonth}) in cached file.`);
            }

            const formattedData = {
                fajr: todayTimings.fajr,
                sunrise: todayTimings.shouruq,
                zuhr: todayTimings.zuhr,
                asr: todayTimings.asr,
                maghrib: todayTimings.maghrib,
                isha: todayTimings.isha,
                fajr_iqamah: todayTimings.iqamah_Fajr,
                zuhr_iqamah: todayTimings.iqamah_Zuhr,
                asr_iqamah: todayTimings.iqamah_Asr,
                maghrib_iqamah: todayTimings.iqamah_Maghrib,
                isha_iqamah: todayTimings.iqamah_Isha
            };

            return formattedData;
    } catch (error) {
        console.error(`Error extracting prayer times for date ${date.format('YYYY-MM-DD')} from cache:`, error);
        throw error;
    }
}

// Export functions
export { 
    initialisePrayerDataSource, 
    getPrayerTimesData,
    validateMyMasjidGuildId // Keep this export as config-service uses it
};