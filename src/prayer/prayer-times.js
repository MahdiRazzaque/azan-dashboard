import moment from 'moment-timezone';
import fetch from 'node-fetch';
import { appConfig } from '../config/config-validator.js';
import { getCurrentTime, logSection, logPrayerTimesTable } from '../utils/utils.js';

// Store the latest prayer times in memory
let currentIqamahTimes = null;
let currentPrayerStartTimes = null;
let nextPrayer = null;

// Fetch prayer times from API
async function fetchMasjidTimings() {
    try {
        console.log(`🔍 Fetching prayer times for GuidId: ${appConfig.GuidId}`);
        const response = await fetch(`https://time.my-masjid.com/api/TimingsInfoScreen/GetMasjidTimings?GuidId=${appConfig.GuidId}`);
        const data = await response.json();
        
        const salahTimings = data.model.salahTimings;
        if (!salahTimings || !Array.isArray(salahTimings)) {
            console.error("❌ Invalid salahTimings data structure");
            return null;
        }

        const today = moment.tz('Europe/London');
        const todayDay = today.date();
        const todayMonth = today.month() + 1;

        const todayTimings = salahTimings.filter(obj => obj.day === todayDay && obj.month === todayMonth);

        if (todayTimings.length > 0) {
            return todayTimings[0];
        } else {
            console.error("❌ No timings found for today.");
            return null;
        }
    } catch (error) {
        console.error("❌ Error fetching data:", error);
        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response data:", error.response.data);
        }
        return null;
    }
}

// Update prayer times
async function updatePrayerTimes() {
    const timings = await fetchMasjidTimings();
    if (!timings) {
        console.error("❌ Could not fetch today's timings.");
        return null;
    }

    const iqamahTimes = {
        fajr: timings.iqamah_Fajr,
        sunrise: timings.shouruq,
        zuhr: timings.iqamah_Zuhr,
        asr: timings.iqamah_Asr,
        maghrib: timings.maghrib,
        isha: timings.iqamah_Isha,
    };

    const prayerStartTimes = {
        fajr: timings.fajr,
        sunrise: timings.shouruq,
        zuhr: timings.zuhr,
        asr: timings.asr,
        maghrib: timings.maghrib,
        isha: timings.isha,
    };

    currentIqamahTimes = iqamahTimes;
    currentPrayerStartTimes = prayerStartTimes;
    updateNextPrayer();

    // Log the updated times
    logSection("Today's Prayer Iqamah Timings");
    logPrayerTimesTable(iqamahTimes, "Iqamah Times");

    return {
        iqamahTimes,
        prayerStartTimes,
        nextPrayer
    };
}

// Calculate next prayer
function updateNextPrayer() {
    if (!currentIqamahTimes) return;

    const now = getCurrentTime();
    let nextPrayerName = null;
    let nextPrayerTime = null;

    for (const [prayer, time] of Object.entries(currentPrayerStartTimes)) {
        const prayerTime = moment.tz(time, 'HH:mm', 'Europe/London');
        if (prayerTime.isAfter(now)) {
            nextPrayerName = prayer;
            nextPrayerTime = prayerTime;
            break;
        }
    }

    nextPrayer = nextPrayerName ? {
        name: nextPrayerName,
        time: nextPrayerTime.format('HH:mm'),
        countdown: moment.duration(nextPrayerTime.diff(now)).asMilliseconds()
    } : null;
}

// Setup prayer time routes
function setupPrayerRoutes(app) {
    app.get('/api/prayer-times', (req, res) => {
        res.json({
            iqamahTimes: currentIqamahTimes,
            startTimes: currentPrayerStartTimes,
            nextPrayer: nextPrayer,
            currentTime: getCurrentTime().format('HH:mm:ss')
        });
    });
}

// Start the prayer time update interval
function startPrayerTimeUpdates() {
    // Update next prayer info every minute
    setInterval(updateNextPrayer, 60000);
    
    // Initial update
    return updatePrayerTimes();
}

export {
    updatePrayerTimes,
    setupPrayerRoutes,
    startPrayerTimeUpdates,
    currentIqamahTimes,
    currentPrayerStartTimes,
    nextPrayer
}; 