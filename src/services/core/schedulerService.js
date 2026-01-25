const schedule = require('node-schedule');
const { DateTime } = require('luxon');
const configService = require('@config'); // Singleton
const prayerTimeService = require('@services/core/prayerTimeService');

const automationService = require('@services/core/automationService');
const { calculateIqamah } = require('@utils/calculations');
const healthCheck = require('@services/system/healthCheck');
const jobConstants = require('@utils/jobConstants');

let jobs = [];
// Store maintenance callbacks for manual execution
const maintenanceCallbacks = {};

/**
 * Clears all currently scheduled jobs.
 * This ensures no duplicate triggers or stale jobs remain in memory.
 * 
 * @returns {void}
 */
const clearJobs = () => {
    jobs.forEach(j => {
        if (j) j.cancel();
    });
    jobs = [];
    console.log('[Scheduler] All jobs cleared.');
};

/**
 * Schedules a single automation event for a specific prayer and time.
 * Validates global automation switches and ensures events are only scheduled for the future.
 * 
 * @param {import('luxon').DateTime} date - The date and time to trigger the event.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event (e.g., adhan, iqamah).
 * @returns {void}
 */
const scheduleEvent = (date, prayer, event) => {
    const config = configService.get();
    // Check Global Switches
    if (config.automation?.global) {
        if (config.automation.global.enabled === false) {
            return;
        }

        const eventTypeMap = {
            'preAdhan': 'preAdhanEnabled',
            'adhan': 'adhanEnabled',
            'preIqamah': 'preIqamahEnabled',
            'iqamah': 'iqamahEnabled'
        };

        const switchKey = eventTypeMap[event];
        if (switchKey && config.automation.global[switchKey] === false) {
             console.log(`[Scheduler] Skipped ${prayer} ${event} (Global Switch OFF)`);
             return;
        }
    }

    // Safety buffer: If time is in the past, don't schedule
    if (date < DateTime.now()) {
        return;
    }

    const job = schedule.scheduleJob(date.toJSDate(), () => {
        automationService.triggerEvent(prayer, event);
    });

    if (job) {
        job.jobName = `${prayer} - ${event}`;
        job.category = 'automation';
        jobs.push(job);
        console.log(`[Scheduler] Scheduled ${prayer} ${event} at ${date.toFormat('HH:mm:ss')}`);
    }
};

/**
 * Schedules recurring system maintenance jobs.
 * Includes tasks for stale data checks, year boundary handling, system health monitoring, and audio asset maintenance.
 * 
 * @returns {void}
 */
/**
 * Schedules recurring system maintenance jobs.
 * Includes tasks for stale data checks, year boundary handling, system health monitoring, and audio asset maintenance.
 * 
 * @returns {void}
 */
const scheduleMaintenanceJobs = () => {
    // 1. Stale Check
    const staleAction = async () => {
        const config = configService.get();
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
            throw e;
        }
    };

    // 2. Year Boundary
    const boundaryAction = async () => {
        const config = configService.get();
        try {
            const now = DateTime.now();
            const year = now.year;
            const endOfYear = DateTime.fromObject({ year, month: 12, day: 31 });
            const diff = endOfYear.diff(now, 'days').days;
            
            if (diff >= 0 && diff <= 7) {
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
             throw e;
        }
    };

    // 3. System Health Check
    const healthAction = async () => {
        try {
            console.log('[Maintenance] Running Daily Health Check...');
            await healthCheck.refresh('all', 'silent');
        } catch (e) {
            console.error('[Maintenance] Health Check Failed:', e);
            throw e;
        }
    };

    // 4. Audio Asset Maintenance
    const assetAction = async () => {
        console.log('[Maintenance] Running Audio Asset Maintenance...');
        const audioAssetService = require('@services/system/audioAssetService');
        try {
            await audioAssetService.syncAudioAssets(false); 
        } catch (e) {
            console.error('[Maintenance] Audio Asset Maintenance Failed:', e.message);
            throw e;
        }
    };

    // 5. Prayer Source Health Check
    const sourceAction = async () => {
        try {
            console.log('[Maintenance] Running Source Health Check...');
            await healthCheck.refresh('primarySource', 'silent');
            await healthCheck.refresh('backupSource', 'silent');
        } catch (e) {
            console.error('[Maintenance] Source Health Check Failed:', e);
            throw e;
        }
    };

    // 6. Midnight Refresh
    const midnightAction = async () => {
        console.log('[Scheduler] Midnight Refresh');
        await configService.reload();
        await initScheduler();
    };

    // Map actions for manual execution
    maintenanceCallbacks[jobConstants.JOB_STALE_CHECK] = staleAction;
    maintenanceCallbacks[jobConstants.JOB_YEAR_BOUNDARY] = boundaryAction;
    maintenanceCallbacks[jobConstants.JOB_HEALTH_CHECK] = healthAction;
    maintenanceCallbacks[jobConstants.JOB_AUDIO_ASSETS] = assetAction;
    maintenanceCallbacks[jobConstants.JOB_SOURCE_HEALTH] = sourceAction;
    maintenanceCallbacks[jobConstants.JOB_MIDNIGHT_REFRESH] = midnightAction;

    // Helper to wrap actions for the scheduler (swallows re-throws)
    const schedulerWrap = (action) => async () => {
        try { 
            await action(); 
        } catch (e) { 
            /* logged in action */ 
        }
    };

    // Schedule Jobs
    const staleJob = schedule.scheduleJob(jobConstants.JOB_STALE_CHECK, '0 3 * * 0', schedulerWrap(staleAction));
    if (staleJob) {
        staleJob.jobName = jobConstants.JOB_STALE_CHECK;
        staleJob.category = 'maintenance';
        jobs.push(staleJob);
    } 

    const boundaryJob = schedule.scheduleJob(jobConstants.JOB_YEAR_BOUNDARY, '0 4 * * *', schedulerWrap(boundaryAction));
    if (boundaryJob) {
        boundaryJob.jobName = jobConstants.JOB_YEAR_BOUNDARY;
        boundaryJob.category = 'maintenance';
        jobs.push(boundaryJob);
    }

    const healthJob = schedule.scheduleJob(jobConstants.JOB_HEALTH_CHECK, '30 2 * * *', schedulerWrap(healthAction));
    if (healthJob) {
        healthJob.jobName = jobConstants.JOB_HEALTH_CHECK;
        healthJob.category = 'maintenance';
        jobs.push(healthJob);
    }

    const assetMaintenanceJob = schedule.scheduleJob(jobConstants.JOB_AUDIO_ASSETS, '30 3 * * *', schedulerWrap(assetAction));
    if (assetMaintenanceJob) {
        assetMaintenanceJob.jobName = jobConstants.JOB_AUDIO_ASSETS;
        assetMaintenanceJob.category = 'maintenance';
        jobs.push(assetMaintenanceJob);
    }

    const sourceHealthJob = schedule.scheduleJob(jobConstants.JOB_SOURCE_HEALTH, '0 2 * * *', schedulerWrap(sourceAction));
    if (sourceHealthJob) {
        sourceHealthJob.jobName = jobConstants.JOB_SOURCE_HEALTH;
        sourceHealthJob.category = 'maintenance';
        jobs.push(sourceHealthJob);
    }

    const midnightJob = schedule.scheduleJob(jobConstants.JOB_MIDNIGHT_REFRESH, '0 0 * * *', schedulerWrap(midnightAction));
    if (midnightJob) {
        midnightJob.jobName = jobConstants.JOB_MIDNIGHT_REFRESH;
        midnightJob.category = 'maintenance';
        jobs.push(midnightJob);
    }
};

/**
 * Initialises the main scheduler.
 * Clears existing jobs, schedules maintenance tasks, and queues all prayer-related automation for the current day.
 * 
 * @returns {Promise<void>}
 */
const initScheduler = async () => {
    const config = configService.get();
    try {
        clearJobs();
        scheduleMaintenanceJobs();
        
        // Prepare data for today
        const now = DateTime.now().setZone(config.location.timezone);
        const prayerData = await prayerTimeService.getPrayerTimes(config, now);
        
        if (!prayerData || !prayerData.prayers) {
            console.error('[Scheduler] Failed to fetch prayer times.');
            return;
        }

        const triggers = config.automation.triggers;
        if (!triggers) return;

        // Schedule jobs
        const prayerNames = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
        
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
             if (prayer !== 'sunrise') {
                 const prayerConfig = config.prayers[prayer];
                 const isOverride = prayerConfig?.iqamahOverride === true;
                 
                 // 1. Explicit Iqamah from Source (Only if NOT overridden)
                 if (!isOverride && prayerData.prayers.iqamah && prayerData.prayers.iqamah[prayer]) {
                     iqamah = DateTime.fromISO(prayerData.prayers.iqamah[prayer]).setZone(config.location.timezone);
                 } 
                 // 2. Calculated (Fallback or Forced Override)
                 else if (prayerConfig) {
                     const calculatedIso = calculateIqamah(startISO, prayerConfig, config.location.timezone);
                     iqamah = DateTime.fromISO(calculatedIso).setZone(config.location.timezone);
                 }
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

             if (iqamah && prayer !== 'sunrise') {
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

/**
 * Retrieves a categorised list of all currently scheduled jobs.
 * 
 * @returns {Object} An object containing maintenance and automation jobs with their next invocation times.
 */
const getJobs = () => {
    /**
     * Internal helper to format a single job for reporting.
     * 
     * @param {Object} j - The node-schedule job object.
     * @returns {Object} A formatted job object with name, next invocation, and category.
     */
    const formatJob = (j) => {
        let next = null;
        try { 
            next = j.nextInvocation(); 
        } catch (e) {
            console.error(`[Scheduler] Error calculating next invocation for ${j.jobName}:`, e);
        }
        
        let nextISO = null;
        if (next) {
            try {
                // Handle CronDate (node-schedule v2+)
                if (typeof next.toDate === 'function') {
                    nextISO = DateTime.fromJSDate(next.toDate()).toISO();
                }
                // Handle standard JS Date
                else if (next instanceof Date) {
                    nextISO = DateTime.fromJSDate(next).toISO();
                } 
                // Handle Luxon DateTime
                else if (typeof next.toISO === 'function') {
                    nextISO = next.toISO();
                }
                // Fallback
                else {
                    nextISO = new Date(next).toISOString();
                }
            } catch (err) {
                 console.error(`[Scheduler] Date conversion failed for ${j.jobName}:`, err);
            }
        }

        return {
            name: j.jobName || 'Unknown Job',
            nextInvocation: nextISO,
            category: j.category || 'unknown'
        };
    };

    const maintenance = jobs.filter(j => j.category === 'maintenance').map(formatJob);
    const automation = jobs.filter(j => j.category === 'automation').map(formatJob);

    return { maintenance, automation };
};

/**
 * Performs a hot reload of the scheduler.
 * Re-initialises all jobs based on the latest configuration.
 * 
 * @returns {Promise<void>}
 */
const hotReload = () => {
    console.log('[Scheduler] Hot Reloading...');
    return initScheduler();
};

/**
 * Manually executes a maintenance job by name.
 * 
 * @param {string} jobName - The name of the job to run (from jobConstants).
 * @returns {Promise<{success: boolean, message: string}>}
 */
const runJob = async (jobName) => {
    const callback = maintenanceCallbacks[jobName];
    if (!callback) {
        return { success: false, message: `Job "${jobName}" not found.` };
    }

    try {
        console.log(`[Scheduler] Manually triggering job: ${jobName}`);
        await callback();
        return { success: true, message: `Job "${jobName}" executed successfully.` };
    } catch (error) {
        console.error(`[Scheduler] Manual execution of "${jobName}" failed:`, error);
        return { success: false, message: error.message || 'Job execution failed.' };
    }
};

module.exports = {
    initScheduler,
    hotReload,
    getJobs,
    runJob,
    stopAll: clearJobs
};
