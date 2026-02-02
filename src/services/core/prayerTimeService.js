const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { ProviderFactory, ProviderConnectionError, ProviderValidationError } = require('@providers');
const { DateTime } = require('luxon');
const { calculateIqamah, calculateNextPrayer } = require('@utils/calculations');
const asyncLock = require('@utils/asyncLock');

const CACHE_FILE = path.join(process.cwd(), 'data', 'cache.json');

/**
 * In-memory cache to reduce disk I/O for prayer time lookups.
 * @type {Object|null}
 */
let inMemoryCache = null;

/**
 * Ensures the data directory exists.
 */
async function ensureDataDir() {
  const dataDir = path.dirname(CACHE_FILE);
  try {
    await fsp.access(dataDir);
  } catch (e) {
    await fsp.mkdir(dataDir, { recursive: true });
  }
}

/**
 * Gets prayer times for a date with next prayer calculation.
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
        // Use explicit Iqamah from source if available
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

  // Use a lock key based on the primary source type and year to deduplicate
  // identical fetch requests while they are in flight.
  const lockKey = `fetch-${config.sources.primary.type}-${year}`;

  return asyncLock.run(lockKey, async () => {
    // 1. Check In-Memory Cache first
    if (inMemoryCache && inMemoryCache.data && inMemoryCache.data[dateKey]) {
      return {
        meta: {
          date: dateKey,
          source: inMemoryCache.meta.source,
          lastFetched: inMemoryCache.meta.lastFetched,
          cached: true
        },
        prayers: applyOverrides(inMemoryCache.data[dateKey], config)
      };
    }

    // 2. Fallback to Disk Cache
    let cache = await readCache();
    
    // Check hit
    if (cache.data && cache.data[dateKey]) {
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

    // 3. Remote Fetch
    let newDataMap = null;
    let sourceUsed = null;

    const tryFetch = async (sourceConfig) => {
      if (!sourceConfig || !sourceConfig.type) return null;
      console.log(`[PrayerService] Attempting fetch from source: ${sourceConfig.type}`);
      
      const provider = ProviderFactory.create(sourceConfig, config);
      return await provider.getAnnualTimes(year);
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
      
      if (error instanceof ProviderValidationError) {
        throw error;
      }

      if (config.sources.backup) {
        if (config.sources.backup.enabled !== false) {
          console.log(`[PrayerService] Attempting failover to backup source.`);
          try {
            const backup = config.sources.backup;
            newDataMap = await tryFetch(backup);
            if (newDataMap && Object.keys(newDataMap).length > 0) {
                sourceUsed = backup.type;
            }
          } catch (backupError) {
            console.error(`Backup source (${config.sources.backup.type}) failed: ${backupError.message}`);
          }
        }
      }
      
      if (!newDataMap || Object.keys(newDataMap).length === 0) {
          throw error;
      }
    }

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

    await writeCache(updatedCache);

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
  });
}

/**
 * Reads the prayer times cache from the file system and populates in-memory cache.
 * @returns {Promise<Object>} The cached data object.
 */
async function readCache() {
  try {
    await fsp.access(CACHE_FILE);
    const content = await fsp.readFile(CACHE_FILE, 'utf-8');
    try {
      inMemoryCache = JSON.parse(content);
      return inMemoryCache;
    } catch (e) {
      console.warn('Cache file corrupted, resetting.');
      inMemoryCache = {};
      return inMemoryCache;
    }
  } catch (e) {
    // File not found or other access error
    inMemoryCache = {};
    return inMemoryCache;
  }
}

/**
 * Writes the prayer times cache to the file system and updates in-memory cache.
 * @param {Object} data The cache object to be written.
 */
async function writeCache(data) {
  try {
    await ensureDataDir();
    await fsp.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
    inMemoryCache = data;
  } catch (e) {
    console.error(`Error writing cache file: ${e.message}`);
  }
}

/**
 * Applies locally configured iqamah overrides.
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
 * @param {Object} config The global application configuration.
 * @returns {Promise<Object>} A promise resolving to the refreshed prayer times for today.
 */
async function forceRefresh(config) {
    inMemoryCache = null;
    try {
        await fsp.unlink(CACHE_FILE);
    } catch (e) {
         // ignore
    }
    return module.exports.getPrayerTimes(config, DateTime.now());
}

module.exports = {
  getPrayerTimes,
  getPrayersWithNext,
  forceRefresh,
  readCache
};