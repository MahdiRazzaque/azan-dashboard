const schedule = require('node-schedule');
const { DateTime } = require('luxon');
const config = require('../config');
const prayerTimeService = require('./prayerTimeService');
const audioAssetService = require('./audioAssetService');
const automationService = require('./automationService');

let jobs = [];

const clearJobs = () => {
    jobs.forEach(j => {
        if (j) j.cancel();
    });
    jobs = [];
    // console.log('[Scheduler] All jobs cleared.');
};

const scheduleEvent = (date, prayer, event) => {
    // Safety buffer: If time is in the past, don't schedule
    // Using a small buffer (e.g., 2 seconds) to handle "now" execution edge cases if needed, 
    // but usually we want strict future scheduling.
    if (date < DateTime.now()) {
        return;
    }

    const job = schedule.scheduleJob(date.toJSDate(), () => {
        automationService.triggerEvent(prayer, event);
    });

    if (job) {
        jobs.push(job);
        console.log(`[Scheduler] Scheduled ${prayer} ${event} at ${date.toFormat('HH:mm:ss')}`);
    }
};

const initScheduler = async () => {
    try {
        console.log('[Scheduler] Initializing...');
        
        // Cancel existing jobs (Hot Reload scenario)
        clearJobs();
        
        // Schedule Midnight Refresh
        // Recurrence rule: 0 0 * * * (Midnight)
        const midnightJob = schedule.scheduleJob('0 0 * * *', () => {
            console.log('[Scheduler] Midnight Refresh');
            initScheduler();
        });
        jobs.push(midnightJob);
        
        // Prepare data for today
        const now = DateTime.now().setZone(config.location.timezone);
        const prayerData = await prayerTimeService.getPrayerTimes(config, now);
        
        if (!prayerData || !prayerData.prayers) {
            console.error('[Scheduler] Failed to fetch prayer times.');
            return;
        }

        // Prepare Audio Assets (Task 4 integration)
        try {
            await audioAssetService.prepareDailyAssets();
        } catch (err) {
            console.error('[Scheduler] Audio asset prep failed:', err.message);
            // Continue scheduling anyway, maybe assets exist
        }

        const triggers = config.automation.triggers;
        if (!triggers) return;

        // Schedule jobs
        for (const prayer of Object.keys(prayerData.prayers)) {
             // prayerData.prayers has fajr, sunrise, dhuhr... 
             // config.triggers only has fajr, dhuhr, asr, maghrib, isha.
             // We check if config has this prayer.
             if (!triggers[prayer]) continue;

             const times = prayerData.prayers[prayer];
             const start = DateTime.fromISO(times.start).setZone(config.location.timezone);
             // Iqamah might be null if not calculated? But schema guarantees calculation settings.
             // However, `calculateIqamah` should verify validity.
             const iqamah = times.iqamah ? DateTime.fromISO(times.iqamah).setZone(config.location.timezone) : null;
             
             // 1. Adhan
             if (triggers[prayer].adhan?.enabled) {
                 scheduleEvent(start, prayer, 'adhan');
             }

             // 2. Pre-Adhan
             if (triggers[prayer].preAdhan?.enabled) {
                 const offset = triggers[prayer].preAdhan.offsetMinutes || 0;
                 scheduleEvent(start.minus({ minutes: offset }), prayer, 'preAdhan');
             }

             if (iqamah) {
                 // 3. Iqamah
                 if (triggers[prayer].iqamah?.enabled) {
                     scheduleEvent(iqamah, prayer, 'iqamah');
                 }

                 // 4. Pre-Iqamah
                 if (triggers[prayer].preIqamah?.enabled) {
                     const offset = triggers[prayer].preIqamah.offsetMinutes || 0;
                     scheduleEvent(iqamah.minus({ minutes: offset }), prayer, 'preIqamah');
                 }
             }
        }
        
        console.log(`[Scheduler] Initialization complete. ${jobs.length - 1} prayer jobs scheduled.`);

    } catch (error) {
        console.error('[Scheduler] Initialization failed:', error);
    }
};

const hotReload = () => {
    console.log('[Scheduler] Hot Reloading...');
    return initScheduler();
};

module.exports = {
    initScheduler,
    hotReload
};
