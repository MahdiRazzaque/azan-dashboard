const { z } = require('zod');

const prayerSettingSchema = z.object({
  iqamahOffset: z.number(),
  roundTo: z.number(),
  fixedTime: z.string().nullable(),
  iqamahOverride: z.boolean().default(false),
});

const triggerActionSchema = z.enum(['tts', 'file', 'url']);
const targetSchema = z.enum(['local', 'voicemonkey']);

const triggerEventSchema = z.object({
  enabled: z.boolean(),
  offsetMinutes: z.number().min(0).max(60).optional(),
  type: triggerActionSchema,
  template: z.string().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  voice: z.string().optional(),
  targets: z.array(z.string()) // Dynamic targets
    .transform(arr => arr.filter(t => t !== 'browser'))
    .default([]),
});

const prayerTriggersSchema = z.object({
  preAdhan: triggerEventSchema,
  adhan: triggerEventSchema,
  preIqamah: triggerEventSchema,
  iqamah: triggerEventSchema,
  
});

const sunriseTriggersSchema = z.object({
  preAdhan: triggerEventSchema,
  adhan: triggerEventSchema
});

const automationSchema = z.object({
  global: z.object({
    enabled: z.boolean().default(true),
    preAdhanEnabled: z.boolean().default(true),
    adhanEnabled: z.boolean().default(true),
    preIqamahEnabled: z.boolean().default(true),
    iqamahEnabled: z.boolean().default(true),
  }).default({}),
  baseUrl: z.string().optional(),
  pythonServiceUrl: z.string().optional(),
  defaultVoice: z.string().optional(),
  outputs: z.record(z.string(), z.object({
    enabled: z.boolean().default(false),
    verified: z.boolean().default(false),
    leadTimeMs: z.number().min(0).max(300000).default(0),
    params: z.record(z.string(), z.any()).default({})
  })).default({}),
  triggers: z.object({
    fajr: prayerTriggersSchema,
    sunrise: sunriseTriggersSchema,
    dhuhr: prayerTriggersSchema,
    asr: prayerTriggersSchema,
    maghrib: prayerTriggersSchema,
    isha: prayerTriggersSchema,
  }),
}).passthrough();

const dataSchema = z.object({
  staleCheckDays: z.number().default(7),
  storageLimit: z.number().min(0.1).default(1.0), // GB
});

const configSchema = z.object({
  version: z.number().optional().default(1),
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
  prayers: z.object({
    fajr: prayerSettingSchema,
    dhuhr: prayerSettingSchema,
    asr: prayerSettingSchema,
    maghrib: prayerSettingSchema,
    isha: prayerSettingSchema,
  }),
  sources: z.object({
    primary: z.discriminatedUnion('type', [
      z.object({
        type: z.literal('aladhan'),
        method: z.number().default(15),
        madhab: z.number().default(1),
        latitudeAdjustmentMethod: z.number().default(0),
        midnightMode: z.number().default(0)
      }).passthrough(),
      z.object({
        type: z.literal('mymasjid'),
        masjidId: z.string()
      }).passthrough()
    ]),
    backup: z.object({ 
      type: z.string(), 
      enabled: z.boolean().optional()
    }).passthrough().nullable().optional(),
  }),
  data: dataSchema,
  automation: automationSchema,
});

const envUpdateSchema = z.object({
  key: z.string().refine(val => {
      // Allow BASE_URL or any uppercase alphanumeric key (for strategy env vars)
      return val === 'BASE_URL' || /^[A-Z0-9_]+$/.test(val);
  }, { message: "Invalid Environment Key" }),
  value: z.string()
});

module.exports = {
  configSchema,
  automationSchema,
  prayerTriggersSchema,
  sunriseTriggersSchema,
  triggerEventSchema,
  prayerSettingSchema,
  envUpdateSchema
};
