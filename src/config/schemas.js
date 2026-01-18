const { z } = require('zod');

const prayerSettingSchema = z.object({
  iqamahOffset: z.number(),
  roundTo: z.number(),
  fixedTime: z.string().nullable(),
  iqamahOverride: z.boolean().default(false),
});

const triggerActionSchema = z.enum(['tts', 'file', 'url']);
const targetSchema = z.enum(['local', 'voiceMonkey']);

const triggerEventSchema = z.object({
  enabled: z.boolean(),
  offsetMinutes: z.number().optional(),
  type: triggerActionSchema,
  template: z.string().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  targets: z.array(z.union([targetSchema, z.literal('browser')]))
    .transform(arr => arr.filter(t => t !== 'browser'))
    .default([]),
});

const prayerTriggersSchema = z.object({
  preAdhan: triggerEventSchema,
  adhan: triggerEventSchema,
  preIqamah: triggerEventSchema,
  iqamah: triggerEventSchema,
  
});

const automationSchema = z.object({
  global: z.object({
    enabled: z.boolean().default(true),
    preAdhanEnabled: z.boolean().default(true),
    adhanEnabled: z.boolean().default(true),
    preIqamahEnabled: z.boolean().default(true),
    iqamahEnabled: z.boolean().default(true),
  }).default({}),
  baseUrl: z.string(),
  audioPlayer: z.string(),
  pythonServiceUrl: z.string(),
  voiceMonkey: z.object({
    enabled: z.boolean(),
    token: z.string().optional(),
    device: z.string().optional(),
  }),
  triggers: z.object({
    fajr: prayerTriggersSchema,
    dhuhr: prayerTriggersSchema,
    asr: prayerTriggersSchema,
    maghrib: prayerTriggersSchema,
    isha: prayerTriggersSchema,
  }),
});

const dataSchema = z.object({
  staleCheckDays: z.number().default(7),
});

const configSchema = z.object({
  location: z.object({
    timezone: z.string().refine((val) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: val });
        return true;
      } catch (e) {
        return false;
      }
    }, { message: "Invalid IANA timezone" }),
    coordinates: z.object({
      lat: z.number().min(-90).max(90),
      long: z.number().min(-180).max(180),
    }),
  }),
  calculation: z.object({
    method: z.union([z.number(), z.string()]).transform((val) => {
      if (typeof val === 'number') return val;
      // Best effort legacy mapping or default to MWC (15)
      return 15; 
    }),
    madhab: z.union([z.number(), z.string()]).transform((val) => {
      if (typeof val === 'number') return val;
      // Best effort legacy mapping or default to Hanafi (1)
      return 1;
    }),
    latitudeAdjustmentMethod: z.union([z.number(), z.string()]).default(0).transform((val) => {
       if (typeof val === 'number') return val;
       return 0;
    }),
    midnightMode: z.union([z.number(), z.string()]).default(0).transform((val) => {
       if (typeof val === 'number') return val;
       return 0; 
    }),
  }),
  prayers: z.object({
    fajr: prayerSettingSchema,
    dhuhr: prayerSettingSchema,
    asr: prayerSettingSchema,
    maghrib: prayerSettingSchema,
    isha: prayerSettingSchema,
  }),
  sources: z.object({
    primary: z.object({ 
      type: z.string(),
      masjidId: z.string().optional() 
    }).passthrough(),
    backup: z.object({ 
      type: z.string(), 
      enabled: z.boolean().optional(),
      masjidId: z.string().optional() 
    }).passthrough().nullable().optional(),
  }),
  data: dataSchema,
  automation: automationSchema,
});

module.exports = {
  configSchema,
  automationSchema,
  prayerTriggersSchema,
  triggerEventSchema,
  prayerSettingSchema
};
