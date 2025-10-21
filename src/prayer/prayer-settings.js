import { requireAuth } from '../auth/auth.js';
import { getConfig, updateConfig } from '../config/config-service.js';

// Default prayer settings
const DEFAULT_PRAYER_SETTINGS = {
    globalAzanEnabled: true,
    globalAnnouncementEnabled: true,
    prayers: {
        fajr: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false,
            announcementAtIqamah: false
        },
        zuhr: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false,
            announcementAtIqamah: false
        },
        asr: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false,
            announcementAtIqamah: false
        },
        maghrib: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false,
            announcementAtIqamah: false
        },
        isha: {
            azanEnabled: true,
            announcementEnabled: true,
            azanAtIqamah: false,
            announcementAtIqamah: false
        }
    }
};

// Get prayer settings from MongoDB
async function getPrayerSettings() {
    try {
        const config = await getConfig();
        
        // If no config or no prayerSettings, return defaults
        if (!config || !config.prayerSettings) {
            // Only try to update if config exists
            if (config && Object.keys(config).length > 0) {
                await updateConfig('prayerSettings', DEFAULT_PRAYER_SETTINGS);
            }
            return DEFAULT_PRAYER_SETTINGS;
        }
        
        // Include global feature toggles from features section
        const prayerSettings = { ...config.prayerSettings };
        
        // Add global feature toggles with consistent naming
        if (config.features) {
            prayerSettings.globalAzanEnabled = config.features.azanEnabled;
            prayerSettings.globalAnnouncementEnabled = config.features.announcementEnabled;
        }
        
        return prayerSettings;
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
            
            // Get current prayer settings or defaults
            const currentPrayerSettings = config.prayerSettings || DEFAULT_PRAYER_SETTINGS;
            const currentPrayers = currentPrayerSettings.prayers || DEFAULT_PRAYER_SETTINGS.prayers;
            
            // Merge each prayer's settings individually to preserve all fields
            const updatedPrayers = {};
            const prayers = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'];
            
            for (const prayer of prayers) {
                updatedPrayers[prayer] = {
                    ...(currentPrayers[prayer] || DEFAULT_PRAYER_SETTINGS.prayers[prayer]),
                    ...(settings.prayers[prayer] || {})
                };
            }
            
            // Prepare updated prayer settings
            const updatedPrayerSettings = {
                ...currentPrayerSettings,
                prayers: updatedPrayers
            };
            
            // Note: Global settings are now handled by the /api/features endpoint

            // Update prayer settings in MongoDB
            await updateConfig('prayerSettings', updatedPrayerSettings);
            
            // Note: Global feature toggles are now handled by the /api/features endpoint
            // This endpoint only handles prayer-specific settings
            
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