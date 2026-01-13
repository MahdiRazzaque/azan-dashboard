const { z } = require('zod');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const prayerSettingSchema = z.object({
  iqamahOffset: z.number(),
  roundTo: z.number(),
  fixedTime: z.string().nullable(),
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
  enabled: z.boolean(),
  baseUrl: z.string(),
  audioPlayer: z.string(),
  pythonServiceUrl: z.string(),
  voiceMonkey: z.object({
    enabled: z.boolean(),
    accessToken: z.string().optional(),
    secretToken: z.string().optional(),
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

const mergeDeep = (target, source) => {
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || source === null) return target;
    
    for (const key in source) {
        if (Array.isArray(target[key]) && Array.isArray(source[key])) {
             target[key] = source[key];
        } else if (typeof target[key] === 'object' && typeof source[key] === 'object') {
            target[key] = mergeDeep(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
};

const loadConfig = () => {
  const configPath = path.join(__dirname, 'default.json');
  const localPath = path.join(__dirname, 'local.json');
  
  try {
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    let rawConfig = JSON.parse(fileContent);

    if (fs.existsSync(localPath)) {
        try {
            const localContent = fs.readFileSync(localPath, 'utf-8');
            const localConfig = JSON.parse(localContent);
            rawConfig = mergeDeep(rawConfig, localConfig);
        } catch (e) {
            console.error('Failed to load local config:', e);
        }
    }

    // Merge Environment Variables
    if (rawConfig.automation) {
        if (process.env.BASE_URL) rawConfig.automation.baseUrl = process.env.BASE_URL;
        if (process.env.PYTHON_SERVICE_URL) rawConfig.automation.pythonServiceUrl = process.env.PYTHON_SERVICE_URL;
        
        // VoiceMonkey Secrets
        if (process.env.VOICEMONKEY_access_token) {
            rawConfig.automation.voiceMonkey.accessToken = process.env.VOICEMONKEY_access_token;
        }
        if (process.env.VOICEMONKEY_secret_token) {
            rawConfig.automation.voiceMonkey.secretToken = process.env.VOICEMONKEY_secret_token;
        }
    }

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
