const fs = require('fs');
const path = require('path');
const { fetchAladhan, fetchMyMasjid } = require('./fetchers');
const { DateTime } = require('luxon');

const CACHE_FILE = path.join(process.cwd(), 'data', 'cache.json');

/**
 * Service to orchestrate fetching and caching of prayer times.
 * @param {object} config - Application configuration.
 * @param {DateTime} date - Date to fetch for.
 * @returns {Promise<object>} Prayer times object.
 */
async function getPrayerTimes(config, date = DateTime.now()) {
  let data = null;
  let sourceUsed = null;
  const dateKey = date.toISODate();

  // Helper to execute fetch based on type
  const executeFetch = async (sourceConfig) => {
    if (sourceConfig.type === 'aladhan') {
      return fetchAladhan(config, date);
    } else if (sourceConfig.type === 'mymasjid') {
      return fetchMyMasjid(config);
    }
    throw new Error(`Unknown source type: ${sourceConfig.type}`);
  };

  // Helper to read cache safely
  const readCacheFile = () => {
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
  };

  // 1. Try Primary
  try {
    const primary = config.sources.primary;
    console.log(`Fetching from Primary: ${primary.type} for ${dateKey}`);
    data = await executeFetch(primary);
    sourceUsed = primary.type;
  } catch (error) {
    console.error(`Primary source failed: ${error.message}`);
    
    // 2. Try Backup
    const backup = config.sources.backup;
    if (backup && backup.type && backup.type !== config.sources.primary.type) {
      try {
        console.log(`Fetching from Backup: ${backup.type} for ${dateKey}`);
        data = await executeFetch(backup);
        sourceUsed = backup.type;
      } catch (backupError) {
        console.error(`Backup source failed: ${backupError.message}`);
      }
    }
  }

  // 3. Save to Cache if successful
  if (data) {
    try {
      const fullCache = readCacheFile();
      
      // Cleanup old schema if present
      if (fullCache.date && typeof fullCache.date === 'string') {
        delete fullCache.date;
        delete fullCache.source;
        delete fullCache.lastUpdated;
        delete fullCache.data;
      }

      fullCache[dateKey] = {
        source: sourceUsed,
        lastUpdated: DateTime.now().toISO(),
        data: data
      };

      fs.writeFileSync(CACHE_FILE, JSON.stringify(fullCache, null, 2));
    } catch (fsError) {
      console.error(`Failed to write cache: ${fsError.message}`);
    }
    
    // Return with meta
    return {
      meta: {
        date: dateKey,
        source: sourceUsed,
        cached: false
      },
      prayers: data
    };
  }

  // 4. Try loading from Cache
  console.log(`Attempting to load from cache for ${dateKey}...`);
  try {
    const fullCache = readCacheFile();
    
    // Check old schema first (legacy support)
    if (fullCache.date === dateKey) {
        return {
           meta: {
               date: fullCache.date,
               source: 'cache',
               originalSource: fullCache.source,
               cached: true
           },
           prayers: fullCache.data
        };
    }

    const cachedDay = fullCache[dateKey];
    if (cachedDay) {
      return {
        meta: {
          date: dateKey,
          source: 'cache',
          originalSource: cachedDay.source,
          cached: true
        },
        prayers: cachedDay.data
      };
    }
  } catch (cacheError) {
    console.error(`Cache read failed: ${cacheError.message}`);
  }

  // 5. Critical Failure
  throw new Error(`Failed to retrieve prayer times for ${dateKey} from all sources and cache.`);
}

module.exports = {
  getPrayerTimes
};
