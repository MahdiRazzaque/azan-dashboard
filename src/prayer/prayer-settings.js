import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../auth/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the config file
const CONFIG_PATH = path.join(__dirname, '../../config.json');

// Helper functions to get and save config
async function getConfig() {
    const configData = await fs.readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(configData);
}

async function saveConfig(config) {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 4), 'utf8');
}

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

// Get prayer settings from config
async function getPrayerSettings() {
    const config = await getConfig();
    if (!config.prayerSettings) {
        config.prayerSettings = DEFAULT_PRAYER_SETTINGS;
        await saveConfig(config);
    }
    return config.prayerSettings;
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
    });

    // Update prayer settings
    app.post('/api/prayer-settings', requireAuth, async (req, res) => {
        try {
            const settings = req.body;
            
            // Validate settings
            if (!settings || !settings.prayers) {
                return res.status(400).json({ error: 'Invalid settings format' });
            }
            
            // Get current config
            const config = await getConfig();
            
            // Update settings
            config.prayerSettings = {
                ...config.prayerSettings || DEFAULT_PRAYER_SETTINGS,
                ...settings,
                prayers: {
                    ...((config.prayerSettings && config.prayerSettings.prayers) || DEFAULT_PRAYER_SETTINGS.prayers),
                    ...settings.prayers
                }
            };
            
            // Update global feature toggles if provided
            if (settings.globalAzanEnabled !== undefined || settings.globalAnnouncementEnabled !== undefined) {
                if (!config.features) {
                    config.features = {};
                }
                
                if (settings.globalAzanEnabled !== undefined) {
                    config.features.azanEnabled = settings.globalAzanEnabled;
                    console.log(`📣 Global azan feature ${settings.globalAzanEnabled ? 'enabled' : 'disabled'}`);
                }
                
                if (settings.globalAnnouncementEnabled !== undefined) {
                    config.features.announcementEnabled = settings.globalAnnouncementEnabled;
                    console.log(`📣 Global announcement feature ${settings.globalAnnouncementEnabled ? 'enabled' : 'disabled'}`);
                }
            }
            
            // Save config
            await saveConfig(config);
            
            res.json({ success: true, settings: config.prayerSettings });
        } catch (error) {
            console.error('Error updating prayer settings:', error);
            res.status(500).json({ error: 'Failed to update prayer settings' });
        }
    });
}

// Export functions
export { getPrayerSettings, DEFAULT_PRAYER_SETTINGS };