import moment from 'moment-timezone';
import schedule from 'node-schedule';
import fetch from 'node-fetch';
import { getCurrentTime, logSection, getTestMode } from '../utils/utils.js';
import { updatePrayerTimes } from '../prayer/prayer-times.js';
import { getPrayerSettings } from '../prayer/prayer-settings.js';
import { getFeatureStates } from '../features/feature-manager.js';

// Schedule management
const activeSchedules = new Map();
const lastExecutionTimes = new Map();
const DEBOUNCE_INTERVAL = 60000; // 1 minute in milliseconds
const ANNOUNCEMENT_TIME_BEFORE = 15; // Fixed 15 minutes before prayer time

const voiceMonkeyConfig = {
    url: 'https://api-v2.voicemonkey.io/announcement',
    baseAudioUrl: 'https://la-ilaha-illa-allah.netlify.app/mp3/',
    token: process.env.VOICEMONKEY_TOKEN,
    device: 'voice-monkey-speaker-1'
};

// Clear existing schedules
function clearExistingSchedules() {
    for (const [name, job] of activeSchedules.entries()) {
        job.cancel();
        console.log(`🗑️ Cleared schedule for ${name}`);
    }
    activeSchedules.clear();
}

// Check if action can be executed (debouncing)
function canExecute(actionName) {
    const lastExecution = lastExecutionTimes.get(actionName);
    const now = Date.now();
    
    if (!lastExecution || (now - lastExecution) > DEBOUNCE_INTERVAL) {
        lastExecutionTimes.set(actionName, now);
        return true;
    }
    console.log(`⏳ Skipping ${actionName} - too soon after last execution`);
    return false;
}

// Main scheduling function
async function scheduleNamazTimers() {
    clearExistingSchedules();
    
    try {
        const prayerData = await updatePrayerTimes();
        if (!prayerData) {
            console.warn("⚠️ No prayer data available. This is expected during initial setup.");
            return;
        }
        
        const { startTimes, iqamahTimes } = prayerData;
        const prayerSettings = await getPrayerSettings();
        
        // Get fresh feature states
        const features = getFeatureStates();

        if (features.azanEnabled) {
            logSection("SCHEDULING PRAYER AZAN TIMES");
            for (const [prayerName] of Object.entries(startTimes)) {
                if (prayerName === 'sunrise') continue;
                
                const prayerConfig = prayerSettings.prayers[prayerName];
                if (!prayerConfig) continue;
                
                // Determine azan time based on prayer settings
                const azanTime = prayerConfig.azanAtIqamah ? iqamahTimes[prayerName] : startTimes[prayerName];
                
                const job = await scheduleAzanTimer(prayerName, azanTime);
                if (job) {
                    activeSchedules.set(`azan_${prayerName}`, job);
                }
            }
        } else {
            logSection("SCHEDULING PRAYER AZAN TIMES");
            console.log("⏸️ Azan timer is globally disabled");
        }

        if (features.announcementEnabled && features.azanEnabled) {
            // Schedule announcements only if azan is enabled
            logSection("SCHEDULING PRAYER ANNOUNCEMENTS");
            for (const [prayerName] of Object.entries(startTimes)) {
                if (prayerName === 'sunrise') continue;
                
                const prayerConfig = prayerSettings.prayers[prayerName];
                if (!prayerConfig) continue;
                
                const azanTime = prayerConfig.azanAtIqamah ? iqamahTimes[prayerName] : startTimes[prayerName];
                
                const job = await scheduleAnnouncementTimer(prayerName, azanTime);
                if (job) {
                    activeSchedules.set(`announcement_${prayerName}`, job);
                }
            }
        } else if (!features.azanEnabled && features.announcementEnabled) {
            logSection("SCHEDULING PRAYER ANNOUNCEMENTS");
            console.log("⏸️ Azan timer is globally disabled, skipping announcements");
        } else {
            logSection("SCHEDULING PRAYER ANNOUNCEMENTS");
            console.log("⏸️ Announcements are globally disabled");
        }

        // Schedule next day's update
        const nextDayJob = await scheduleNextDay();
        if (nextDayJob) {
            activeSchedules.set('next_day', nextDayJob);
        }

        console.info('✅ Prayer timers scheduled');
    } catch (error) {
        console.warn(`⚠️ Could not schedule prayer timers: ${error.message}`);
        console.warn("This is expected during initial setup.");
    }
}

// Schedule next day's update
async function scheduleNextDay() {
    logSection("Next Day Scheduling");
    const nextMidnight = moment.tz('Europe/London').add(1, 'day').startOf('day').add(2, 'hour');
    console.log(`📅 Next Update: ${nextMidnight.format('HH:mm:ss DD-MM-YYYY')}`);
    
    return schedule.scheduleJob(nextMidnight.toDate(), async() => {
        if (!canExecute('next_day_update')) return;
        console.log("🔄 Fetching next day's namaz timings.");
        await scheduleNamazTimers();
    });
}

// Schedule azan for a prayer
async function scheduleAzanTimer(prayerName, time) {
    try {    
        const prayerSettings = await getPrayerSettings();
        const prayerConfig = prayerSettings.prayers[prayerName];
        
        // Skip if this prayer's azan is disabled
        if (!prayerConfig.azanEnabled) {
            console.log(`⏭️ Azan for ${prayerName.toUpperCase()} is disabled in settings.`);
            return null;
        }

        const scheduledTime = moment.tz(time, 'HH:mm', 'Europe/London');

        if (scheduledTime.isBefore(getCurrentTime())) {
            console.log(`⏩ ${prayerName.toUpperCase()} prayer time has already passed.`);
            return null;
        }

        console.log(`🕰️ Scheduling ${prayerName.toUpperCase()} prayer at ${time}`);
        return schedule.scheduleJob(scheduledTime.toDate(), async () => {
            if (!canExecute(`azan_${prayerName}`)) return;
            console.log(`${prayerName.toUpperCase()} prayer time.`);
            try {
                await playAzan(prayerName === 'fajr');
            } catch (error) {
                console.error(`❌ Error playing azan for ${prayerName}:`, error);
            }
        });
    } catch (error) {
        console.error(`❌ Error scheduling azan for ${prayerName}:`, error);
        return null;
    }
}

// Schedule announcement for a prayer
async function scheduleAnnouncementTimer(prayerName, time) {
    try {     
        const prayerSettings = await getPrayerSettings();
        const prayerConfig = prayerSettings.prayers[prayerName];
        
        // Skip if this prayer's azan is disabled (announcement depends on azan)
        if (!prayerConfig.azanEnabled) {
            console.log(`⏭️ Announcement for ${prayerName.toUpperCase()} is skipped because its Azan is disabled.`);
            return null;
        }
        
        // Skip if this prayer's announcement is disabled
        if (!prayerConfig.announcementEnabled) {
            console.log(`⏭️ Announcement for ${prayerName.toUpperCase()} is disabled in settings.`);
            return null;
        }
        
        // Calculate the announcement time (fixed at 15 minutes before prayer)
        const announcementTime = moment.tz(time, 'HH:mm', 'Europe/London')
            .subtract(ANNOUNCEMENT_TIME_BEFORE, 'minutes')
            .format('HH:mm');
        
        const scheduledTime = moment.tz(announcementTime, 'HH:mm', 'Europe/London');

        if (scheduledTime.isBefore(getCurrentTime())) {
            console.log(`⏩ ${prayerName.toUpperCase()} prayer announcement time has already passed.`);
            return null;
        }

        console.log(`📢 Scheduling ${prayerName.toUpperCase()} announcement at ${announcementTime}`);
        return schedule.scheduleJob(scheduledTime.toDate(), async () => {
            if (!canExecute(`announcement_${prayerName}`)) return;
            
            // Check again at execution time if features are still enabled
            const currentFeatures = getFeatureStates();
            if (!currentFeatures.azanEnabled || !currentFeatures.announcementEnabled) {
                console.log(`⏸️ Azan or Announcement feature is now disabled, skipping ${prayerName.toUpperCase()} announcement playback`);
                return;
            }
            
            // Also check if prayer-specific azan setting is still enabled
            const currentSettings = await getPrayerSettings();
            if (!currentSettings.prayers[prayerName].azanEnabled) {
                console.log(`⏭️ ${prayerName.toUpperCase()} Azan is now disabled, skipping announcement playback`);
                return;
            }
            
            console.log(`📢 ${prayerName.toUpperCase()} announcement time.`);
            try {
                await playPrayerAnnouncement(prayerName);
            } catch (error) {
                console.error(`❌ Error playing announcement for ${prayerName}:`, error);
            }
        });
    } catch (error) {
        console.error(`❌ Error scheduling announcement for ${prayerName}:`, error);
        return null;
    }
}


/**
 * A reusable function to play an audio file through Voice Monkey.
 * @param {string} audioFileName - The name of the audio file to play (e.g., "azan.mp3").
 * @param {string} successLogMessage - The message to log on successful playback.
 */
async function playAudio(audioFileName, successLogMessage) {
    if (!voiceMonkeyConfig.token) {
        console.error("Error: Voice Monkey API token is missing!");
        return;
    }

    // Log which audio file is being played
    console.log(`▶️ Attempting to play audio file: ${audioFileName}`);

    const payload = {
        token: voiceMonkeyConfig.token,
        device: voiceMonkeyConfig.device,
        audio: `${voiceMonkeyConfig.baseAudioUrl}${audioFileName}`
    };

    try {
        const response = await fetch(voiceMonkeyConfig.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // Optional: Process the response if needed
        try {
            const text = await response.text();
            const data = text ? JSON.parse(text) : {};
            //console.log(`${successLogMessage} ${JSON.stringify(data, null, 2)}`);
            console.log(`${successLogMessage}`);
        } catch (parseError) {
            console.error("Error parsing JSON response:", parseError, "Response text:", await response.text());
        }

    } catch (error) {
        console.error('Error triggering audio playback:', error);
    }
}

/**
 * Plays the Azan through Voice Monkey.
 * @param {boolean} fajr - Whether to play the Fajr Azan.
 */
async function playAzan(fajr = false) {
    if (getTestMode()) {
        console.log("🧪 TEST MODE: Azan playback skipped");
        return;
    }

    // Check current feature status before playing
    const features = getFeatureStates();
    if (!features.azanEnabled) {
        console.log("⏸️ Azan feature disabled");
        return;
    }

    const audioFileName = fajr ? "fajr-azan.mp3" : "azan.mp3";
    playAudio(audioFileName, 'Azan triggered successfully:');
}

/**
 * Plays a prayer announcement through Voice Monkey.
 * @param {string} prayerName - The name of the prayer.
 */
async function playPrayerAnnouncement(prayerName) {
    if (getTestMode()) {
        console.log("🧪 TEST MODE: Announcement playback skipped");
        return;
    }

    // Check current feature status before playing
    const features = getFeatureStates();
    if (!features.announcementEnabled) {
        console.log("⏸️ Announcement feature disabled");
        return;
    }

    const prayerToAnnouncementFile = {
        fajr: 't-minus-15-fajr.mp3',
        zuhr: 't-minus-15-dhuhr.mp3',
        asr: 't-minus-15-asr.mp3',
        maghrib: 't-minus-15-maghrib.mp3',
        isha: 't-minus-15-isha.mp3',
    };

    const audioFileName = prayerToAnnouncementFile[prayerName];
    if (audioFileName) {
        playAudio(audioFileName, 'Prayer announcement triggered successfully:');
    } else {
        console.error(`Error: No announcement file found for prayer "${prayerName}"`);
    }
}

export {
    scheduleNamazTimers,
    clearExistingSchedules
};