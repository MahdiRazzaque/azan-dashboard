/**
 * Prayer Times JSON Schema Consolidation
 * 
 * This module defines the unified schema for prayer_times.json that supports
 * both MyMasjid and Aladhan data sources, along with validation functions.
 */

/**
 * Validate the consolidated prayer times JSON structure
 * @param {Object} data - The prayer times data to validate
 * @returns {Object} - { isValid: boolean, errors: string[] }
 */
export function validatePrayerTimesSchema(data) {
    const errors = [];

    // Check root structure
    if (!data || typeof data !== 'object') {
        errors.push('Invalid root structure: data must be an object');
        return { isValid: false, errors };
    }

    // Check details object
    if (!data.details || typeof data.details !== 'object') {
        errors.push('Missing or invalid details object');
    } else {
        const { details } = data;

        // Validate required fields in details
        if (!details.sourceApi || !['mymasjid', 'aladhan'].includes(details.sourceApi)) {
            errors.push('Invalid or missing sourceApi in details (must be "mymasjid" or "aladhan")');
        }

        if (!details.year || typeof details.year !== 'number' || details.year < 2000 || details.year > 3000) {
            errors.push('Invalid or missing year in details (must be a valid year number)');
        }

        // Validate source-specific details
        if (details.sourceApi === 'mymasjid') {
            if (!details.guildId || typeof details.guildId !== 'string') {
                errors.push('Missing or invalid guildId for MyMasjid source');
            }
            // masjidName is optional but should be string if present
            if (details.masjidName && typeof details.masjidName !== 'string') {
                errors.push('Invalid masjidName (must be string if present)');
            }
        } else if (details.sourceApi === 'aladhan') {
            const requiredAladhanFields = [
                { field: 'latitude', type: 'number', min: -90, max: 90 },
                { field: 'longitude', type: 'number', min: -180, max: 180 },
                { field: 'timezone', type: 'string' },
                { field: 'calculationMethodId', type: 'number', min: 0, max: 23 },
                { field: 'calculationMethodName', type: 'string' }
            ];

            requiredAladhanFields.forEach(({ field, type, min, max }) => {
                if (details[field] === undefined || details[field] === null) {
                    errors.push(`Missing ${field} for Aladhan source`);
                } else if (typeof details[field] !== type) {
                    errors.push(`Invalid ${field} type for Aladhan source (must be ${type})`);
                } else if (type === 'number' && (min !== undefined && details[field] < min || max !== undefined && details[field] > max)) {
                    errors.push(`Invalid ${field} value for Aladhan source (must be between ${min} and ${max})`);
                }
            });
        }
    }

    // Check salahTimings array
    if (!data.salahTimings || !Array.isArray(data.salahTimings)) {
        errors.push('Missing or invalid salahTimings (must be an array)');
    } else {
        const currentYear = new Date().getFullYear();
        const expectedDays = ((currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0) ? 366 : 365;
        
        if (data.salahTimings.length < 365) {
            errors.push(`Insufficient prayer times entries: found ${data.salahTimings.length}, expected at least 365`);
        }

        // Validate first few entries for structure
        const requiredPrayers = ['fajr', 'shouruq', 'zuhr', 'asr', 'maghrib', 'isha'];
        const requiredIqamahFields = ['iqamah_fajr', 'iqamah_zuhr', 'iqamah_asr', 'iqamah_maghrib', 'iqamah_isha'];
        
        for (let i = 0; i < Math.min(5, data.salahTimings.length); i++) {
            const dayEntry = data.salahTimings[i];
            
            if (!dayEntry.day || !dayEntry.month) {
                errors.push(`Invalid day/month in salahTimings entry ${i + 1}`);
                continue;
            }

            // Check prayer times
            for (const prayer of requiredPrayers) {
                if (!dayEntry[prayer] || !/^\d{2}:\d{2}$/.test(dayEntry[prayer])) {
                    errors.push(`Invalid or missing ${prayer} time in salahTimings entry ${i + 1} (must be HH:MM format)`);
                }
            }

            // Check iqamah times
            for (const iqamahField of requiredIqamahFields) {
                if (!dayEntry[iqamahField] || !/^\d{2}:\d{2}$/.test(dayEntry[iqamahField])) {
                    errors.push(`Invalid or missing ${iqamahField} time in salahTimings entry ${i + 1} (must be HH:MM format)`);
                }
            }
        }
    }

    // Check validated flag
    if (data.validated !== true) {
        errors.push('Missing or invalid validated flag (must be true)');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Convert MyMasjid API response to consolidated schema
 * @param {Object} myMasjidData - Raw MyMasjid API response
 * @param {string} guildId - Guild ID used for fetching
 * @returns {Object} - Consolidated prayer times data
 */
export function convertMyMasjidToConsolidated(myMasjidData, guildId) {
    if (!myMasjidData?.model?.salahTimings) {
        throw new Error('Invalid MyMasjid data structure');
    }

    const currentYear = new Date().getFullYear();
    
    return {
        details: {
            sourceApi: 'mymasjid',
            year: currentYear,
            guildId: guildId,
            masjidName: myMasjidData.model.masjidDetails?.name || null
        },
        salahTimings: myMasjidData.model.salahTimings.map(day => ({
            day: day.day,
            month: day.month,
            fajr: day.fajr,
            shouruq: day.shouruq,
            zuhr: day.zuhr,
            asr: day.asr,
            maghrib: day.maghrib,
            isha: day.isha,
            iqamah_fajr: day.iqamah_Fajr,
            iqamah_zuhr: day.iqamah_Zuhr,
            iqamah_asr: day.iqamah_Asr,
            iqamah_maghrib: day.iqamah_Maghrib,
            iqamah_isha: day.iqamah_Isha
        })),
        validated: true
    };
}

/**
 * Convert Aladhan prayer times to consolidated schema
 * @param {Array} aladhanTimings - Array of daily prayer times from Aladhan processing
 * @param {Object} aladhanConfig - Aladhan configuration parameters
 * @returns {Object} - Consolidated prayer times data
 */
export function convertAladhanToConsolidated(aladhanTimings, aladhanConfig) {
    if (!Array.isArray(aladhanTimings) || aladhanTimings.length === 0) {
        throw new Error('Invalid Aladhan timings data');
    }

    const currentYear = new Date().getFullYear();

    return {
        details: {
            sourceApi: 'aladhan',
            year: currentYear,
            latitude: aladhanConfig.latitude,
            longitude: aladhanConfig.longitude,
            timezone: aladhanConfig.timezone,
            calculationMethodId: aladhanConfig.calculationMethodId,
            calculationMethodName: aladhanConfig.calculationMethodName || `Method ${aladhanConfig.calculationMethodId}`,
            asrJuristicMethodId: aladhanConfig.asrJuristicMethodId,
            asrJuristicMethodName: aladhanConfig.asrJuristicMethodName || `ASR Method ${aladhanConfig.asrJuristicMethodId}`,
            latitudeAdjustmentMethodId: aladhanConfig.latitudeAdjustmentMethodId,
            midnightModeId: aladhanConfig.midnightModeId
        },
        salahTimings: aladhanTimings.map(day => ({
            day: day.day,
            month: day.month,
            fajr: day.fajr,
            shouruq: day.shouruq,
            zuhr: day.zuhr,
            asr: day.asr,
            maghrib: day.maghrib,
            isha: day.isha,
            iqamah_fajr: day.iqamah_fajr,
            iqamah_zuhr: day.iqamah_zuhr,
            iqamah_asr: day.iqamah_asr,
            iqamah_maghrib: day.iqamah_maghrib,
            iqamah_isha: day.iqamah_isha
        })),
        validated: true
    };
}

/**
 * Check if current prayer times file is valid for the current year
 * @param {Object} data - Prayer times data
 * @returns {boolean} - True if valid for current year
 */
export function isValidForCurrentYear(data) {
    const currentYear = new Date().getFullYear();
    return data?.details?.year === currentYear && data?.validated === true;
}

/**
 * Get prayer time entry for a specific date
 * @param {Object} prayerTimesData - Consolidated prayer times data
 * @param {number} day - Day of month
 * @param {number} month - Month (1-12)
 * @returns {Object|null} - Prayer times for the day or null if not found
 */
export function getPrayerTimeForDate(prayerTimesData, day, month) {
    if (!prayerTimesData?.salahTimings) {
        return null;
    }

    return prayerTimesData.salahTimings.find(entry => 
        entry.day === day && entry.month === month
    ) || null;
}
