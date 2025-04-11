import moment from 'moment-timezone';
import schedule from 'node-schedule';
import fetch from 'node-fetch';
import { getCurrentTime, logSection, TEST_MODE } from '../utils/utils.js';
import { updatePrayerTimes } from '../prayer/prayer-times.js';
import { getPrayerSettings } from '../prayer/prayer-settings.js';
import { getFeatureStates } from '../features/feature-manager.js';
import { getConfig } from '../config/config-service.js';

// Schedule management
const activeSchedules = new Map();
const lastExecutionTimes = new Map();
const DEBOUNCE_INTERVAL = 60000; // 1 minute in milliseconds
const ANNOUNCEMENT_TIME_BEFORE = 15; // Fixed 15 minutes before prayer time

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
    
    const prayerData = await updatePrayerTimes();
    if (!prayerData) return;
    
    const { startTimes, iqamahTimes } = prayerData;
    const prayerSettings = await getPrayerSettings();
    
    // Get fresh feature states
    const features = getFeatureStates();

    if (features.azanEnabled) {
        logSection("Scheduling Prayer Azan Times");
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
        logSection("Scheduling Prayer Azan Times");
        console.log("⏸️ Azan timer is globally disabled");
    }

    if (features.announcementEnabled && features.azanEnabled) {
        // Schedule announcements only if azan is enabled
        logSection("Scheduling Prayer Announcements");
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
        logSection("Scheduling Prayer Announcements");
        console.log("⏸️ Azan timer is globally disabled, skipping announcements");
    } else {
        logSection("Scheduling Prayer Announcements");
        console.log("⏸️ Announcements are globally disabled");
    }

    // Schedule next day's update
    const nextDayJob = await scheduleNextDay();
    if (nextDayJob) {
        activeSchedules.set('next_day', nextDayJob);
    }

    console.info('✅ Prayer timers scheduled');
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

// Play azan through Voice Monkey
async function playAzan(fajr = false) {
    if(TEST_MODE) {
        console.log("🧪 TEST MODE: Azan playback skipped");
        return;
    }

    // Check current feature status before playing
    const features = getFeatureStates();
    if (!features.azanEnabled) {
        return console.log("⏸️ Azan feature disabled");
    }
        
    const url = 'https://api-v2.voicemonkey.io/announcement';
    const baseAudioUrl = 'https://la-ilaha-illa-allah.netlify.app';
    
    const voice_monkey_token = process.env.VOICEMONKEY_TOKEN;
    
    if (!voice_monkey_token) {
        console.error("Error: Voice Monkey API token is missing!");
        return;
    }

    const audioName = fajr ? "fajr-azan.mp3" : "azan.mp3";
    const audio = `${baseAudioUrl}/mp3/${audioName}`;

    //console.log("Audio used: ", audio);

    const payload = {
        token: voice_monkey_token, 
        device: 'voice-monkey-speaker-1',
        audio
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        let data;
        try {
            const text = await response.text();
            data = JSON.parse(text);
        } catch (parseError) {
            console.error("Error parsing JSON:", parseError, "Response text:", text);
            data = text;
        }
        console.log('Azan triggered successfully:'/*, data*/);
    } catch (error) {
        console.error('Error triggering azan:', error);
    }
}

// Play prayer announcement through Voice Monkey
async function playPrayerAnnouncement(prayerName) {
    if(TEST_MODE) {
        console.log("🧪 TEST MODE: Announcement playback skipped");
        return;
    }

    // Check current feature status before playing
    const features = getFeatureStates();
    if (!features.announcementEnabled) {
        return console.log("⏸️ Announcement feature disabled");
    }

    const prayerToAnnouncementFile = {
        fajr: 't-minus-15-fajr.mp3',
        zuhr: 't-minus-15-dhuhr.mp3',
        asr: 't-minus-15-asr.mp3',
        maghrib: 't-minus-15-maghrib.mp3',
        isha: 't-minus-15-isha.mp3',
    };
    
    const url = 'https://api-v2.voicemonkey.io/announcement';
    const baseAudioUrl = 'https://la-ilaha-illa-allah.netlify.app/mp3/';
    
    const voice_monkey_token = process.env.VOICEMONKEY_TOKEN;
    
    if (!voice_monkey_token) {
        console.error("Error: Voice Monkey API token is missing!");
        return;
    }

    const audio = `${baseAudioUrl}${prayerToAnnouncementFile[prayerName]}`;
    
    //console.log("Audio used: ", audio);

    const payload = {
        token: voice_monkey_token, 
        device: 'voice-monkey-speaker-1',
        audio
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        let data;
        try {
            const text = await response.text();
            data = JSON.parse(text);
        } catch (parseError) {
            console.error("Error parsing JSON:", parseError, "Response text:", text);
            data = text;
        }

        console.log('Prayer announcement triggered successfully:'/*, data*/);
    } catch (error) {
        console.error('Error triggering prayer announcement:', error);
    }
}

export {
    scheduleNamazTimers,
    clearExistingSchedules
};