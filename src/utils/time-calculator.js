/**
 * Time Calculator Utility Module
 * 
 * Provides utilities for prayer time calculations, including iqamah time calculation
 * with specific rounding rules for different prayers.
 */

/**
 * Parses a "HH:MM" string into total minutes from midnight.
 * @param {string} timeStr - Time string e.g., "05:30"
 * @returns {number} Total minutes from midnight.
 */
export function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
        console.warn(`Invalid time string received for parsing: ${timeStr}. Returning 0.`);
        return 0;
    }
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) {
        console.warn(`Could not parse hours/minutes from: ${timeStr}. Returning 0.`);
        return 0;
    }
    return hours * 60 + minutes;
}

/**
 * Formats total minutes from midnight into "HH:MM" string.
 * @param {number} totalMinutes - Total minutes from midnight.
 * @returns {string} Formatted time string e.g., "05:30".
 */
export function formatMinutesToTime(totalMinutes) {
    // Ensure totalMinutes is within a 24-hour cycle (0 to 1439 minutes)
    totalMinutes = (totalMinutes % 1440 + 1440) % 1440;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Rounds minutes according to the specified rounding rules:
 * - For Fajr, Zuhr, Asr, Isha: round to nearest 0, 15, 30, or 45 minutes
 * - For Maghrib: no rounding
 * 
 * Rounding rules:
 * - 00:00 to 07:29 -> round to 00
 * - 07:30 to 22:29 -> round to 15
 * - 22:30 to 37:29 -> round to 30
 * - 37:30 to 52:29 -> round to 45
 * - 52:30 to 59:59 -> round to next hour 00
 * 
 * @param {number} totalMinutes - Total minutes to round
 * @param {boolean} shouldRound - Whether rounding should be applied
 * @returns {number} Rounded total minutes
 */
export function roundMinutesAccordingToRules(totalMinutes, shouldRound = true) {
    if (!shouldRound) {
        return totalMinutes;
    }
    
    let hours = Math.floor(totalMinutes / 60) % 24;
    let minutes = totalMinutes % 60;
    
    // Apply rounding rules
    if (minutes >= 52.5) { // 52:30 to 59:59
        minutes = 0;
        hours = (hours + 1) % 24;
    } else if (minutes >= 37.5) { // 37:30 to 52:29
        minutes = 45;
    } else if (minutes >= 22.5) { // 22:30 to 37:29
        minutes = 30;
    } else if (minutes >= 7.5) { // 07:30 to 22:29
        minutes = 15;
    } else { // 00:00 to 07:29
        minutes = 0;
    }
    
    return hours * 60 + minutes;
}

/**
 * Calculates Iqamah time based on Azan time and offset, applying prayer-specific rounding rules.
 * - For Fajr, Zuhr, Asr, Isha: round to nearest 0, 15, 30, or 45 minutes
 * - For Maghrib: use exact offset without rounding
 * 
 * @param {string} azanTime - Azan time in "HH:MM" format
 * @param {number} offsetMinutes - Iqamah offset in minutes
 * @param {string} prayerName - Name of the prayer (fajr, zuhr, asr, maghrib, isha)
 * @returns {string} Calculated Iqamah time in "HH:MM" format
 */
export function calculateIqamahTime(azanTime, offsetMinutes, prayerName) {
    // Convert azan time to minutes
    const azanMinutes = parseTimeToMinutes(azanTime);
    
    // Add offset
    const rawIqamahMinutes = azanMinutes + offsetMinutes;
    
    // Apply rounding rules based on prayer name
    const shouldRound = prayerName.toLowerCase() !== 'maghrib';
    const roundedIqamahMinutes = roundMinutesAccordingToRules(rawIqamahMinutes, shouldRound);
    
    // Format back to HH:MM
    return formatMinutesToTime(roundedIqamahMinutes);
}

/**
 * Calculates all iqamah times for a day's prayer times
 * 
 * @param {Object} prayerTimes - Object containing prayer times in "HH:MM" format
 * @param {Object} iqamahOffsets - Object containing iqamah offsets in minutes for each prayer
 * @returns {Object} Object containing calculated iqamah times in "HH:MM" format
 */
export function calculateAllIqamahTimes(prayerTimes, iqamahOffsets) {
    return {
        iqamah_fajr: calculateIqamahTime(prayerTimes.fajr, iqamahOffsets.fajr, 'fajr'),
        iqamah_zuhr: calculateIqamahTime(prayerTimes.zuhr, iqamahOffsets.zuhr, 'zuhr'),
        iqamah_asr: calculateIqamahTime(prayerTimes.asr, iqamahOffsets.asr, 'asr'),
        iqamah_maghrib: calculateIqamahTime(prayerTimes.maghrib, iqamahOffsets.maghrib, 'maghrib'),
        iqamah_isha: calculateIqamahTime(prayerTimes.isha, iqamahOffsets.isha, 'isha')
    };
}

/**
 * Extracts HH:MM from time strings like "HH:MM (TZ)" or "HH:MM".
 * @param {string} apiTime - Time string from API.
 * @returns {string} Time in "HH:MM" format.
 */
export function cleanApiTime(apiTime) {
    if (!apiTime || typeof apiTime !== 'string') return "00:00";
    return apiTime.split(' ')[0];
}

/**
 * Checks if a time is between two other times, handling midnight crossover
 * @param {string} time - Time to check in "HH:MM" format
 * @param {string} startTime - Start time in "HH:MM" format
 * @param {string} endTime - End time in "HH:MM" format
 * @returns {boolean} True if time is between start and end times
 */
export function isTimeBetween(time, startTime, endTime) {
    const timeMinutes = parseTimeToMinutes(time);
    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    
    // Handle midnight crossover
    if (startMinutes <= endMinutes) {
        // Normal case: start time is before end time
        return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
    } else {
        // Midnight crossover: start time is after end time
        return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }
} 