const { z } = require('zod');

/**
 * Zod schemas for validating Aladhan and MyMasjid API responses.
 */

const AladhanDaySchema = z.object({
  timings: z.object({
    Fajr: z.string(),
    Sunrise: z.string(),
    Dhuhr: z.string(),
    Asr: z.string(),
    Sunset: z.string(),
    Maghrib: z.string(),
    Isha: z.string(),
    Imsak: z.string(),
    Midnight: z.string(),
  }).passthrough(),
  date: z.object({
    gregorian: z.object({
      date: z.string(),
      day: z.string(),
      month: z.object({
        number: z.number(),
      }).passthrough(),
      year: z.string(),
    }).passthrough(),
  }).passthrough(),
  meta: z.object({
    timezone: z.string(),
  }).passthrough(),
}).passthrough();

/**
 * Response from Aladhan /v1/calendar/:year
 * Data is structured as { "1": [days...], "2": [days...] }
 */
const AladhanAnnualResponseSchema = z.object({
  code: z.number(),
  status: z.string(),
  data: z.record(z.string(), z.array(AladhanDaySchema)),
});

// --- MyMasjid Schemas ---

// 1. Nested/Array Format (Standard/Web)
const MyMasjidSalahEntrySchema = z.object({
  salahName: z.string(),
  salahTime: z.string(),
  iqamahTime: z.string().nullable(),
}).passthrough();

const MyMasjidNestedDaySchema = z.object({
    day: z.number(),
    month: z.number(),
    fajr: z.array(MyMasjidSalahEntrySchema),
    zuhr: z.array(MyMasjidSalahEntrySchema),
    asr: z.array(MyMasjidSalahEntrySchema),
    maghrib: z.array(MyMasjidSalahEntrySchema),
    isha: z.array(MyMasjidSalahEntrySchema),
    shouruq: z.array(MyMasjidSalahEntrySchema),
}).passthrough();

// 2. Flat/String Format (Screen/Device)
const MyMasjidFlatDaySchema = z.object({
    day: z.number(),
    month: z.number(),
    fajr: z.string(),
    zuhr: z.string(),
    asr: z.string(),
    maghrib: z.string(),
    isha: z.string(),
    shouruq: z.string(),
    // Flat format typically uses keys like iqamah_Fajr
    iqamah_Fajr: z.string().nullable().optional(),
    iqamah_Zuhr: z.string().nullable().optional(),
    iqamah_Asr: z.string().nullable().optional(),
    iqamah_Maghrib: z.string().nullable().optional(),
    iqamah_Isha: z.string().nullable().optional(),
}).passthrough();

/**
 * Response from MyMasjid timings API.
 * Accepts either nested array structure OR flat structure.
 */
const MyMasjidBulkResponseSchema = z.object({
  model: z.object({
    salahTimings: z.union([
        z.array(MyMasjidNestedDaySchema),
        z.array(MyMasjidFlatDaySchema)
    ])
  }).passthrough()
});

module.exports = {
  AladhanDaySchema,
  AladhanAnnualResponseSchema,
  MyMasjidBulkResponseSchema
};