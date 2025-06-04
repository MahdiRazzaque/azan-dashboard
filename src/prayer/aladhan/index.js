// src/prayer/aladhan/index.js

export * from './constants.js';
export * from './timeUtils.js';
export * from './apiClient.js';

// Main function to process prayer times from Aladhan API
import { fetchPrayerTimesForYear } from './apiClient.js';
import { calculateIqamahTime, cleanApiTime } from './timeUtils.js';
import { IQAMAH_PRAYERS } from './constants.js';

/**
 * Fetches and processes prayer times for a year from Aladhan API.
 * @param {number} year - The year to fetch prayer times for.
 * @param {object} config - Configuration object with Aladhan API parameters.
 * @returns {Promise<object>} - Promise resolving to processed prayer times data.
 */
export async function getPrayerTimesForYear(year, config) {
    try {
        const annualData = await fetchPrayerTimesForYear(year, config);
        const salahTimings = [];

        // Process the data from Aladhan API
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
                        month: monthNumber,
                        fajr: cleanApiTime(timings.Fajr),
                        shouruq: cleanApiTime(timings.Sunrise),
                        zuhr: cleanApiTime(timings.Dhuhr),
                        asr: cleanApiTime(timings.Asr),
                        maghrib: cleanApiTime(timings.Maghrib),
                        isha: cleanApiTime(timings.Isha),
                    };

                    // Calculate Iqamah times
                    IQAMAH_PRAYERS.forEach(prayer => {
                        let azanTime;
                        if (prayer === "shouruq") return; // No iqamah for shouruq

                        // Map prayer names to API timing keys
                        if (prayer === "fajr") azanTime = dayEntry.fajr;
                        else if (prayer === "zuhr") azanTime = dayEntry.zuhr;
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
        
        // Sort by month then day to ensure correct order
        salahTimings.sort((a, b) => {
            if (a.month !== b.month) {
                return a.month - b.month;
            }
            return a.day - b.day;
        });

        return {
            details: {
                sourceApi: "aladhan",
                year,
                latitude: config.latitude,
                longitude: config.longitude,
                timezone: config.timezone,
                calculationMethodId: config.calculationMethodId,
                calculationMethodName: config.calculationMethodName,
                asrJuristicMethodId: config.asrJuristicMethodId,
                asrJuristicMethodName: config.asrJuristicMethodName,
                latitudeAdjustmentMethodId: config.latitudeAdjustmentMethodId,
                midnightModeId: config.midnightModeId
            },
            salahTimings,
            validated: true
        };
    } catch (error) {
        console.error("Error processing prayer times:", error);
        throw error;
    }
} 