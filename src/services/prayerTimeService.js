const fs = require('fs');
const path = require('path');
const { fetchAladhanAnnual, fetchMyMasjidBulk } = require('./fetchers');
const { DateTime } = require('luxon');

const CACHE_FILE = path.join(process.cwd(), 'data', 'cache.json');

// Ensure data directory exists
const dataDir = path.dirname(CACHE_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Service to orchestrate fetching and caching of prayer times.
 * Supports Annual/Bulk fetching strategy.
 * 
 * @param {object} config - Application configuration.
 * @param {DateTime} date - Date to fetch for.
 * @returns {Promise<object>} Prayer times object + meta.
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
      prayers: cache.data[dateKey]
    };
  }

  console.log(`Cache MISS for ${dateKey}, triggering bulk fetch.`);

  // 2. Fetch
  let newDataMap = null;
  let sourceUsed = null;

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
    prayers: resultForDate
  };
}

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

function writeCache(data) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(`Error writing cache file: ${e.message}`);
  }
}

/**
 * Force refresh logic (Task 6 helper)
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
  forceRefresh,
  readCache
};
