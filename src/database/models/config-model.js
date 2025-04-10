import mongoose from 'mongoose';

// Schema for prayer settings
const PrayerSettingsSchema = new mongoose.Schema({
  prayers: {
    fajr: {
      azanEnabled: { type: Boolean, default: true },
      announcementEnabled: { type: Boolean, default: false },
      azanAtIqamah: { type: Boolean, default: true }
    },
    zuhr: {
      azanEnabled: { type: Boolean, default: true },
      announcementEnabled: { type: Boolean, default: true },
      azanAtIqamah: { type: Boolean, default: true }
    },
    asr: {
      azanEnabled: { type: Boolean, default: true },
      announcementEnabled: { type: Boolean, default: true },
      azanAtIqamah: { type: Boolean, default: true }
    },
    maghrib: {
      azanEnabled: { type: Boolean, default: true },
      announcementEnabled: { type: Boolean, default: true },
      azanAtIqamah: { type: Boolean, default: false }
    },
    isha: {
      azanEnabled: { type: Boolean, default: true },
      announcementEnabled: { type: Boolean, default: true },
      azanAtIqamah: { type: Boolean, default: true }
    }
  },
  globalAzanEnabled: { type: Boolean, default: true },
  globalAnnouncementEnabled: { type: Boolean, default: true }
});

// Main configuration schema
const ConfigSchema = new mongoose.Schema({
  prayerData: {
    source: { type: String, default: 'mymasjid' },
    mymasjid: {
      guidId: { type: String, default: '03b8d82c-5b0e-4cb9-ad68-8c7e204cae00' }
    }
  },
  features: {
    azanEnabled: { type: Boolean, default: true },
    announcementEnabled: { type: Boolean, default: true },
    systemLogsEnabled: { type: Boolean, default: true }
  },
  auth: {
    sessionTimeout: { type: Number, default: 3600000 },
    maxSessions: { type: Number, default: 5 }
  },
  prayerSettings: PrayerSettingsSchema,
  updatedAt: { type: Date, default: Date.now }
});

// Create model
const Config = mongoose.model('Config', ConfigSchema);

export default Config;
