const { z } = require('zod');
const { DateTime } = require('luxon');
const {
  CALCULATION_METHODS,
  ASR_JURISTIC_METHODS,
  API_BASE_URL
} = require('../utils/constants');

// --- Schemas ---

const AladhanDaySchema = z.any();

// Response from /v1/calendar/:year
// data is structured as { "1": [days...], "2": [days...] }
const AladhanAnnualResponseSchema = z.object({
  code: z.number(),
  status: z.string(),
  data: z.any(), // keys are month numbers "1", "2" etc.
});

const MyMasjidBulkResponseSchema = z.object({
  model: z.object({
    salahTimings: z.array(z.object({
        day: z.number(),
        month: z.number(),
        fajr: z.string(),
        zuhr: z.string(),
        asr: z.string(),
        maghrib: z.string(),
        isha: z.string(),
        // Optional iqamah fields
        iqamah_Fajr: z.string().optional(),
        iqamah_Zuhr: z.string().optional(),
        iqamah_Asr: z.string().optional(),
        iqamah_Maghrib: z.string().optional(),
        iqamah_Isha: z.string().optional(),
    }).passthrough())
  }).passthrough()
});

// --- Constants Helper ---
const getCalculationMethodId = (methodName) => {
    // Reverse lookup
    for (const [id, name] of Object.entries(CALCULATION_METHODS)) {
        if (name === methodName) return parseInt(id);
        if (name.includes(methodName)) return parseInt(id);
    }
    return 2; // Default ISNA
};

const getMadhabId = (madhabName) => {
    for (const [id, name] of Object.entries(ASR_JURISTIC_METHODS)) {
        if (name.includes(madhabName)) return parseInt(id);
    }
    return 0; // Default Shafi
};

// --- Fetchers ---

/**
 * Fetches Annual schedule from Aladhan API
 * @param {object} config 
 * @param {number} year 
 * @returns {Promise<Object>} Map of "YYYY-MM-DD" -> { fajr, ... }
 */
async function fetchAladhanAnnual(config, year) {
  const { coordinates, timezone } = config.location;
  const { method, madhab, latitudeAdjustmentMethod, midnightMode } = config.calculation;
  
  // Config now guarantees numbers (IDs) due to schema transformation
  const methodId = typeof method === 'number' ? method : getCalculationMethodId(method);
  const school = typeof madhab === 'number' ? madhab : getMadhabId(madhab);
  const latAdj = typeof latitudeAdjustmentMethod === 'number' ? latitudeAdjustmentMethod : 0;
  const midnight = typeof midnightMode === 'number' ? midnightMode : 0;

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

        const cleanTime = (timeStr) => {
            if (!timeStr) return null;
            const t = timeStr.split(' ')[0]; // Remove (BST)
            const [hours, minutes] = t.split(':').map(Number);
            return dateObj.set({ hour: hours, minute: minutes, second: 0 }).toISO();
        };

        resultMap[isoDateKey] = {
            fajr: cleanTime(dayInfo.timings.Fajr),
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
 * Fetches Bulk schedule from MyMasjid API
 * @param {object} config 
 * @returns {Promise<Object>} Map of "YYYY-MM-DD" -> { fajr, ... }
 */
async function fetchMyMasjidBulk(config) {
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
    console.log('[MyMasjid] Raw JSON Dump for Debugging:', JSON.stringify(json, null, 2));
    throw new Error('MyMasjid Schema Validation Failed');
  }
  
  if (!validData.model || !validData.model.salahTimings) {
      console.warn('[MyMasjid] headings/timings missing in response.');
      return {};
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
      
      const formatTime = (t, dateBase) => {
          if (!t) return null;
          const [h, m] = t.split(':').map(Number);
          return dateBase.set({ hour: h, minute: m, second: 0 }).toISO();
      };

      resultMap[isoDateKey] = {
          fajr: formatTime(day.fajr, dateObj),
          dhuhr: formatTime(day.zuhr, dateObj), // API uses 'zuhr'
          asr: formatTime(day.asr, dateObj),
          maghrib: formatTime(day.maghrib, dateObj),
          isha: formatTime(day.isha, dateObj),
          iqamah: {
              fajr: formatTime(day.iqamah_Fajr, dateObj),
              dhuhr: formatTime(day.iqamah_Zuhr, dateObj),
              asr: formatTime(day.iqamah_Asr, dateObj),
              maghrib: formatTime(day.iqamah_Maghrib, dateObj),
              isha: formatTime(day.iqamah_Isha, dateObj),
          }
      }
  });

  return resultMap;
}

module.exports = {
  fetchAladhanAnnual,
  fetchMyMasjidBulk,
  AladhanAnnualResponseSchema,
  MyMasjidBulkResponseSchema
};
