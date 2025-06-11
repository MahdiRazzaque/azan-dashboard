import moment from 'moment-timezone';
import { getPrayerTimesData, getPrayerDataSourceInfo } from './prayer-data-provider.js';
import { getCurrentTime } from '../utils/utils.js';
import { scheduleNamazTimers } from '../scheduler/scheduler.js';
import { requireAuth } from '../auth/auth.js';

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
            maghrib: data.maghrib_iqamah || data.maghrib,
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
        try {
            // Get source information first
            const sourceInfo = getPrayerDataSourceInfo();
            
            // If setup is required, return early with just the source info
            if (sourceInfo.sourceType === "setup_required") {
                return res.json({
                    startTimes: null,
                    iqamahTimes: null,
                    nextPrayer: null,
                    currentTime: getCurrentTime().format('HH:mm:ss'),
                    source: sourceInfo,
                    setupRequired: true
                });
            }
            
            const data = await updatePrayerTimes();
            if (!data) {
                return res.json({
                    startTimes: null,
                    iqamahTimes: null,
                    nextPrayer: null,
                    currentTime: getCurrentTime().format('HH:mm:ss'),
                    source: sourceInfo,
                    error: 'Failed to fetch prayer times'
                });
            }
            
            res.json({
                startTimes: data.startTimes,
                iqamahTimes: data.iqamahTimes,
                nextPrayer: data.nextPrayer,
                currentTime: getCurrentTime().format('HH:mm:ss'),
                source: sourceInfo
            });
        } catch (error) {
            console.error("Error in /api/prayer-times endpoint:", error);
            res.json({
                startTimes: null,
                iqamahTimes: null,
                nextPrayer: null,
                currentTime: getCurrentTime().format('HH:mm:ss'),
                source: { sourceType: "error", message: error.message },
                error: 'Failed to fetch prayer times'
            });
        }
    });

    // Add a dedicated endpoint for prayer source information
    app.get('/api/prayer-source-info', (req, res) => {
        try {
            const sourceInfo = getPrayerDataSourceInfo();
            res.json(sourceInfo);
        } catch (error) {
            console.error("Error in /api/prayer-source-info endpoint:", error);
            res.json({ 
                sourceType: "error", 
                message: error.message || 'Failed to fetch prayer source information' 
            });
        }
    });

    // Add a new endpoint to refresh prayer timers
    app.post('/api/prayer-times/refresh', requireAuth, async (req, res) => {
        try {
            await scheduleNamazTimers();
            console.info('🔄 Prayer timers refreshed due to settings change');
            res.json({ success: true });
        } catch (error) {
            console.error('Error refreshing prayer timers:', error);
            res.status(500).json({ error: 'Failed to refresh prayer timers' });
        }
    });
}

export {
    updatePrayerTimes,
    setupPrayerRoutes
};