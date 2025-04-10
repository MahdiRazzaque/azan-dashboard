import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { getConfig } from '../config/config-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache for prayer times data
let prayerTimesCache = null;

// Validate myMasjid API GuidId
async function validateMyMasjidGuidId(guidId) {
    try {
        const response = await fetch(`https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=${guidId}`);
        const data = await response.json();

        if (!data.model?.salahTimings) {
            console.error("Error: Invalid myMasjid GuidId response:", data);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Error validating myMasjid GuidId:", error);
        return false;
    }
}

// Validate local prayer times file
function validateLocalPrayerTimes(filePath) {
    try {
        // Read and parse the file
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);

        // If already validated, skip validation
        if (data.validated === true) {
            return true;
        }

        // Check if we have the correct structure
        if (!data.model?.masjidDetails?.year || !data.model?.salahTimings) {
            console.error("Error: Invalid prayer times file format");
            return false;
        }

        // Check year
        const currentYear = new Date().getFullYear();
        const fileYear = data.model.masjidDetails.year;
        
        if (fileYear !== currentYear) {
            console.error(`Error: Prayer times file is for year ${fileYear}, but current year is ${currentYear}`);
            return false;
        }

        // Check if we have data for each day
        const daysInYear = ((currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0) ? 366 : 365;
        const days = data.model.salahTimings.length;
        
        if (days < 365) {
            console.error(`Error: Prayer times file should contain at least 365 days, but found ${days} days`);
            return false;
        }

        // Validate each day has required prayer times
        const requiredPrayers = ['fajr', 'shouruq', 'zuhr', 'asr', 'maghrib', 'isha'];
        for (const day of data.model.salahTimings) {
            for (const prayer of requiredPrayers) {
                if (!day[prayer]) {
                    console.error(`Error: Missing ${prayer} prayer time for day ${day.day}/${day.month}`);
                    return false;
                }
            }
        }

        // Add validated flag and save file
        data.validated = true;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error("Error validating local prayer times file:", error);
        return false;
    }
}

// Initialise prayer data source
export async function initialisePrayerDataSource() {
    try {
        // Await the configuration to ensure we have the latest data
        const config = await getConfig();
        
        if (!config || !config.prayerData) {
            console.error("Error: Configuration or prayerData section is missing");
            process.exit(1);
        }
        
        const { source } = config.prayerData;

        if (source === 'mymasjid') {
            if (!config.prayerData.mymasjid?.guidId) {
                console.error("Error: mymasjid guidId is missing in configuration");
                process.exit(1);
            }
            
            const guidId = config.prayerData.mymasjid.guidId;
            const isValid = await validateMyMasjidGuidId(guidId);
            if (!isValid) {
                console.error("Error: Invalid myMasjid GuidId. Please check your configuration.");
                process.exit(1);
            }
        } else if (source === 'local') {
            const prayerTimesPath = path.join(__dirname, '../../prayer_times.json');
            if (!fs.existsSync(prayerTimesPath)) {
                console.error("Error: prayer_times.json not found in root directory");
                process.exit(1);
            }
            
            const isValid = validateLocalPrayerTimes(prayerTimesPath);
            if (!isValid) {
                process.exit(1);
            }
        } else {
            console.error(`Error: Invalid prayer data source '${source}'. Must be 'mymasjid' or 'local'.`);
            process.exit(1);
        }

        console.info('✅ Prayer data source initialised');
    } catch (error) {
        console.error("Error initialising prayer data source:", error);
        process.exit(1);
    }
}

// Get prayer times data
export async function getPrayerTimesData(date) {
    try {
        // Get fresh config with await to ensure it's loaded properly
        const config = await getConfig();
        if (!config || !config.prayerData) {
            throw new Error('Configuration or prayerData section is missing');
        }
        
        const { source } = config.prayerData;

        if (source === 'mymasjid') {
            if (!config.prayerData.mymasjid?.guidId) {
                throw new Error('mymasjid guidId is missing in configuration');
            }
            
            const guidId = config.prayerData.mymasjid.guidId;
            const response = await fetch(`https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=${guidId}`);
            const data = await response.json();

            if (!data.model?.salahTimings) {
                throw new Error('Invalid response from myMasjid API');
            }

            const today = date.format('D');
            const todayMonth = date.format('M');
            const todayTimings = data.model.salahTimings.find(
                t => t.day === parseInt(today) && t.month === parseInt(todayMonth)
            );

            if (!todayTimings) {
                throw new Error('No timings found for today');
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

            prayerTimesCache = formattedData; // Cache the data
            return formattedData;
        } else {
            const prayerTimesPath = path.join(__dirname, '../../prayer_times.json');
            
            try {
                const fileContent = fs.readFileSync(prayerTimesPath, 'utf8');
                const data = JSON.parse(fileContent);
                
                const today = date.format('D');
                const todayMonth = date.format('M');
                const todayTimings = data.model.salahTimings.find(
                    t => t.day === parseInt(today) && t.month === parseInt(todayMonth)
                );

                if (!todayTimings) {
                    throw new Error('No timings found for today');
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

                prayerTimesCache = formattedData;
                return formattedData;
            } catch (error) {
                console.error("Error reading local prayer times file:", error);
                if (prayerTimesCache) {
                    console.log("Using cached prayer times data");
                    return prayerTimesCache;
                }
                throw error;
            }
        }
    } catch (error) {
        if (prayerTimesCache) {
            console.log("Error fetching prayer times, using cached data");
            return prayerTimesCache;
        }
        throw error;
    }
} 