import moment from 'moment-timezone';
import schedule from 'node-schedule';
import fetch from 'node-fetch';
import { appConfig } from '../config/config-validator.js';
import { getCurrentTime, logSection } from '../utils/utils.js';
import { updatePrayerTimes } from '../prayer/prayer-times.js';

// Schedule management
const activeSchedules = new Map();
const lastExecutionTimes = new Map();
const DEBOUNCE_INTERVAL = 60000; // 1 minute in milliseconds

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

// Schedule next day's update
async function scheduleNextDay() {
    logSection("Next Day Scheduling");
    const nextMidnight = moment.tz('Europe/London').add(1, 'day').startOf('day');
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
                await playAzan();
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
        const scheduledTime = moment.tz(time, 'HH:mm', 'Europe/London');

        if (scheduledTime.isBefore(getCurrentTime())) {
            console.log(`⏩ ${prayerName.toUpperCase()} prayer announcement time has already passed.`);
            return null;
        }

        console.log(`📢 Scheduling ${prayerName.toUpperCase()} announcement at ${time}`);
        return schedule.scheduleJob(scheduledTime.toDate(), async () => {
            if (!canExecute(`announcement_${prayerName}`)) return;
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
async function playAzan() {
    if (!appConfig.features.azanEnabled) {
        return console.log("⏸️ Azan feature disabled");
    }
    
    const url = 'https://api-v2.voicemonkey.io/announcement';
    const baseAudioUrl = 'https://la-ilaha-illa-allah.netlify.app';
    
    const voice_monkey_token = process.env.VOICEMONKEY_TOKEN;
    
    if (!voice_monkey_token) {
        console.error("Error: Voice Monkey API token is missing!");
        return;
    }

    const payload = {
        token: voice_monkey_token, 
        device: 'voice-monkey-speaker-1',
        audio: baseAudioUrl + '/mp3/azan.mp3',
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
        const data = await response.json();
        console.log('Azan triggered successfully:', data);
    } catch (error) {
        console.error('Error triggering azan:', error);
    }
}

// Play prayer announcement through Voice Monkey
async function playPrayerAnnouncement(prayerName) {
    if (!appConfig.features.announcementEnabled) {
        return console.log("⏸️ Announcement feature disabled");
    }

    const prayerToAnnouncmentFile = {
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

    const payload = {
        token: voice_monkey_token, 
        device: 'voice-monkey-speaker-1',
        audio: baseAudioUrl + prayerToAnnouncmentFile[prayerName],
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
        const data = await response.json();
        console.log('Prayer announcement triggered successfully:', data);
    } catch (error) {
        console.error('Error triggering prayer announcement:', error);
    }
}

// Main scheduling function
async function scheduleNamazTimers() {
    clearExistingSchedules();
    
    const prayerData = await updatePrayerTimes();
    if (!prayerData) return;

    const { iqamahTimes } = prayerData;
    const prayerAnnouncementTimes = Object.entries(iqamahTimes).reduce((acc, [prayerName, time]) => {
        const updatedTime = moment(time, 'HH:mm').subtract(15, 'minutes').format('HH:mm');
        acc[prayerName] = updatedTime;
        return acc;
    }, {});

    if (appConfig.features.azanEnabled) {
        logSection("Scheduling Prayer Iqamah Times");
        for (const [prayerName, time] of Object.entries(iqamahTimes)) {
            if (prayerName === 'sunrise') continue;
            const job = await scheduleAzanTimer(prayerName, time);
            if (job) {
                activeSchedules.set(`azan_${prayerName}`, job);
            }
        }
    } else {
        console.log("⏸️ Azan timer is disabled");
    }

    if (appConfig.features.announcementEnabled) {
        logSection("Scheduling Prayer Announcements");
        for (const [prayerName, time] of Object.entries(prayerAnnouncementTimes)) {
            if (prayerName === 'sunrise') continue;
            const job = await scheduleAnnouncementTimer(prayerName, time);
            if (job) {
                activeSchedules.set(`announcement_${prayerName}`, job);
            }
        }
    } else {
        console.log("⏸️ Announcements are disabled");
    }

    // Schedule next day's update
    const nextDayJob = await scheduleNextDay();
    if (nextDayJob) {
        activeSchedules.set('next_day', nextDayJob);
    }
}

export {
    scheduleNamazTimers,
    clearExistingSchedules
}; 