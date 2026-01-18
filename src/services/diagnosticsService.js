const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const prayerTimeService = require('./prayerTimeService');
const { calculateIqamah } = require('../utils/calculations');

const getAutomationStatus = async (config) => {
    const timezone = config.location.timezone;
    const now = DateTime.now().setZone(timezone);
    const triggers = config.automation.triggers;
    const prayerNames = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
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
        const getStatus = (triggerConfig, time) => {
            const enabled = triggerConfig?.enabled;
            if (!enabled) return { status: 'DISABLED' };
            if (!time) return { status: 'ERROR', error: 'Time calculation failed' };
            
            // Extract Details for Hover
            const type = triggerConfig.type || 'file';
            let source = 'Unknown';
            if (type === 'file') source = triggerConfig.path ? path.basename(triggerConfig.path) : 'No File';
            else if (type === 'url') source = triggerConfig.url || 'No URL';
            else if (type === 'tts') source = triggerConfig.template ? `"${triggerConfig.template.substring(0, 30)}${triggerConfig.template.length > 30 ? '...' : ''}"` : 'No Template';

            const targets = triggerConfig.targets || [];

            const details = {
                type,
                source,
                targets: targets.join(', ')
            };

            if (time < now) {
                return { status: 'PASSED', time: time.toISO(), details };
            } else {
                return { status: 'UPCOMING', time: time.toISO(), details };
            }
        };

        // 1. Adhan
        result[prayer].adhan = getStatus(prayerTriggers.adhan, start);

        // 2. Pre-Adhan
        const preAdhanOffset = prayerTriggers.preAdhan?.offsetMinutes || 0;
        result[prayer].preAdhan = getStatus(prayerTriggers.preAdhan, start.minus({ minutes: preAdhanOffset }));

        // 3 & 4. Iqamah events (skip for sunrise)
        if (prayer !== 'sunrise') {
            result[prayer].iqamah = getStatus(prayerTriggers.iqamah, iqamah);

            // 4. Pre-Iqamah
            const preIqamahOffset = prayerTriggers.preIqamah?.offsetMinutes || 0;
            result[prayer].preIqamah = getStatus(prayerTriggers.preIqamah, iqamah ? iqamah.minus({ minutes: preIqamahOffset }) : null);
        }
    }

    return result;
};

const { resolveTemplate } = require('./audioAssetService');

const getTTSStatus = async (config) => {
    const prayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const result = {};

    const cacheDir = path.join(process.cwd(), 'public', 'audio', 'cache');

    for (const prayer of prayers) {
        result[prayer] = {};
        const prayerTriggers = config.automation.triggers[prayer] || {};
        
        const events = prayer === 'sunrise' ? ['preAdhan', 'adhan'] : ['preAdhan', 'adhan', 'preIqamah', 'iqamah'];

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
                         
                         // Expectation Check
                         const expectedText = resolveTemplate(triggerConfig.template, prayer, triggerConfig.offsetMinutes);
                         
                         if (meta.text === expectedText) {
                             result[prayer][event] = { 
                                 status: 'GENERATED', 
                                 detail: meta.generatedAt 
                             };
                         } else {
                             result[prayer][event] = { 
                                 status: 'MISMATCH', 
                                 detail: 'Template changed'
                             };
                         }

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
