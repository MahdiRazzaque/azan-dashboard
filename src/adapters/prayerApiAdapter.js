const { DateTime } = require('luxon');
const {
  CALCULATION_METHODS,
  ASR_JURISTIC_METHODS,
  LATITUDE_ADJUSTMENT_METHODS,
  MIDNIGHT_MODES,
  API_BASE_URL
} = require('@utils/constants');
const {
  AladhanAnnualResponseSchema,
  MyMasjidBulkResponseSchema
} = require('../config/apiSchemas');

// --- Constants Helper ---
/**
 * Resolves the calculation method ID from its display name.
 * 
 * @param {string} methodName - The name of the calculation method.
 * @returns {number} The corresponding integer ID for the Aladhan API.
 */
const getCalculationMethodId = (methodName) => {
    // Reverse lookup
    for (const [id, name] of Object.entries(CALCULATION_METHODS)) {
        if (name === methodName) return parseInt(id);
        if (name.includes(methodName)) return parseInt(id);
    }
    return 2; // Default ISNA
};

/**
 * Resolves the madhab (Asr juristic method) ID from its display name.
 * 
 * @param {string} madhabName - The name of the madhab.
 * @returns {number} The corresponding integer ID for the Aladhan API.
 */
const getMadhabId = (madhabName) => {
    for (const [id, name] of Object.entries(ASR_JURISTIC_METHODS)) {
        if (name.includes(madhabName)) return parseInt(id);
    }
    return 0; // Default Shafi
};

/**
 * Resolves the latitude adjustment method ID from its display name.
 * 
 * @param {string} name - The name of the latitude adjustment method.
 * @returns {number} The corresponding integer ID for the Aladhan API.
 */
const getLatAdjId = (name) => {
    if (!name) return 0;
    for (const [id, val] of Object.entries(LATITUDE_ADJUSTMENT_METHODS)) {
        if (val.includes(name)) return parseInt(id);
    }
    return 0;
};

/**
 * Resolves the midnight mode ID from its display name.
 * 
 * @param {string} name - The name of the midnight mode.
 * @returns {number} The corresponding integer ID for the Aladhan API.
 */
const getMidnightId = (name) => {
    if (!name) return 0;
    for (const [id, val] of Object.entries(MIDNIGHT_MODES)) {
        if (val.includes(name)) return parseInt(id);
    }
    return 0;
};

const { aladhanQueue, myMasjidQueue } = require('@utils/requestQueue');

// Request deduplication store
const activeFetches = new Map();

/**
 * Deduplicates concurrent requests to the same URL.
 * 
 * @param {string} key - Unique key for the request.
 * @param {Function} fetchFn - Function that returns a promise.
 * @returns {Promise} The promise for the request, shared if already active.
 */
function deduplicate(key, fetchFn) {
    if (activeFetches.has(key)) {
        return activeFetches.get(key);
    }
    const promise = fetchFn().finally(() => {
        activeFetches.delete(key);
    });
    activeFetches.set(key, promise);
    return promise;
}

// --- Fetchers ---

/**
 * Internal logic for Aladhan annual fetch.
 * Orchestrates raw API requests and processes the response into a standardised format.
 * 
 * @private
 * @param {Object} config - The application configuration object.
 * @param {number} year - The year to fetch prayer times for.
 * @returns {Promise<Object>} A map of ISO dates to prayer time data.
 * @throws {Error} If the API request fails or schema validation fails.
 */
async function _doFetchAladhanAnnual(config, year) {
  const { coordinates, timezone } = config.location;
  const { method, madhab, latitudeAdjustmentMethod, midnightMode } = config.calculation;
  
  // Config now guarantees numbers (IDs) due to schema transformation
  const methodId = typeof method === 'number' ? method : getCalculationMethodId(method);
  const school = typeof madhab === 'number' ? madhab : getMadhabId(madhab);
  const latAdj = typeof latitudeAdjustmentMethod === 'number' ? latitudeAdjustmentMethod : getLatAdjId(latitudeAdjustmentMethod);
  const midnight = typeof midnightMode === 'number' ? midnightMode : getMidnightId(midnightMode);

  const url = `${API_BASE_URL}/calendar/${year}?latitude=${coordinates.lat}&longitude=${coordinates.long}&method=${methodId}&school=${school}&latitudeAdjustmentMethod=${latAdj}&midnightMode=${midnight}`; 

  console.log(`[Aladhan] Fetching from URL: ${url}`);

  const response = await fetch(url);
  console.log(`[Aladhan] Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    throw new Error(`Aladhan API Error: ${response.statusText}`);
  }

  const json = await response.json();
  let validData;
  try {
    validData = AladhanAnnualResponseSchema.parse(json);
    console.log('[Aladhan] Validation passed.');
  } catch (error) {
    console.error('[Aladhan] Validation FAILED:', error.issues || error.message);
    console.log('[Aladhan] Raw JSON Dump for Debugging:', JSON.stringify(json, null, 2).substring(0, 2000));
    throw new Error('Aladhan Schema Validation Failed');
  }

  const resultMap = {};

  // Iterate over months
  Object.values(validData.data).forEach(monthDays => {
    monthDays.forEach(dayInfo => {
        // Date from Aladhan is DD-MM-YYYY
        const dateStr = dayInfo.date.gregorian.date;
        const [d, m, y] = dateStr.split('-');
        
        const dateObj = DateTime.fromObject({ day: d, month: m, year: y }, { zone: timezone });
        const isoDateKey = dateObj.toISODate(); // YYYY-MM-DD

        /**
         * Cleans and formats the raw time string from the API into an ISO string.
         * 
         * @param {string} timeStr - The raw time string (e.g., "05:30 (BST)").
         * @returns {string|null} The ISO 8601 formatted time string.
         */
        const cleanTime = (timeStr) => {
            if (!timeStr) return null;
            const t = timeStr.split(' ')[0]; // Remove (BST)
            const [hours, minutes] = t.split(':').map(Number);
            return dateObj.set({ hour: hours, minute: minutes, second: 0 }).toISO();
        };

        resultMap[isoDateKey] = {
            fajr: cleanTime(dayInfo.timings.Fajr),
            sunrise: cleanTime(dayInfo.timings.Sunrise),
            dhuhr: cleanTime(dayInfo.timings.Dhuhr),
            asr: cleanTime(dayInfo.timings.Asr),
            maghrib: cleanTime(dayInfo.timings.Maghrib),
            isha: cleanTime(dayInfo.timings.Isha),
            iqamah: {} 
        };
    });
  });

  return resultMap;
}

/**
 * Fetches Annual schedule from Aladhan API (Queued & Deduplicated).
 * 
 * @param {Object} config - The application configuration object.
 * @param {number} year - The year to fetch prayer times for.
 * @returns {Promise<Object>} A promise originating from the deduplication queue.
 */
function fetchAladhanAnnual(config, year) {
    const key = `aladhan-${config.location.coordinates.lat}-${config.location.coordinates.long}-${year}`;
    return deduplicate(key, () => aladhanQueue.schedule(() => _doFetchAladhanAnnual(config, year)));
}

/**
 * Internal logic for MyMasjid bulk fetch.
 * Orchestrates raw API requests and processes the response into a standardised format.
 * 
 * @private
 * @param {Object} config - The application configuration object.
 * @returns {Promise<Object>} A map of ISO dates to prayer and iqamah time data.
 * @throws {Error} If the API request fails or schema validation fails.
 */
async function _doFetchMyMasjidBulk(config) {
  const { sources, location } = config;
  
  // Find the valid MyMasjid configuration (Primary or Backup)
  let sourceConfig = null;
  if (sources.primary && sources.primary.type === 'mymasjid') {
      sourceConfig = sources.primary;
  } else if (sources.backup && sources.backup.type === 'mymasjid') {
      sourceConfig = sources.backup;
  }
  
  if (!sourceConfig || !sourceConfig.masjidId) {
    console.warn("[MyMasjid] Fetch requested but no valid configuration or masjidId found.");
    return {};
  }

  const url = `https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=${sourceConfig.masjidId}`; 
  
  console.log(`[MyMasjid] Fetching from URL: ${url}`);

  const response = await fetch(url);
  console.log(`[MyMasjid] Status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    if (response.status === 400) {
      throw new Error("Invalid Masjid ID: The ID provided is incorrect.");
    }
    if (response.status === 404) {
      throw new Error("Masjid ID not found.");
    }
    throw new Error(`MyMasjid API Error: ${response.statusText}`);
  }
  
  const json = await response.json();
  // console.log('[MyMasjid] Raw Response (preview):', JSON.stringify(json).substring(0, 200) + '...');

  let validData;
  try {
    validData = MyMasjidBulkResponseSchema.parse(json);
    console.log('[MyMasjid] Validation passed.');
  } catch (error) {
    console.error('[MyMasjid] Validation FAILED:', error.issues || error.message);
    // console.log('[MyMasjid] Raw JSON Dump for Debugging:', JSON.stringify(json, null, 2));
    throw new Error('MyMasjid Schema Validation Failed');
  }

  const resultMap = {};
  const currentYear = DateTime.now().setZone(location.timezone).year;

  validData.model.salahTimings.forEach(day => {
      // Construct date from day/month using current year
      const dateObj = DateTime.fromObject(
          { day: day.day, month: day.month, year: currentYear }, 
          { zone: location.timezone }
      );
      
      if (!dateObj.isValid) return;

      const isoDateKey = dateObj.toISODate();
      
      /**
       * Formats a time string into an ISO string using a base date.
       * 
       * @param {string} t - The time string (e.g., "12:30").
       * @param {import('luxon').DateTime} dateBase - The Luxon DateTime object for the corresponding day.
       * @returns {string|null} The ISO 8601 formatted time string.
       */
      const formatTime = (t, dateBase) => {
          if (!t) return null;
          const [h, m] = t.split(':').map(Number);
          return dateBase.set({ hour: h, minute: m, second: 0 }).toISO();
      };

      /**
       * Helper to extract prayer time from either nested array or flat structure.
       * 
       * @param {string} key - Prayer key (e.g. 'fajr', 'shouruq').
       * @param {Object} dayObj - The day data object.
       * @returns {string|null} The raw prayer time string.
       */
      const getTime = (key, dayObj) => {
          const val = dayObj[key];
          if (Array.isArray(val)) {
              return (val && val.length > 0) ? val[0].salahTime : null;
          }
          return typeof val === 'string' ? val : null;
      };

      /**
       * Helper to extract iqamah time from either nested array or flat structure.
       * 
       * @param {string} key - Prayer key (e.g. 'fajr', 'zuhr').
       * @param {Object} dayObj - The day data object.
       * @returns {string|null} The raw iqamah time string.
       */
      const getIqamah = (key, dayObj) => {
          // Check nested format: day.fajr[0].iqamahTime
          if (Array.isArray(dayObj[key])) {
               return (dayObj[key] && dayObj[key].length > 0) ? dayObj[key][0].iqamahTime : null;
          }
          
          // Check flat format: day.iqamah_Fajr
          const flatKey = `iqamah_${key.charAt(0).toUpperCase() + key.slice(1)}`;
          return typeof dayObj[flatKey] === 'string' ? dayObj[flatKey] : null;
      };

      resultMap[isoDateKey] = {
          fajr: formatTime(getTime('fajr', day), dateObj),
          sunrise: formatTime(getTime('shouruq', day), dateObj),
          dhuhr: formatTime(getTime('zuhr', day), dateObj),
          asr: formatTime(getTime('asr', day), dateObj),
          maghrib: formatTime(getTime('maghrib', day), dateObj),
          isha: formatTime(getTime('isha', day), dateObj),
          iqamah: {
              fajr: formatTime(getIqamah('fajr', day), dateObj),
              dhuhr: formatTime(getIqamah('zuhr', day), dateObj),
              asr: formatTime(getIqamah('asr', day), dateObj),
              maghrib: formatTime(getIqamah('maghrib', day), dateObj),
              isha: formatTime(getIqamah('isha', day), dateObj),
          }
      }
  });

  return resultMap;
}

/**
 * Fetches Bulk schedule from MyMasjid API (Queued & Deduplicated).
 * 
 * @param {Object} config - The application configuration object.
 * @returns {Promise<Object>} A promise originating from the deduplication queue.
 */
function fetchMyMasjidBulk(config) {
    const source = (config.sources.primary && config.sources.primary.type === 'mymasjid') 
        ? config.sources.primary 
        : config.sources.backup;
    const key = `mymasjid-${source?.masjidId}`;
    return deduplicate(key, () => myMasjidQueue.schedule(() => _doFetchMyMasjidBulk(config)));
}

module.exports = {
  fetchAladhanAnnual,
  fetchMyMasjidBulk,
  AladhanAnnualResponseSchema,
  MyMasjidBulkResponseSchema
};