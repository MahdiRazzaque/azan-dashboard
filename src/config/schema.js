/**
 * Defines the configuration schema for the application.
 * This includes support for both MyMasjid and Aladhan prayer time sources.
 */

/**
 * Configuration schema for MyMasjid prayer time source
 */
export const myMasjidSchema = {
  guildId: { type: 'string', required: true }
};

/**
 * Configuration schema for Aladhan prayer time source
 */
export const aladhanSchema = {
  latitude: { type: 'number', required: true, min: -90, max: 90 },
  longitude: { type: 'number', required: true, min: -180, max: 180 },
  timezone: { type: 'string', required: true },
  calculationMethodId: { type: 'number', required: true },
  calculationMethodName: { type: 'string', required: true },
  asrJuristicMethodId: { type: 'number', required: true },
  asrJuristicMethodName: { type: 'string', required: true },
  latitudeAdjustmentMethodId: { type: 'number', required: false },
  midnightModeId: { type: 'number', required: true },
  iqamahOffsets: { 
    type: 'object', 
    required: true,
    properties: {
      fajr: { type: 'number', required: true },
      zuhr: { type: 'number', required: true },
      asr: { type: 'number', required: true },
      maghrib: { type: 'number', required: true },
      isha: { type: 'number', required: true }
    }
  }
};

/**
 * Full configuration schema
 */
export const configSchema = {
  prayerData: {
    type: 'object',
    required: true,
    properties: {
      source: { type: 'string', required: true, enum: ['mymasjid', 'aladhan'] },
      mymasjid: { type: 'object', required: false, schema: myMasjidSchema },
      aladhan: { type: 'object', required: false, schema: aladhanSchema }
    }
  },
  features: {
    type: 'object',
    required: true,
    properties: {
      azanEnabled: { type: 'boolean', required: true },
      announcementEnabled: { type: 'boolean', required: true },
      systemLogsEnabled: { type: 'boolean', required: true }
    }
  },
  auth: {
    type: 'object',
    required: true,
    properties: {
      sessionTimeout: { type: 'number', required: true },
      maxSessions: { type: 'number', required: true }
    }
  },
  prayerSettings: {
    type: 'object',
    required: true,
    properties: {
      prayers: {
        type: 'object',
        required: true,
        properties: {
          fajr: { 
            type: 'object', 
            required: true,
            properties: {
              azanEnabled: { type: 'boolean', required: true },
              announcementEnabled: { type: 'boolean', required: true },
              azanAtIqamah: { type: 'boolean', required: true },
              announcementAtIqamah: { type: 'boolean', required: true }
            }
          },
          zuhr: { 
            type: 'object', 
            required: true,
            properties: {
              azanEnabled: { type: 'boolean', required: true },
              announcementEnabled: { type: 'boolean', required: true },
              azanAtIqamah: { type: 'boolean', required: true },
              announcementAtIqamah: { type: 'boolean', required: true }
            }
          },
          asr: { 
            type: 'object', 
            required: true,
            properties: {
              azanEnabled: { type: 'boolean', required: true },
              announcementEnabled: { type: 'boolean', required: true },
              azanAtIqamah: { type: 'boolean', required: true },
              announcementAtIqamah: { type: 'boolean', required: true }
            }
          },
          maghrib: { 
            type: 'object', 
            required: true,
            properties: {
              azanEnabled: { type: 'boolean', required: true },
              announcementEnabled: { type: 'boolean', required: true },
              azanAtIqamah: { type: 'boolean', required: true },
              announcementAtIqamah: { type: 'boolean', required: true }
            }
          },
          isha: { 
            type: 'object', 
            required: true,
            properties: {
              azanEnabled: { type: 'boolean', required: true },
              announcementEnabled: { type: 'boolean', required: true },
              azanAtIqamah: { type: 'boolean', required: true },
              announcementAtIqamah: { type: 'boolean', required: true }
            }
          }
        }
      },
      globalAzanEnabled: { type: 'boolean', required: true },
      globalAnnouncementEnabled: { type: 'boolean', required: true }
    }
  },
  updatedAt: { type: 'string', required: true }
}; 