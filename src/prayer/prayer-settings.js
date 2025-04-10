import { requireAuth } from '../auth/auth.js';
import { getConfig, updateConfig } from '../config/config-service.js';

// Default prayer settings
const DEFAULT_PRAYER_SETTINGS = {
    prayers: {
        fajr: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false
        },
        zuhr: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false
        },
        asr: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false
        },
        maghrib: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false
        },
        isha: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false
        }
    }
};

// Get prayer settings from MongoDB
async function getPrayerSettings() {
    try {
        const config = await getConfig();
        if (!config.prayerSettings) {
            // If no prayer settings in MongoDB, initialise with defaults
            await updateConfig('prayerSettings', DEFAULT_PRAYER_SETTINGS);
            return DEFAULT_PRAYER_SETTINGS;
        }
        return config.prayerSettings;
    } catch (error) {
        console.error('Error getting prayer settings, using defaults:', error);
        return DEFAULT_PRAYER_SETTINGS;
    }
}

// Setup prayer settings routes
export function setupPrayerSettingsRoutes(app) {
    // Get prayer settings
    app.get('/api/prayer-settings', async (req, res) => {
        try {
            const prayerSettings = await getPrayerSettings();
            res.json(prayerSettings);
        } catch (error) {
            console.error('Error fetching prayer settings:', error);
            res.status(500).json({ error: 'Failed to fetch prayer settings' });
        }
    });    // Update prayer settings
    app.post('/api/prayer-settings', requireAuth, async (req, res) => {
        try {
            const settings = req.body;
            const config = await getConfig();
            
            // Validate settings
            if (!settings || !settings.prayers) {
                return res.status(400).json({ error: 'Invalid settings format' });
            }
            
            // Prepare updated prayer settings
            const updatedPrayerSettings = {
                ...(config.prayerSettings || DEFAULT_PRAYER_SETTINGS),
                ...settings,
                prayers: {
                    ...((config.prayerSettings && config.prayerSettings.prayers) || DEFAULT_PRAYER_SETTINGS.prayers),
                    ...settings.prayers
                }
            };
            
            // Update prayer settings in MongoDB
            await updateConfig('prayerSettings', updatedPrayerSettings);
            
            // Update global feature toggles if provided
            if (settings.globalAzanEnabled !== undefined || settings.globalAnnouncementEnabled !== undefined) {
                const features = {...config.features};
                
                if (settings.globalAzanEnabled !== undefined) {
                    features.azanEnabled = settings.globalAzanEnabled;
                    //console.log(`📣 Global azan feature ${settings.globalAzanEnabled ? 'enabled' : 'disabled'}`);
                }
                
                if (settings.globalAnnouncementEnabled !== undefined) {
                    features.announcementEnabled = settings.globalAnnouncementEnabled;
                    //console.log(`📣 Global announcement feature ${settings.globalAnnouncementEnabled ? 'enabled' : 'disabled'}`);
                }
                      // Update features in MongoDB
                await updateConfig('features', features);
            }
            
            // Reschedule prayer timers with new settings
            const { scheduleNamazTimers } = await import('../scheduler/scheduler.js');
            await scheduleNamazTimers();
            
            res.json({ success: true, settings: updatedPrayerSettings });
        } catch (error) {
            console.error('Error updating prayer settings:', error);
            res.status(500).json({ error: 'Failed to update prayer settings' });
        }
    });
}

// Export functions
export { getPrayerSettings, DEFAULT_PRAYER_SETTINGS };