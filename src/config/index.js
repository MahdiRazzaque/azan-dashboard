const { z } = require('zod');
const fs = require('fs');
const path = require('path');

const prayerSettingSchema = z.object({
  iqamahOffset: z.number(),
  roundTo: z.number(),
  fixedTime: z.string().nullable(),
});

const configSchema = z.object({
  location: z.object({
    timezone: z.string(),
    coordinates: z.object({
      lat: z.number(),
      long: z.number(),
    }),
  }),
  calculation: z.object({
    method: z.string(),
    madhab: z.string(),
  }),
  prayers: z.object({
    fajr: prayerSettingSchema,
    dhuhr: prayerSettingSchema,
    asr: prayerSettingSchema,
    maghrib: prayerSettingSchema,
    isha: prayerSettingSchema,
  }),
  sources: z.object({
    primary: z.object({ type: z.string() }),
    backup: z.object({ type: z.string(), masjidId: z.string().optional() }).optional(),
  }),
});

const loadConfig = () => {
  const configPath = path.join(__dirname, 'default.json');
  
  try {
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const rawConfig = JSON.parse(fileContent);
    return configSchema.parse(rawConfig);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues || error.errors;
      console.error('Configuration validation failed:', JSON.stringify(issues, null, 2));
      throw new Error('Configuration validation failed');
    }
    throw error;
  }
};

const config = loadConfig();
module.exports = config;
