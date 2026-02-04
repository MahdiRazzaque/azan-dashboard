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
 * Calculates the maximum lead time among all enabled targets for a specific prayer event.
 * 
 * @param {Object} config - The system configuration.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event (e.g., adhan, preAdhan).
 * @returns {number} The maximum lead time in milliseconds.
 */
const getMaxLeadTime = (config, prayer, event) => {
    const triggerSettings = config.automation?.triggers?.[prayer]?.[event];
    if (!triggerSettings || !triggerSettings.enabled) {
        return 0;
    }

    const configuredTargets = triggerSettings.targets || [];
    const targets = new Set([...configuredTargets, 'browser']);

    let maxLead = 0;
    targets.forEach(targetId => {
        const outputConfig = config.automation?.outputs?.[targetId];
        // 'browser' is implicitly enabled if not explicitly disabled
        const isEnabled = targetId === 'browser' ? (outputConfig?.enabled !== false) : outputConfig?.enabled;
        
        if (isEnabled) {
            const leadTime = outputConfig?.leadTimeMs || 0;
            if (leadTime > maxLead) {
                maxLead = leadTime;
            }
        }
    });

    return maxLead;
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

    // Adjust for Maximum Lead Time (Staggered Launch)
    const maxLeadTime = getMaxLeadTime(config, prayer, event);
    const adjustedDate = date.minus({ milliseconds: maxLeadTime });

    const now = DateTime.now();
    const diffSeconds = now.diff(adjustedDate, 'seconds').seconds;

    // Safety buffer: If adjusted time is in the past
    if (adjustedDate < now) {
        // [REQ-005] Execute missed events if they were scheduled within the last 60 seconds
        if (diffSeconds <= 60) {
            console.warn(`[Scheduler] Missed ${prayer} ${event} by ${diffSeconds.toFixed(1)}s, executing catch-up.`);
            automationService.triggerEvent(prayer, event);
        } else {
            console.warn(`[Scheduler] Adjusted time for ${prayer} ${event} is in the past (${adjustedDate.toFormat('HH:mm:ss')}), skipping.`);
        }
        return;
    }

    const job = schedule.scheduleJob(adjustedDate.toJSDate(), () => {
        automationService.triggerEvent(prayer, event);
    });

    if (job) {
        job.jobName = `${prayer} - ${event}`;
        job.category = 'automation';
        jobs.push(job);
        console.log(`[Scheduler] Scheduled ${prayer} ${event} at ${adjustedDate.toFormat('HH:mm:ss')} (Original: ${date.toFormat('HH:mm:ss')}, Lead: ${maxLeadTime}ms)`);
    }
};

/**
 * Schedules recurring system maintenance jobs.
 * Includes tasks for stale data checks, year boundary handling, system health monitoring, and audio asset maintenance.
 * 
 * @returns {void}
 */
const scheduleMaintenanceJobs = () => {
    /**
     * Checks if the cached prayer time data is stale and refreshes it if necessary.
     *
     * @returns {Promise<void>}
     */
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

    /**
     * Checks if the current date is approaching the end of the year and fetches data for the next year if required.
     *
     * @returns {Promise<void>}
     */
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

    /**
     * Executes a comprehensive system health check.
     *
     * @returns {Promise<void>}
     */
    const healthAction = async () => {
        try {
            console.log('[Maintenance] Running Daily Health Check...');
            await healthCheck.runDailyMaintenance();
        } catch (e) {
            console.error('[Maintenance] Health Check Failed:', e);
            throw e;
        }
    };

    /**
     * Synchronises and maintains audio assets.
     *
     * @returns {Promise<void>}
     */
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

    /**
     * Checks the health of both primary and backup prayer time data sources.
     *
     * @returns {Promise<void>}
     */
    const sourceAction = async () => {
        try {
            console.log('[Maintenance] Running Source Health Check...');
            await healthCheck.refresh('primarySource');
            await healthCheck.refresh('backupSource');
        } catch (e) {
            console.error('[Maintenance] Source Health Check Failed:', e);
            throw e;
        }
    };

    /**
     * Reloads the configuration and re-initialises the scheduler at midnight.
     *
     * @returns {Promise<void>}
     */
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
    maintenanceCallbacks[jobConstants.JOB_MIDNRESH] = midnightAction;

    /**
     * A higher-order function that wraps a maintenance action.
     * Ensures any errors are caught and logged without disrupting the regular scheduler flow.
     *
     * @param {Function} action - The async maintenance function to wrap.
     * @returns {Function} An async function that executes the action within a try-catch block.
     */
    const schedulerWrap = (action) => async () => {
        try { 
            await action(); 
        } catch { 
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

    const healthJob = schedule.scheduleJob(jobConstants.JOB_HEALTH_CHECK, '0 0 * * *', schedulerWrap(healthAction));
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
 * @returns {Promise<{success: boolean, message: string}>} A promise that resolves to an object indicating the success or failure of the job execution.
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
