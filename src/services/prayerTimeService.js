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

  // Helper to execute fetch based on type
  const executeFetch = async (sourceConfig) => {
    if (sourceConfig.type === 'aladhan') {
      return fetchAladhan(config, date);
    } else if (sourceConfig.type === 'mymasjid') {
      return fetchMyMasjid(config);
    }
    throw new Error(`Unknown source type: ${sourceConfig.type}`);
  };

  // 1. Try Primary
  try {
    const primary = config.sources.primary;
    console.log(`Fetching from Primary: ${primary.type}`);
    data = await executeFetch(primary);
    sourceUsed = primary.type;
  } catch (error) {
    console.error(`Primary source failed: ${error.message}`);
    
    // 2. Try Backup
    const backup = config.sources.backup;
    if (backup && backup.type && backup.type !== config.sources.primary.type) {
      try {
        console.log(`Fetching from Backup: ${backup.type}`);
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
      const cacheData = {
        date: date.toISODate(),
        source: sourceUsed,
        lastUpdated: DateTime.now().toISO(),
        data: data
      };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
    } catch (fsError) {
      console.error(`Failed to write cache: ${fsError.message}`);
    }
    
    // Return with meta
    return {
      meta: {
        date: date.toISODate(),
        source: sourceUsed,
        cached: false
      },
      prayers: data
    };
  }

  // 4. Try loading from Cache
  console.log('Attempting to load from cache...');
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheContent = fs.readFileSync(CACHE_FILE, 'utf-8');
      const cache = JSON.parse(cacheContent);
      
      // Note: We might be returning cached data for the WRONG date if the user asked for Today
      // but internet is down and cache has Yesterday. 
      // The requirement says "return most recent successful data".
      // So we return what's in cache.
      
      return {
        meta: {
          date: cache.date, // The date the data validity belongs to
          source: 'cache',
          originalSource: cache.source,
          cached: true
        },
        prayers: cache.data
      };
    }
  } catch (cacheError) {
    console.error(`Cache read failed: ${cacheError.message}`);
  }

  // 5. Critical Failure
  throw new Error('Failed to retrieve prayer times from all sources and cache.');
}

module.exports = {
  getPrayerTimes
};
