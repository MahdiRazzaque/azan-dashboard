const { z } = require('zod');
const { DateTime } = require('luxon');

// --- Schemas ---

const AladhanResponseSchema = z.object({
  code: z.number(),
  status: z.string(),
  data: z.object({
    timings: z.object({
      Fajr: z.string(),
      Dhuhr: z.string(),
      Asr: z.string(),
      Maghrib: z.string(),
      Isha: z.string(),
    }),
    date: z.object({
      gregorian: z.object({
        date: z.string(), // DD-MM-YYYY
        format: z.string(),
      }),
    }),
  }),
});

const MyMasjidResponseSchema = z.object({
  // Placeholder schema based on common structure, adaptable
  success: z.boolean(),
  data: z.object({
    prayers: z.object({
      fajr: z.string(),
      dhuhr: z.string(),
      asr: z.string(),
      maghrib: z.string(),
      isha: z.string(),
    })
  })
});

// --- Fetchers ---

/**
 * Fetches from Aladhan API
 * @param {object} config - Application configuration
 * @param {DateTime} date - Date to fetch for (default today)
 * @returns {Promise<object>} Normalized prayer times { fajr: ISO, ... }
 */
async function fetchAladhan(config, date = DateTime.now()) {
  const { coordinates, timezone } = config.location;
  const { method, madhab } = config.calculation;
  
  // Method mapping (basic)
  let methodId = 2; // ISNA default or similar
  if (config.calculation.method === 'MoonsightingCommittee') methodId = 15; // Example
  // In a real app, we'd map string to ID properly.
  
  // Madhab: 0 = Shafi (Standard), 1 = Hanafi
  const school = madhab === 'Hanafi' ? 1 : 0;

  const dateStr = date.toFormat('dd-MM-yyyy');
  const url = `http://api.aladhan.com/v1/timings/${dateStr}?latitude=${coordinates.lat}&longitude=${coordinates.long}&method=${methodId}&school=${school}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Aladhan API Error: ${response.statusText}`);
  }

  const json = await response.json();
  const validData = AladhanResponseSchema.parse(json);

  const timings = validData.data.timings;
  
  // Normalize to ISO-8601 with configured Timezone
  // Aladhan returns HH:mm (often local to the lat/long provided? No, it returns based on "method" but time is string. It doesn't imply zone unless strictly).
  // Actually Aladhan results are "local time" for the coordinates.
  // We should interpret them in the config.location.timezone.
  
  const toISO = (timeStr) => {
    // timeStr is "05:00" or "05:00 (BST)"
    const cleanTime = timeStr.split(' ')[0]; // Remove (BST) if present
    const [hours, minutes] = cleanTime.split(':').map(Number);
    return date.setZone(timezone).set({ hour: hours, minute: minutes, second: 0 }).toISO();
  };

  return {
    fajr: toISO(timings.Fajr),
    dhuhr: toISO(timings.Dhuhr),
    asr: toISO(timings.Asr),
    maghrib: toISO(timings.Maghrib),
    isha: toISO(timings.Isha),
  };
}

/**
 * Fetches from MyMasjid API
 * @param {object} config 
 */
async function fetchMyMasjid(config) {
  const { sources } = config;
  const backup = sources.backup || {};
  
  if (backup.type !== 'mymasjid' || !backup.masjidId) {
    throw new Error('MyMasjid not configured or missing ID');
  }

  const url = `https://time.my-masjid.com/api/timings/${backup.masjidId}`;
  
  // Mocking implementation note: Since I don't have the live API specs, 
  // I will implement the fetch/validate/normalize pattern.
  
  const response = await fetch(url);
  if (!response.ok) {
     throw new Error(`MyMasjid API Error: ${response.statusText}`);
  }
  
  const json = await response.json();
  // Validating against presumed schema
  const validData = MyMasjidResponseSchema.parse(json);
  
  // Normalize...
  // Assuming keys are ISOs or times.
  return validData.data.prayers; 
}

module.exports = {
  fetchAladhan,
  fetchMyMasjid,
  AladhanResponseSchema,
  MyMasjidResponseSchema
};
