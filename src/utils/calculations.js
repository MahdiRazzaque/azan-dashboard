const { DateTime } = require('luxon');

/**
 * Calculate Iqamah time based on prayer start and settings.
 * @param {string} prayerStartISO - Prayer start time in ISO format.
 * @param {object} settings - Configuration for the prayer ({ iqamahOffset, roundTo, fixedTime }).
 * @param {string} timezone - The timezone to perform calculations in.
 * @returns {string} Calculated Iqamah time in ISO 8601 format.
 */
function calculateIqamah(prayerStartISO, settings, timezone) {
  if (!prayerStartISO || !settings || !timezone) {
    throw new Error('Invalid arguments passed to calculateIqamah');
  }

  const prayerTime = DateTime.fromISO(prayerStartISO).setZone(timezone);
  
  if (!prayerTime.isValid) {
    throw new Error('Invalid prayerStartISO format');
  }

  // Priority 1: Fixed Time
  if (settings.fixedTime) {
    const [fixedHour, fixedMinute] = settings.fixedTime.split(':').map(Number);
    const iqamahFixed = prayerTime.set({
      hour: fixedHour,
      minute: fixedMinute,
      second: 0,
      millisecond: 0
    });
    return iqamahFixed.toISO();
  }

  // Priority 2: Dynamic Calculation
  let iqamahTime = prayerTime.plus({ minutes: settings.iqamahOffset });

  // Reset seconds/milliseconds for clean calculation
  iqamahTime = iqamahTime.set({ second: 0, millisecond: 0 });

  const minute = iqamahTime.minute;
  const roundTo = settings.roundTo;

  if (roundTo > 0) {
    const remainder = minute % roundTo;
    if (remainder !== 0) {
      const minutesToAdd = roundTo - remainder;
      iqamahTime = iqamahTime.plus({ minutes: minutesToAdd });
    }
  }

  return iqamahTime.toISO();
}

/**
 * Determine the next prayer based on current time and today's schedule.
 * @param {object} prayers - Object with prayer times { fajr: { start: ISO }, ... }.
 * @param {DateTime} now - Current DateTime object.
 * @returns {object|null} Next prayer object { name, time: ISO } or null if all passed.
 */
function calculateNextPrayer(prayers, now) {
  const prayerNames = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  
  for (const name of prayerNames) {
    if (prayers[name] && prayers[name].start) {
        const prayerTime = DateTime.fromISO(prayers[name].start);
        if (prayerTime > now) {
            return {
                name: name,
                time: prayers[name].start,
                isTomorrow: false
            };
        }
    }
  }
  
  return null; // All prayers for today have passed
}

module.exports = {
  calculateIqamah,
  calculateNextPrayer
};
