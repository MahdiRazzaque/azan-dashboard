import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { validateAndFlagPrayerTimesFile, deletePrayerTimesFile } from './prayer-file-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Validates MyMasjid API GuildId by making a test API call
 * @param {string} guildId - The MyMasjid GuildId to validate
 * @param {boolean} [returnDetails=false] - Whether to return detailed validation result
 * @returns {Promise<boolean|Object>} - Boolean if returnDetails is false, object with validation details otherwise
 */
export async function validateMyMasjidGuildId(guildId, returnDetails = false) {
    try {
        if (!guildId || typeof guildId !== 'string' || guildId.trim() === '') {
            return returnDetails 
                ? { isValid: false, error: 'Guild ID cannot be empty' } 
                : false;
        }
        
        console.log(`Validating MyMasjid Guild ID: ${guildId}`);
        const response = await fetch(`https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=${guildId}`);
       
        if (!response.ok) {
            const errorMessage = `MyMasjid API request failed with status ${response.status}`;
            return returnDetails 
                ? { isValid: false, error: errorMessage } 
                : false;
        }
        
        const data = await response.json();

        if (!data.model?.salahTimings) {
            const errorMessage = 'Invalid response from MyMasjid API: Missing prayer timings data';
            return returnDetails 
                ? { isValid: false, error: errorMessage } 
                : false;
        }
        
        // Return detailed result if requested
        if (returnDetails) {
            console.log("Valid GuildID");
            return {
                isValid: true,
                masjidName: data.model.masjidDetails?.name || 'Unknown Masjid'
            };
        }
        
        return true;
    } catch (error) {
        console.error("Error validating MyMasjid GuildId:", error);
        return returnDetails 
            ? { isValid: false, error: error.message } 
            : false;
    }
}

/**
 * Fetches prayer times from MyMasjid API and saves them to the local file system
 * @param {string} guildId - The MyMasjid GuildId
 * @param {string} filePath - Path to save the prayer_times.json file
 * @returns {Promise<Object>} - The transformed prayer times data
 */
export async function fetchAndSaveMyMasjidData(guildId, filePath) {
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

        // Transform the data to the new consolidated schema format
        const transformedData = {
            details: {
                sourceApi: "mymasjid",
                year: new Date().getFullYear(),
                guildId: guildId,
                masjidName: fetchedData.model.masjidDetails?.name || "Unknown Masjid"
            },
            salahTimings: fetchedData.model.salahTimings.map(timing => ({
                day: timing.day,
                month: timing.month,
                fajr: timing.fajr,
                shouruq: timing.shouruq,
                zuhr: timing.zuhr,
                asr: timing.asr,
                maghrib: timing.maghrib,
                isha: timing.isha,
                iqamah_fajr: timing.iqamah_Fajr || timing.iqamah_fajr,
                iqamah_zuhr: timing.iqamah_Zuhr || timing.iqamah_zuhr,
                iqamah_asr: timing.iqamah_Asr || timing.iqamah_asr,
                iqamah_maghrib: timing.iqamah_Maghrib || timing.iqamah_maghrib,
                iqamah_isha: timing.iqamah_Isha || timing.iqamah_isha
            })),
            validated: false // Will be set to true after validation
        };

        // Write the transformed data to the file
        fs.writeFileSync(filePath, JSON.stringify(transformedData, null, 2), 'utf8');
        console.log(`✅ Prayer times data successfully fetched from API and saved to ${path.basename(filePath)}.`);
        
        // Now validate the newly created file (this will also add the 'validated: true' flag and re-save)
        if (!validateAndFlagPrayerTimesFile(filePath)) {
            throw new Error(`Failed to validate the newly created ${path.basename(filePath)}. Check validation logic and API response structure.`);
        }
        return transformedData; // Return the transformed data
    } catch (error) {
        console.error(`Error fetching or saving MyMasjid data for ${path.basename(filePath)}:`, error);
        deletePrayerTimesFile(filePath);
        throw error;
    }
} 