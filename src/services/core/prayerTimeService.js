const fsp = require("fs").promises;
const path = require("path");
const { ProviderFactory, ProviderValidationError } = require("@providers");
const { DateTime } = require("luxon");
const { calculateIqamah, calculateNextPrayer } = require("@utils/calculations");
const asyncLock = require("@utils/asyncLock");

const CACHE_FILE = path.join(process.cwd(), "data", "cache.json");

/**
 * In-memory cache to reduce disk I/O for prayer time lookups.
 * @type {Object|null}
 */
let inMemoryCache = null;
const PRAYER_NAMES = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

/**
 * Ensures the data directory exists.
 *
 * @returns {Promise<void>} A promise that resolves when the directory is ready.
 */
async function ensureDataDir() {
  const dataDir = path.dirname(CACHE_FILE);
  try {
    await fsp.access(dataDir);
  } catch {
    await fsp.mkdir(dataDir, { recursive: true });
  }
}

/**
 * Gets prayer times for a date with next prayer calculation.
 *
 * @param {Object} config - Application configuration.
 * @param {string} timezone - Timezone string.
 * @param {import('luxon').DateTime} [referenceDate] - The request-scoped date/time used for current-day calculations.
 * @returns {Promise<Object>} Object containing meta, prayers, and nextPrayer.
 */
async function getPrayersWithNext(
  config,
  timezone,
  referenceDate = DateTime.now().setZone(timezone),
) {
  const now = referenceDate.setZone(timezone);

  // 1. Fetch Data for Today
  const rawData = await module.exports.getPrayerTimes(config, now);

  // 2. Process Prayers (Start + Iqamah)
  const prayers = buildPrayerRows(rawData, config, timezone);

  // 3. Calculate Next Prayer
  let nextPrayer = calculateNextPrayer(prayers, now);

  // 4. If no next prayer today (post-Isha), fetch Tomorrow's Fajr
  if (!nextPrayer) {
    try {
      const tomorrow = now.plus({ days: 1 });
      const tomorrowData = await module.exports.getPrayerTimes(
        config,
        tomorrow,
      );

      if (tomorrowData && tomorrowData.prayers && tomorrowData.prayers.fajr) {
        nextPrayer = {
          name: "fajr",
          time: tomorrowData.prayers.fajr,
          isTomorrow: true,
        };
      }
    } catch (tomorrowError) {
      console.error(
        `[PrayerService] Failed to fetch tomorrow's Fajr: ${tomorrowError.message}`,
      );
    }
  }

  return {
    meta: {
      date: rawData.meta.date,
      location: timezone,
      source: rawData.meta.source,
      cached: rawData.meta.cached,
    },
    prayers,
    nextPrayer,
  };
}

/**
 * Builds a window of prayer rows for the dashboard calendar response.
 *
 * @param {Object} config - The global application configuration.
 * @param {string} timezone - The configured location timezone.
 * @param {Object} [options={}] - Cursor options for directional pagination.
 * @param {string} [options.cursorDate] - The anchor date for directional pagination.
 * @param {'future'|'past'} [options.direction] - The chunk direction relative to the cursor.
 * @param {import('luxon').DateTime} [referenceDate] - The request-scoped date/time used for default window generation.
 * @returns {Promise<Object>} A map of ISO dates to prayer rows.
 */
async function getPrayerCalendarWindow(
  config,
  timezone,
  options = {},
  referenceDate = DateTime.now().setZone(timezone),
) {
  const { cursorDate, direction } = options;
  const hasDirectionalCursor = Boolean(cursorDate && direction);
  if (hasDirectionalCursor) {
    const calendarEntries = [];
    let date = getDirectionalWindowStart(cursorDate, direction, timezone);

    for (let offset = 0; offset < 7; offset += 1) {
      try {
        const rawData = await module.exports.getPrayerTimes(config, date);
        calendarEntries.push([
          date.toISODate(),
          buildPrayerRows(rawData, config, timezone),
        ]);
        date =
          direction === "past"
            ? date.minus({ days: 1 })
            : date.plus({ days: 1 });
      } catch (error) {
        break;
      }
    }

    if (direction === "past") {
      calendarEntries.reverse();
    }

    return Object.fromEntries(calendarEntries);
  }

  const startDate = referenceDate
    .setZone(timezone)
    .startOf("day")
    .minus({ days: 7 });
  const calendar = {};

  for (let offset = 0; offset < 15; offset += 1) {
    const date = startDate.plus({ days: offset });
    try {
      const rawData = await module.exports.getPrayerTimes(config, date);
      calendar[date.toISODate()] = buildPrayerRows(rawData, config, timezone);
    } catch (error) {
      continue;
    }
  }

  return calendar;
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
          cached: true,
        },
        prayers: applyOverrides(inMemoryCache.data[dateKey], config),
      };
    }

    // 2. Fallback to Disk Cache
    const cache = await readCache();

    // Check hit
    if (cache.data && cache.data[dateKey]) {
      return {
        meta: {
          date: dateKey,
          source: cache.meta.source,
          lastFetched: cache.meta.lastFetched,
          cached: true,
        },
        prayers: applyOverrides(cache.data[dateKey], config),
      };
    }

    console.log(`Cache MISS for ${dateKey}, triggering bulk fetch.`);

    // 3. Remote Fetch
    let newDataMap = null;
    let sourceUsed = null;

    /**
     * Internal helper to attempt fetching prayer times from a specific source.
     *
     * @param {Object} sourceConfig - The configuration for the prayer time source.
     * @returns {Promise<Object|null>} A promise resolving to the fetched prayer times or null.
     */
    const tryFetch = async (sourceConfig) => {
      if (!sourceConfig || !sourceConfig.type) return null;
      console.log(
        `[PrayerService] Attempting fetch from source: ${sourceConfig.type}`,
      );

      const provider = ProviderFactory.create(sourceConfig, config);
      return await provider.getAnnualTimes(year);
    };

    try {
      const primary = config.sources.primary;
      newDataMap = await tryFetch(primary);

      if (!newDataMap || Object.keys(newDataMap).length === 0) {
        throw new Error(
          `Primary source (${primary.type}) returned empty data.`,
        );
      }

      sourceUsed = primary.type;
    } catch (error) {
      console.error(
        `Primary source (${config.sources.primary.type}) failed: ${error.message}`,
      );

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
            console.error(
              `Backup source (${config.sources.backup.type}) failed: ${backupError.message}`,
            );
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
        source: sourceUsed,
      },
      data: {
        ...(cache.data || {}),
        ...newDataMap,
      },
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
        cached: false,
      },
      prayers: applyOverrides(resultForDate, config),
    };
  });
}

/**
 * Reads the prayer times cache from the file system and populates in-memory cache.
 *
 * @returns {Promise<Object>} The cached data object.
 */
async function readCache() {
  try {
    await fsp.access(CACHE_FILE);
    const content = await fsp.readFile(CACHE_FILE, "utf-8");
    try {
      inMemoryCache = JSON.parse(content);
      return inMemoryCache;
    } catch {
      console.warn("Cache file corrupted, resetting.");
      inMemoryCache = {};
      return inMemoryCache;
    }
  } catch {
    // File not found or other access error
    inMemoryCache = {};
    return inMemoryCache;
  }
}

/**
 * Writes the prayer times cache to the file system and updates in-memory cache.
 *
 * @param {Object} data - The cache object to be written.
 * @returns {Promise<void>} A promise that resolves when the cache is written.
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
 *
 * @param {Object} prayers - The prayer times object.
 * @param {Object} config - The system configuration.
 * @returns {Object} The prayer times object with overrides applied.
 */
function applyOverrides(prayers, config) {
  if (!prayers) return prayers;
  if (!config || !config.prayers) return prayers;
  const processed = { ...prayers, iqamah: { ...(prayers.iqamah || {}) } };

  ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach((prayer) => {
    const pConfig = config.prayers[prayer];
    if (pConfig && pConfig.iqamahOverride) {
      if (prayers[prayer]) {
        try {
          const iqamah = calculateIqamah(
            prayers[prayer],
            pConfig,
            config.location.timezone,
          );
          processed.iqamah[prayer] = iqamah;
        } catch (e) {
          // nosemgrep: unsafe-formatstring -- prayer is from PRAYER_NAMES constant array, not user HTTP input
          console.warn(`Failed to override iqamah for ${prayer}:`, e.message);
        }
      }
    }
  });
  return processed;
}

/**
 * Normalizes a raw prayer payload into dashboard-friendly prayer rows.
 *
 * @param {Object} rawData - Raw prayer response for a single day.
 * @param {Object} config - The global application configuration.
 * @param {string} timezone - The configured location timezone.
 * @returns {Object} A map of prayer names to start/iqamah timestamps.
 */
function buildPrayerRows(rawData, config, timezone) {
  const prayers = {};

  PRAYER_NAMES.forEach((name) => {
    const startISO = rawData?.prayers?.[name];
    if (!startISO) {
      console.warn(`[PrayerService] Missing prayer time for ${name}`);
      return;
    }

    let iqamahISO = null;
    if (name !== "sunrise") {
      if (rawData.prayers.iqamah && rawData.prayers.iqamah[name]) {
        iqamahISO = rawData.prayers.iqamah[name];
      } else {
        const settings = config.prayers[name];
        if (settings) {
          iqamahISO = calculateIqamah(startISO, settings, timezone);
        }
      }
    }

    prayers[name] = {
      start: startISO,
      iqamah: iqamahISO,
    };
  });

  return prayers;
}

/**
 * Resolves the starting day for a directional calendar chunk.
 *
 * @param {string} cursorDate - The current edge date in ISO format.
 * @param {'future'|'past'} direction - The direction to paginate.
 * @param {string} timezone - The configured location timezone.
 * @returns {import('luxon').DateTime} The first day to fetch for the requested chunk.
 */
function getDirectionalWindowStart(cursorDate, direction, timezone) {
  const cursor = DateTime.fromISO(cursorDate, { zone: timezone }).startOf(
    "day",
  );

  if (direction === "past") {
    return cursor.minus({ days: 1 });
  }

  return cursor.plus({ days: 1 });
}

/**
 * Forces a refresh of the prayer times by deleting the cache and re-fetching.
 *
 * @param {Object} config - The global application configuration.
 * @returns {Promise<Object>} A promise resolving to the refreshed prayer times for today.
 */
async function forceRefresh(config) {
  inMemoryCache = null;
  try {
    await fsp.unlink(CACHE_FILE);
  } catch {
    // ignore
  }
  return module.exports.getPrayerTimes(config, DateTime.now());
}

module.exports = {
  getPrayerTimes,
  getPrayersWithNext,
  getPrayerCalendarWindow,
  forceRefresh,
  readCache,
};
