const schedule = require('node-schedule');
const { DateTime } = require('luxon');
const config = require('../config');
const prayerTimeService = require('./prayerTimeService');
const audioAssetService = require('./audioAssetService');
const automationService = require('./automationService');
const { calculateIqamah } = require('../utils/calculations');

let jobs = [];

const clearJobs = () => {
    jobs.forEach(j => {
        if (j) j.cancel();
    });
    jobs = [];
    console.log('[Scheduler] All jobs cleared.');
};

const scheduleEvent = (date, prayer, event) => {
    // Safety buffer: If time is in the past, don't schedule
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

const scheduleMaintenanceJobs = () => {
    // 1. Stale Check - Run Weekly (Sunday 03:00)
    const staleJob = schedule.scheduleJob('0 3 * * 0', async () => {
        try {
            console.log('[Maintenance] Running Stale Check...');
            const cache = prayerTimeService.readCache();
            if (cache && cache.meta && cache.meta.lastFetched) {
                const lastFetched = DateTime.fromISO(cache.meta.lastFetched);
                const now = DateTime.now();
                const days = now.diff(lastFetched, 'days').days;
                const staleDays = (config.data && config.data.staleCheckDays) || 7;
                
                if (days > staleDays) {
                    console.log(`[Maintenance] Data stale (${days.toFixed(1)} days). Refreshing...`);
                    await prayerTimeService.forceRefresh(config);
                } else {
                    console.log(`[Maintenance] Data fresh (${days.toFixed(1)} days).`);
                }
            } else {
                console.log('[Maintenance] No cache meta found. Triggering fetch.');
                await prayerTimeService.getPrayerTimes(config);
            }
        } catch (e) {
            console.error('[Maintenance] Stale Check Failed:', e);
        }
    });
    if (staleJob) jobs.push(staleJob);

    // 2. Year Boundary - Run Daily (04:00)
    const boundaryJob = schedule.scheduleJob('0 4 * * *', async () => {
        try {
            const now = DateTime.now();
            const year = now.year;
            // Check if within 7 days of end of year
            const endOfYear = DateTime.fromObject({ year, month: 12, day: 31 });
            const diff = endOfYear.diff(now, 'days').days;
            
            if (diff >= 0 && diff <= 7) {
                // Check if next year exists
                const nextYear = year + 1;
                const nextJan1 = DateTime.fromObject({ year: nextYear, month: 1, day: 1 });
                const cache = prayerTimeService.readCache();
                const nextKey = nextJan1.toISODate();
                
                if (!cache.data || !cache.data[nextKey]) {
                    console.log(`[Maintenance] Approaching end of year. Fetching ${nextYear}...`);
                    await prayerTimeService.getPrayerTimes(config, nextJan1);
                }
            }
        } catch (e) {
             console.error('[Maintenance] Year Boundary Check Failed:', e);
        }
    });
    if (boundaryJob) jobs.push(boundaryJob);
};

const initScheduler = async () => {
    try {
        console.log('[Scheduler] Initializing...');
        
        // Cancel existing jobs (Hot Reload scenario)
        clearJobs();
        
        // Schedule Maintenance
        scheduleMaintenanceJobs();

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

        // Prepare Audio Assets
        try {
            await audioAssetService.prepareDailyAssets();
        } catch (err) {
            console.error('[Scheduler] Audio asset prep failed:', err.message);
        }

        const triggers = config.automation.triggers;
        if (!triggers) return;

        // Schedule jobs
        const prayerNames = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
        
        for (const prayer of prayerNames) {
             const triggersForPrayer = triggers[prayer];
             if (!triggersForPrayer) continue;
            
             // Handle raw data structure (string) vs Object
             const startISO = prayerData.prayers[prayer];
             
             if (!startISO) {
                 console.warn(`[Scheduler] No time found for ${prayer}, skipping.`);
                 continue;
             }
             
             const start = DateTime.fromISO(startISO).setZone(config.location.timezone);
             
             // Determine Iqamah
             let iqamah = null;
             
             // 1. Explicit Iqamah from Source
             if (prayerData.prayers.iqamah && prayerData.prayers.iqamah[prayer]) {
                 iqamah = DateTime.fromISO(prayerData.prayers.iqamah[prayer]).setZone(config.location.timezone);
             } 
             // 2. Calculated (Fallback)
             else if (config.prayers[prayer]) {
                 const calculatedIso = calculateIqamah(startISO, config.prayers[prayer], config.location.timezone);
                 iqamah = DateTime.fromISO(calculatedIso).setZone(config.location.timezone);
             }

             // 1. Adhan
             if (triggersForPrayer.adhan?.enabled) {
                 scheduleEvent(start, prayer, 'adhan');
             }

             // 2. Pre-Adhan
             if (triggersForPrayer.preAdhan?.enabled) {
                 const offset = triggersForPrayer.preAdhan.offsetMinutes || 0;
                 scheduleEvent(start.minus({ minutes: offset }), prayer, 'preAdhan');
             }

             if (iqamah) {
                 // 3. Iqamah
                 if (triggersForPrayer.iqamah?.enabled) {
                     scheduleEvent(iqamah, prayer, 'iqamah');
                 }

                 // 4. Pre-Iqamah
                 if (triggersForPrayer.preIqamah?.enabled) {
                     const offset = triggersForPrayer.preIqamah.offsetMinutes || 0;
                     scheduleEvent(iqamah.minus({ minutes: offset }), prayer, 'preIqamah');
                 }
             }
        }
        
        console.log(`[Scheduler] Initialisation complete. ${jobs.length} jobs scheduled.`);

    } catch (error) {
        console.error('[Scheduler] Initialisation failed:', error);
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
