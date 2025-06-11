/**
 * Defines the consolidated prayer_times.json schema to support both MyMasjid and Aladhan data sources.
 */

/**
 * Schema for the details object in prayer_times.json
 */
export const prayerTimesDetailsSchema = {
  // Common fields for all sources
  sourceApi: { type: 'string', required: true, enum: ['mymasjid', 'aladhan'] },
  year: { type: 'number', required: true },
  
  // MyMasjid specific fields
  guildId: { type: 'string', required: false }, // Required only when sourceApi is 'mymasjid'
  masjidName: { type: 'string', required: false }, // Required only when sourceApi is 'mymasjid'
  
  // Aladhan specific fields
  latitude: { type: 'number', required: false }, // Required only when sourceApi is 'aladhan'
  longitude: { type: 'number', required: false }, // Required only when sourceApi is 'aladhan'
  timezone: { type: 'string', required: false }, // Required only when sourceApi is 'aladhan'
  calculationMethodId: { type: 'number', required: false }, // Required only when sourceApi is 'aladhan'
  calculationMethodName: { type: 'string', required: false }, // Required only when sourceApi is 'aladhan'
  asrJuristicMethodId: { type: 'number', required: false }, // Required only when sourceApi is 'aladhan'
  asrJuristicMethodName: { type: 'string', required: false }, // Required only when sourceApi is 'aladhan'
  latitudeAdjustmentMethodId: { type: 'number', required: false }, // Optional for Aladhan
  midnightModeId: { type: 'number', required: false } // Required only when sourceApi is 'aladhan'
};

/**
 * Schema for a single day's prayer times in the salahTimings array
 */
export const prayerTimesDaySchema = {
  day: { type: 'number', required: true },
  month: { type: 'number', required: true },
  fajr: { type: 'string', required: true }, // Format: "HH:MM"
  shouruq: { type: 'string', required: true }, // Format: "HH:MM"
  zuhr: { type: 'string', required: true }, // Format: "HH:MM"
  asr: { type: 'string', required: true }, // Format: "HH:MM"
  maghrib: { type: 'string', required: true }, // Format: "HH:MM"
  isha: { type: 'string', required: true }, // Format: "HH:MM"
  iqamah_fajr: { type: 'string', required: true }, // Format: "HH:MM"
  iqamah_zuhr: { type: 'string', required: true }, // Format: "HH:MM"
  iqamah_asr: { type: 'string', required: true }, // Format: "HH:MM"
  iqamah_maghrib: { type: 'string', required: true }, // Format: "HH:MM"
  iqamah_isha: { type: 'string', required: true } // Format: "HH:MM"
};

/**
 * Complete schema for prayer_times.json
 */
export const prayerTimesSchema = {
  details: { type: 'object', required: true, schema: prayerTimesDetailsSchema },
  salahTimings: { type: 'array', required: true, itemSchema: prayerTimesDaySchema },
  validated: { type: 'boolean', required: true }
};

/**
 * Validates a time string in "HH:MM" format
 * @param {string} timeStr - Time string to validate
 * @returns {boolean} - Whether the time string is valid
 */
export function isValidTimeFormat(timeStr) {
  if (typeof timeStr !== 'string') return false;
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM format, 00:00 to 23:59
  return timeRegex.test(timeStr);
}

/**
 * Validates a prayer times day entry
 * @param {Object} dayEntry - Prayer times day entry to validate
 * @returns {Object} - Object with isValid and error properties
 */
export function validatePrayerTimesDay(dayEntry) {
  // Check required fields
  const requiredFields = [
    'day', 'month', 'fajr', 'shouruq', 'zuhr', 'asr', 'maghrib', 'isha',
    'iqamah_fajr', 'iqamah_zuhr', 'iqamah_asr', 'iqamah_maghrib', 'iqamah_isha'
  ];
  
  for (const field of requiredFields) {
    if (dayEntry[field] === undefined || dayEntry[field] === null) {
      return { isValid: false, error: `Missing required field: ${field}` };
    }
  }
  
  // Validate day and month
  if (typeof dayEntry.day !== 'number' || dayEntry.day < 1 || dayEntry.day > 31) {
    return { isValid: false, error: `Invalid day: ${dayEntry.day}` };
  }
  
  if (typeof dayEntry.month !== 'number' || dayEntry.month < 1 || dayEntry.month > 12) {
    return { isValid: false, error: `Invalid month: ${dayEntry.month}` };
  }
  
  // Validate prayer times format
  const timeFields = [
    'fajr', 'shouruq', 'zuhr', 'asr', 'maghrib', 'isha',
    'iqamah_fajr', 'iqamah_zuhr', 'iqamah_asr', 'iqamah_maghrib', 'iqamah_isha'
  ];
  
  for (const field of timeFields) {
    if (!isValidTimeFormat(dayEntry[field])) {
      return { isValid: false, error: `Invalid time format for ${field}: ${dayEntry[field]}` };
    }
  }
  
  return { isValid: true };
}

/**
 * Validates the details object in prayer_times.json
 * @param {Object} details - Details object to validate
 * @returns {Object} - Object with isValid and error properties
 */
export function validatePrayerTimesDetails(details) {
  // Check sourceApi
  if (!details.sourceApi || (details.sourceApi !== 'mymasjid' && details.sourceApi !== 'aladhan')) {
    return { isValid: false, error: `Invalid sourceApi: ${details.sourceApi}` };
  }
  
  // Check year
  const currentYear = new Date().getFullYear();
  if (!details.year || typeof details.year !== 'number' || details.year !== currentYear) {
    return { isValid: false, error: `Invalid or outdated year: ${details.year}. Current year is ${currentYear}` };
  }
  
  // Check source-specific fields
  if (details.sourceApi === 'mymasjid') {
    if (!details.guildId || typeof details.guildId !== 'string') {
      return { isValid: false, error: 'Missing or invalid guildId for MyMasjid source' };
    }
    if (!details.masjidName || typeof details.masjidName !== 'string') {
      return { isValid: false, error: 'Missing or invalid masjidName for MyMasjid source' };
    }
  } else if (details.sourceApi === 'aladhan') {
    // Required Aladhan fields
    const requiredAladhanFields = [
      'latitude', 'longitude', 'timezone', 'calculationMethodId', 
      'calculationMethodName', 'asrJuristicMethodId', 'asrJuristicMethodName', 'midnightModeId'
    ];
    
    for (const field of requiredAladhanFields) {
      if (details[field] === undefined || details[field] === null) {
        return { isValid: false, error: `Missing required field for Aladhan source: ${field}` };
      }
    }
    
    // Validate numeric fields
    if (typeof details.latitude !== 'number' || details.latitude < -90 || details.latitude > 90) {
      return { isValid: false, error: `Invalid latitude: ${details.latitude}` };
    }
    
    if (typeof details.longitude !== 'number' || details.longitude < -180 || details.longitude > 180) {
      return { isValid: false, error: `Invalid longitude: ${details.longitude}` };
    }
    
    if (typeof details.calculationMethodId !== 'number') {
      return { isValid: false, error: `Invalid calculationMethodId: ${details.calculationMethodId}` };
    }
    
    if (typeof details.asrJuristicMethodId !== 'number') {
      return { isValid: false, error: `Invalid asrJuristicMethodId: ${details.asrJuristicMethodId}` };
    }
    
    if (typeof details.midnightModeId !== 'number') {
      return { isValid: false, error: `Invalid midnightModeId: ${details.midnightModeId}` };
    }
  }
  
  return { isValid: true };
}

/**
 * Validates the entire prayer_times.json file
 * @param {Object} prayerTimesData - Prayer times data to validate
 * @returns {Object} - Object with isValid and error properties
 */
export function validatePrayerTimes(prayerTimesData) {
  // Check if the data is already validated
  if (prayerTimesData.validated === true) {
    return { isValid: true };
  }
  
  // Check required top-level fields
  if (!prayerTimesData.details) {
    return { isValid: false, error: 'Missing details object' };
  }
  
  if (!prayerTimesData.salahTimings || !Array.isArray(prayerTimesData.salahTimings)) {
    return { isValid: false, error: 'Missing or invalid salahTimings array' };
  }
  
  // Validate details
  const detailsResult = validatePrayerTimesDetails(prayerTimesData.details);
  if (!detailsResult.isValid) {
    return detailsResult;
  }
  
  // Check number of days
  const currentYear = new Date().getFullYear();
  const daysInYear = ((currentYear % 4 === 0 && currentYear % 100 !== 0) || currentYear % 400 === 0) ? 366 : 365;
  
  if (prayerTimesData.salahTimings.length < 365) {
    return { 
      isValid: false, 
      error: `Insufficient number of days in salahTimings. Found ${prayerTimesData.salahTimings.length}, expected at least 365` 
    };
  }
  
  // Validate each day's entry
  for (let i = 0; i < prayerTimesData.salahTimings.length; i++) {
    const dayResult = validatePrayerTimesDay(prayerTimesData.salahTimings[i]);
    if (!dayResult.isValid) {
      return { 
        isValid: false, 
        error: `Invalid data for day ${prayerTimesData.salahTimings[i].day}/${prayerTimesData.salahTimings[i].month}: ${dayResult.error}` 
      };
    }
  }
  
  return { isValid: true };
} 