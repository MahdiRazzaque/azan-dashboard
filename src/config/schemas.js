const { z } = require('zod');

const prayerSettingSchema = z.object({
  iqamahOffset: z.number(),
  roundTo: z.number(),
  fixedTime: z.string().nullable(),
  iqamahOverride: z.boolean().default(false),
});

const triggerActionSchema = z.enum(['tts', 'file', 'url']);

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
    leadTimeMs: z.number().min(-30000).max(30000).default(0),
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

const systemSchema = z.object({
  healthChecks: z.record(z.string(), z.boolean()).default({
    api: true,
    tts: true
  })
}).default({
  healthChecks: {
    api: true,
    tts: true
  }
});

const securitySchema = z.object({
  tokenVersion: z.number().int().default(1),
}).default({
  tokenVersion: 1
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
    primary: z.object({
      type: z.string()
    }).passthrough(),
    backup: z.object({ 
      type: z.string(), 
      enabled: z.boolean().optional()
    }).passthrough().nullable().optional(),
  }),
  data: dataSchema,
  automation: automationSchema,
  system: systemSchema,
  security: securitySchema,
});

const envUpdateSchema = z.object({
  key: z.string().refine(val => {
    // 1. Explicit Blacklist for critical system variables
    const blacklist = ['PATH', 'NODE_OPTIONS', 'SHELL', 'USER', 'HOME', 'LD_PRELOAD'];
    if (blacklist.includes(val)) return false;

    // 2. Strict Whitelist Patterns
    const allowedPatterns = [
      /^AZAN_/,
      /_KEY$/,
      /_TOKEN$/,
      /_SECRET$/,
      /_URL$/,
      /_ID$/,
      /_DEVICE$/,
      /^(PORT|TZ|LOG_LEVEL)$/
    ];

    return allowedPatterns.some(pattern => pattern.test(val));
  }, { message: "Invalid or restricted Environment Key" }),
  value: z.string()
});

module.exports = {
  configSchema,
  automationSchema,
  prayerTriggersSchema,
  sunriseTriggersSchema,
  triggerEventSchema,
  prayerSettingSchema,
  envUpdateSchema,
  securitySchema
};