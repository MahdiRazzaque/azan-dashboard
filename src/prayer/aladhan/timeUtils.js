/**
 * Parses a "HH:MM" string into total minutes from midnight.
 * @param {string} timeStr - Time string e.g., "05:30"
 * @returns {number} Total minutes from midnight.
 */
export function parseTimeToMinutes(timeStr) {
    if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
        console.warn(`Invalid time string received for parsing: ${timeStr}. Returning 0.`);
        return 0; // Or handle error more gracefully
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
    const hours = Math.floor(totalMinutes / 60) % 24; // Handle potential overflow past 24 hrs
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Calculates Iqamah time with specific rounding rules.
 * @param {string} azanTimeStr - Azan time in "HH:MM" format.
 * @param {number} offsetMinutes - Iqamah offset in minutes.
 * @param {string} prayerName - Name of the prayer (e.g., "fajr", "maghrib").
 * @returns {string} Calculated Iqamah time in "HH:MM" format.
 */
export function calculateIqamahTime(azanTimeStr, offsetMinutes, prayerName) {
    const azanTotalMinutes = parseTimeToMinutes(azanTimeStr);
    let iqamahTotalMinutes = azanTotalMinutes + offsetMinutes;

    // Ensure iqamahTotalMinutes is within a 24-hour cycle (0 to 1439 minutes)
    iqamahTotalMinutes = (iqamahTotalMinutes % 1440 + 1440) % 1440; // handles negative offsets resulting in previous day

    if (prayerName.toLowerCase() === "maghrib") {
        // No rounding for Maghrib
        return formatMinutesToTime(iqamahTotalMinutes);
    }

    // Rounding for Fajr, Zuhr, Asr, Isha
    let currentHour = Math.floor(iqamahTotalMinutes / 60);
    let currentMinute = iqamahTotalMinutes % 60;

    if (currentMinute >= 52.5) { // 52:30 to 59:59
        currentMinute = 0;
        currentHour = (currentHour + 1) % 24;
    } else if (currentMinute >= 37.5) { // 37:30 to 52:29
        currentMinute = 45;
    } else if (currentMinute >= 22.5) { // 22:30 to 37:29
        currentMinute = 30;
    } else if (currentMinute >= 7.5) { // 07:30 to 22:29
        currentMinute = 15;
    } else { // 00:00 to 07:29
        currentMinute = 0;
    }

    const roundedTotalMinutes = currentHour * 60 + currentMinute;
    return formatMinutesToTime(roundedTotalMinutes);
}

/**
 * Extracts HH:MM from time strings like "HH:MM (TZ)" or "HH:MM".
 * @param {string} apiTime - Time string from Aladhan API.
 * @returns {string} Time in "HH:MM" format.
 */
export function cleanApiTime(apiTime) {
    if (!apiTime || typeof apiTime !== 'string') return "00:00"; // Default or error
    return apiTime.split(' ')[0];
} 