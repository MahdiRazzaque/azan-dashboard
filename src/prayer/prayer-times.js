import moment from 'moment-timezone';
import { getPrayerTimesData } from './prayer-data-provider.js';
import { getCurrentTime } from '../utils/utils.js';

// Calculate next prayer
function calculateNextPrayer(startTimes) {
    const now = getCurrentTime();
    let nextPrayerName = null;
    let nextPrayerTime = null;

    for (const [prayer, time] of Object.entries(startTimes)) {
        if (prayer === 'sunrise') continue; // Skip sunrise for next prayer calculation
        const prayerTime = moment.tz(time, 'HH:mm', 'Europe/London');
        if (prayerTime.isAfter(now)) {
            nextPrayerName = prayer;
            nextPrayerTime = prayerTime;
            break;
        }
    }

    return nextPrayerName ? {
        name: nextPrayerName,
        time: nextPrayerTime.format('HH:mm')
    } : null;
}

// Update prayer times
async function updatePrayerTimes() {
    try {
        const now = getCurrentTime();
        const data = await getPrayerTimesData(now);
        
        if (!data) {
            console.error("❌ Failed to fetch prayer times");
            return null;
        }

        const startTimes = {
            fajr: data.fajr,
            sunrise: data.sunrise,
            zuhr: data.zuhr,
            asr: data.asr,
            maghrib: data.maghrib,
            isha: data.isha
        };

        const iqamahTimes = {
            fajr: data.fajr_iqamah || data.fajr,
            sunrise: data.sunrise,
            zuhr: data.zuhr_iqamah || data.zuhr,
            asr: data.asr_iqamah || data.asr,
            maghrib: data.maghrib,
            isha: data.isha_iqamah || data.isha
        };

        const nextPrayer = calculateNextPrayer(startTimes);

        return {
            startTimes,
            iqamahTimes,
            nextPrayer
        };
    } catch (error) {
        console.error("❌ Error updating prayer times:", error);
        return null;
    }
}

// Setup prayer time routes
function setupPrayerRoutes(app) {
    app.get('/api/prayer-times', async (req, res) => {
        const data = await updatePrayerTimes();
        if (!data) {
            return res.status(500).json({ error: 'Failed to fetch prayer times' });
        }
        res.json({
            ...data,
            currentTime: getCurrentTime().format('HH:mm:ss')
        });
    });
}

export {
    updatePrayerTimes,
    setupPrayerRoutes
}; 