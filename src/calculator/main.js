// main.js
import fs from 'fs';
import { loadConfig, setupConfig } from './configManager.js';
import { fetchPrayerTimesForYear } from './apiClient.js';
import { calculateIqamahTime, cleanApiTime } from './timeUtils.js';
// Corrected import: Added CONFIG_FILE
import { OUTPUT_FILE, IQAMAH_PRAYERS, CONFIG_FILE } from './constants.js';
import readlineSync from 'readline-sync';


async function main() {
    let config = loadConfig();
    if (!config) {
        // This line was causing the error because CONFIG_FILE was not imported here
        console.log(`Configuration file (${CONFIG_FILE}) not found or invalid.`);
        config = setupConfig();
    } else {
        console.log(`Configuration loaded from ${CONFIG_FILE}.`);
        if (readlineSync.keyInYNStrict('Do you want to reconfigure?')) {
            config = setupConfig();
        }
    }

    const currentYear = new Date().getFullYear();
    console.log(`Calculating prayer times for the year ${currentYear}...`);

    let annualData;
    try {
        annualData = await fetchPrayerTimesForYear(currentYear, config);
    } catch (error) {
        console.error("Failed to fetch prayer times. Exiting.");
        return;
    }

    const salahTimings = [];

    // Aladhan API for /calendar/{year} returns data as an object:
    // { "1": [dayObj1, dayObj2...], "2": [...], ... "12": [...] }
    // where keys are month numbers (1-12).
    for (const monthKey in annualData) {
        if (Object.hasOwnProperty.call(annualData, monthKey)) {
            const monthNumber = parseInt(monthKey, 10);
            const daysInMonth = annualData[monthKey];

            console.log(`Processing Month: ${monthNumber}`);

            daysInMonth.forEach(dayData => {
                const timings = dayData.timings;
                const dateInfo = dayData.date.gregorian;

                const dayEntry = {
                    day: parseInt(dateInfo.day, 10),
                    month: monthNumber, // Use the key from annualData which is the month number
                    fajr: cleanApiTime(timings.Fajr),
                    shouruq: cleanApiTime(timings.Sunrise),
                    zuhr: cleanApiTime(timings.Dhuhr),
                    asr: cleanApiTime(timings.Asr),
                    maghrib: cleanApiTime(timings.Maghrib),
                    isha: cleanApiTime(timings.Isha),
                };

                // Calculate Iqamah times
                IQAMAH_PRAYERS.forEach(prayer => {
                    const azanTimeKey = prayer.charAt(0).toUpperCase() + prayer.slice(1); // e.g., Fajr, Dhuhr
                    let azanTime;
                    if (prayer === "shouruq") return; // No iqamah for shouruq

                    // Map prayer names in iqamahOffsets to API timing keys
                    if (prayer === "fajr") azanTime = dayEntry.fajr;
                    else if (prayer === "zuhr") azanTime = dayEntry.zuhr; // Dhuhr in API
                    else if (prayer === "asr") azanTime = dayEntry.asr;
                    else if (prayer === "maghrib") azanTime = dayEntry.maghrib;
                    else if (prayer === "isha") azanTime = dayEntry.isha;
                    
                    if (azanTime && config.iqamahOffsets[prayer] !== undefined) {
                        dayEntry[`iqamah_${prayer}`] = calculateIqamahTime(
                            azanTime,
                            config.iqamahOffsets[prayer],
                            prayer
                        );
                    }
                });
                salahTimings.push(dayEntry);
            });
        }
    }
    
    // Sort by month then day to ensure correct order if API doesn't guarantee it
    salahTimings.sort((a, b) => {
        if (a.month !== b.month) {
            return a.month - b.month;
        }
        return a.day - b.day;
    });


    const outputData = {
        model: {
            salahTimings: salahTimings
        }
    };

    try {
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
        console.log(`Prayer times successfully generated and written to ${OUTPUT_FILE}`);
    } catch (error) {
        console.error(`Error writing output file ${OUTPUT_FILE}:`, error);
    }
}

main().catch(err => {
    console.error("An unexpected error occurred in main execution:", err);
});