const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const prayerTimeService = require('./prayerTimeService');
const { calculateIqamah } = require('../utils/calculations');

const getAutomationStatus = async (config) => {
    const timezone = config.location.timezone;
    const now = DateTime.now().setZone(timezone);
    const triggers = config.automation.triggers;
    const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    // We need today's prayer times to calculate accurate trigger times
    // Assuming caching is handled by prayerTimeService layers
    let prayerData;
    try {
        prayerData = await prayerTimeService.getPrayerTimes(config, now);
    } catch (e) {
        console.error('[Diagnostics] Failed to fetch prayer times for status check:', e);
        return {}; 
    }

    const result = {};

    for (const prayer of prayerNames) {
        result[prayer] = {};
        const prayerTriggers = triggers[prayer] || {};
        const startISO = prayerData.prayers[prayer];

        if (!startISO) {
            result[prayer].error = 'No time data';
            continue;
        }

        const start = DateTime.fromISO(startISO).setZone(timezone);

        // Determine Iqamah (Same logic as Scheduler)
        let iqamah = null;
        const prayerConfig = config.prayers[prayer];
        const isOverride = prayerConfig?.iqamahOverride === true;
        
        if (!isOverride && prayerData.prayers.iqamah && prayerData.prayers.iqamah[prayer]) {
            iqamah = DateTime.fromISO(prayerData.prayers.iqamah[prayer]).setZone(timezone);
        } else if (prayerConfig) {
             const calculatedIso = calculateIqamah(startISO, prayerConfig, timezone);
             iqamah = DateTime.fromISO(calculatedIso).setZone(timezone);
        }

        // Helper to determine status
        const getStatus = (enabled, time) => {
            if (!enabled) return { status: 'DISABLED' };
            if (!time) return { status: 'ERROR', error: 'Time calculation failed' };
            
            if (time < now) {
                return { status: 'PASSED', time: time.toISO() };
            } else {
                return { status: 'UPCOMING', time: time.toISO() };
            }
        };

        // 1. Adhan
        result[prayer].adhan = getStatus(prayerTriggers.adhan?.enabled, start);

        // 2. Pre-Adhan
        const preAdhanOffset = prayerTriggers.preAdhan?.offsetMinutes || 0;
        result[prayer].preAdhan = getStatus(prayerTriggers.preAdhan?.enabled, start.minus({ minutes: preAdhanOffset }));

        // 3. Iqamah
        result[prayer].iqamah = getStatus(prayerTriggers.iqamah?.enabled, iqamah);

        // 4. Pre-Iqamah
        const preIqamahOffset = prayerTriggers.preIqamah?.offsetMinutes || 0;
        result[prayer].preIqamah = getStatus(prayerTriggers.preIqamah?.enabled, iqamah ? iqamah.minus({ minutes: preIqamahOffset }) : null);
    }

    return result;
};

const getTTSStatus = async (config) => {
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const events = ['preAdhan', 'adhan', 'preIqamah', 'iqamah'];
    const result = {};

    const cacheDir = path.join(process.cwd(), 'public', 'audio', 'cache');

    for (const prayer of prayers) {
        result[prayer] = {};
        const prayerTriggers = config.automation.triggers[prayer] || {};

        for (const event of events) {
            const triggerConfig = prayerTriggers[event];
            
            // Check if automation is enabled at all
            if (!triggerConfig || !triggerConfig.enabled) {
                result[prayer][event] = { status: 'DISABLED' };
                continue;
            }

            const audioType = triggerConfig.type || 'file'; // Default to file if undefined

            if (audioType === 'url') {
                result[prayer][event] = { status: 'URL', detail: triggerConfig.url };
            } 
            else if (audioType === 'file') {
                 // Custom file logic
                 const filename = triggerConfig.path ? path.basename(triggerConfig.path) : 'Unknown';
                 result[prayer][event] = { status: 'CUSTOM_FILE', detail: filename };
            } 
            else if (audioType === 'tts') {
                 // TTS Logic
                 const expectedFilename = `tts_${prayer}_${event}.mp3`;
                 const filePath = path.join(cacheDir, expectedFilename);
                 const metaPath = filePath + '.json';
                 
                 if (fs.existsSync(filePath) && fs.existsSync(metaPath)) {
                     try {
                         const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                         result[prayer][event] = { 
                             status: 'GENERATED', 
                             detail: meta.generatedAt // Passing as detail for frontend
                         };
                     } catch (e) {
                         result[prayer][event] = { status: 'ERROR', detail: 'Corrupt Meta' };
                     }
                 } else {
                     result[prayer][event] = { status: 'MISSING' };
                 }
            }
            else {
                 result[prayer][event] = { status: 'UNKNOWN' };
            }
        }
    }
    return result;
};

module.exports = {
    getAutomationStatus,
    getTTSStatus
};
