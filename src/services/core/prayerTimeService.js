const fs = require('fs');
const path = require('path');
const { fetchAladhanAnnual, fetchMyMasjidBulk } = require('@adapters/prayerApiAdapter');
const { DateTime } = require('luxon');
const { calculateIqamah, calculateNextPrayer } = require('@utils/calculations');

const CACHE_FILE = path.join(process.cwd(), 'data', 'cache.json');

// Ensure data directory exists
const dataDir = path.dirname(CACHE_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Gets prayer times for a date with next prayer calculation.
 * Encapsulates the logic previously in the /api/prayers route.
 * 
 * @param {Object} config - Application configuration.
 * @param {string} timezone - Timezone string.
 * @returns {Promise<Object>} Object containing meta, prayers, and nextPrayer.
 */
async function getPrayersWithNext(config, timezone) {
  const now = DateTime.now().setZone(timezone);
  
  // 1. Fetch Data for Today
  const rawData = await module.exports.getPrayerTimes(config, now);
  
  // 2. Process Prayers (Start + Iqamah)
  const prayers = {};
  const prayerNames = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  
  prayerNames.forEach(name => {
    const startISO = rawData.prayers[name]; 
    if (!startISO) {
        console.warn(`[PrayerService] Missing prayer time for ${name}`);
        return;
    }
    
    let iqamahISO = null;
    if (name !== 'sunrise') {
        // Use explicit Iqamah from source if available (FR-05)
        if (rawData.prayers.iqamah && rawData.prayers.iqamah[name]) {
            iqamahISO = rawData.prayers.iqamah[name];
        } else {
            // Fallback to calculation
            const settings = config.prayers[name];
            if (settings) {
                iqamahISO = calculateIqamah(startISO, settings, timezone);
            }
        }
    }
    
    prayers[name] = {
      start: startISO,
      iqamah: iqamahISO
    };
  });

  // 3. Calculate Next Prayer
  let nextPrayer = calculateNextPrayer(prayers, now);

  // 4. If no next prayer today (post-Isha), fetch Tomorrow's Fajr
  if (!nextPrayer) {
      try {
          const tomorrow = now.plus({ days: 1 });
          const tomorrowData = await module.exports.getPrayerTimes(config, tomorrow);
          
          if (tomorrowData && tomorrowData.prayers && tomorrowData.prayers.fajr) {
              nextPrayer = {
                  name: 'fajr',
                  time: tomorrowData.prayers.fajr,
                  isTomorrow: true
              };
          }
      } catch (tomorrowError) {
          console.error(`[PrayerService] Failed to fetch tomorrow's Fajr: ${tomorrowError.message}`);
      }
  }
  
  return {
    meta: {
      date: rawData.meta.date,
      location: timezone,
      source: rawData.meta.source,
      cached: rawData.meta.cached
    },
    prayers,
    nextPrayer
  };
}

/**
 * Service to orchestrate fetching and caching of prayer times.
 * Supports Annual/Bulk fetching strategy.
 * 
 * @param {Object} config - Application configuration.
 * @param {import('luxon').DateTime} date - Date to fetch for.
 * @returns {Promise<Object>} Prayer times object + meta.
 */
async function getPrayerTimes(config, date = DateTime.now()) {
  const dateKey = date.toISODate();
  const year = date.year;

  // 1. Read Cache
  let cache = readCache();
  
  // Check hit
  if (cache.data && cache.data[dateKey]) {
    // console.log(`Cache HIT for ${dateKey}`);
    return {
      meta: {
        date: dateKey,
        source: cache.meta.source,
        lastFetched: cache.meta.lastFetched,
        cached: true
      },
      prayers: applyOverrides(cache.data[dateKey], config)
    };
  }

  console.log(`Cache MISS for ${dateKey}, triggering bulk fetch.`);

  // 2. Fetch
  let newDataMap = null;
  let sourceUsed = null;

  /**
   * Internal helper to attempt fetching prayer times from a specific source.
   * 
   * @param {Object} sourceConfig - The configuration for the data source.
   * @returns {Promise<Object|null>} A map of prayer times if successful, otherwise null.
   * @throws {Error} If the source type is unknown.
   */
  const tryFetch = async (sourceConfig) => {
    if (!sourceConfig || !sourceConfig.type) return null;
    console.log(`[PrayerService] Attempting fetch from source: ${sourceConfig.type}`);
    
    if (sourceConfig.type === 'aladhan') {
      return await fetchAladhanAnnual(config, year);
    } else if (sourceConfig.type === 'mymasjid') {
      return await fetchMyMasjidBulk(config);
    }
    throw new Error(`Unknown source type: ${sourceConfig.type}`);
  };

  try {
    const primary = config.sources.primary;
    newDataMap = await tryFetch(primary);
    
    if (!newDataMap || Object.keys(newDataMap).length === 0) {
      throw new Error(`Primary source (${primary.type}) returned empty data.`);
    }

    sourceUsed = primary.type;
  } catch (error) {
    console.error(`Primary source (${config.sources.primary.type}) failed: ${error.message}`);
    
    // Try Backup
    if (config.sources.backup) {
      try {
        const backup = config.sources.backup;
        newDataMap = await tryFetch(backup);
        sourceUsed = backup.type;
      } catch (backupError) {
        console.error(`Backup source (${config.sources.backup.type}) failed: ${backupError.message}`);
      }
    }
  }

  if (!newDataMap || Object.keys(newDataMap).length === 0) {
    throw new Error("Unable to retrieve prayer times from any source.");
  }

  // 3. Write Cache
  // Merge new data into existing cache data to preserve other years/months if needed
  
  const updatedCache = {
    meta: {
      lastFetched: DateTime.now().toISO(),
      source: sourceUsed
    },
    data: {
      ...(cache.data || {}),
      ...newDataMap
    }
  };

  writeCache(updatedCache);

  // 4. Return specific date
  const resultForDate = updatedCache.data[dateKey];
  
  if (!resultForDate) {
    throw new Error(`Data for ${dateKey} not found in bulk response.`);
  }

  return {
    meta: {
      date: dateKey,
      source: sourceUsed,
      lastFetched: updatedCache.meta.lastFetched,
      cached: false
    },
    prayers: applyOverrides(resultForDate, config)
  };
}

/**
 * Reads the prayer times cache from the file system.
 * 
 * @returns {Object} The parsed cache object, or an empty object if the file is missing or corrupt.
 */
function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const content = fs.readFileSync(CACHE_FILE, 'utf-8');
      try {
        return JSON.parse(content);
      } catch (e) {
        console.warn('Cache file corrupted, resetting.');
        return {};
      }
    }
  } catch (e) {
    console.error(`Error reading cache file: ${e.message}`);
  }
  return {};
}

/**
 * Writes the prayer times cache to the file system.
 * 
 * @param {Object} data - The cache object to save.
 * @returns {void}
 */
function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Error writing cache file: ${e.message}`);
  }
}

/**
 * Applies locally configured iqamah overrides to the fetched prayer times.
 * 
 * @param {Object} prayers - The standard prayer times object.
 * @param {Object} config - The application configuration containing overrides.
 * @returns {Object} The prayer times object with overrides applied.
 */
function applyOverrides(prayers, config) {
    if (!prayers) return prayers;
    if (!config || !config.prayers) return prayers;
    const processed = { ...prayers, iqamah: { ...(prayers.iqamah || {}) } };
    
    ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(prayer => {
        const pConfig = config.prayers[prayer];
        if (pConfig && pConfig.iqamahOverride) {
            if (prayers[prayer]) {
                try {
                    const iqamah = calculateIqamah(prayers[prayer], pConfig, config.location.timezone);
                    processed.iqamah[prayer] = iqamah;
                } catch (e) {
                    console.warn(`Failed to override iqamah for ${prayer}:`, e.message);
                }
            }
        }
    });
    return processed;
}

/**
 * Forces a refresh of the prayer times by deleting the cache and re-fetching.
 * 
 * @param {Object} config - The application configuration object.
 * @returns {Promise<Object>} The fresh prayer times data.
 */
async function forceRefresh(config) {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            fs.unlinkSync(CACHE_FILE);
        } catch (e) {
             // ignore if fails?
        }
    }
    return getPrayerTimes(config, DateTime.now());
}

module.exports = {
  getPrayerTimes,
  getPrayersWithNext,
  forceRefresh,
  readCache
};
