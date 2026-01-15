const { z } = require('zod');

const prayerSettingSchema = z.object({
  iqamahOffset: z.number(),
  roundTo: z.number(),
  fixedTime: z.string().nullable(),
  iqamahOverride: z.boolean().default(false),
});

const triggerActionSchema = z.enum(['tts', 'file', 'url']);
const targetSchema = z.enum(['local', 'browser', 'voiceMonkey']);

const triggerEventSchema = z.object({
  enabled: z.boolean(),
  offsetMinutes: z.number().optional(),
  type: triggerActionSchema,
  template: z.string().optional(),
  path: z.string().optional(),
  url: z.string().optional(),
  targets: z.array(targetSchema),
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
    primary: z.object({ 
      type: z.string(),
      masjidId: z.string().optional() 
    }).passthrough(),
    backup: z.object({ 
      type: z.string(), 
      masjidId: z.string().optional() 
    }).passthrough().optional(),
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
