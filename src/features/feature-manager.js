import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../auth/auth.js';
import { scheduleNamazTimers } from '../scheduler/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../../config.json');

// Helper function to get fresh config
function getConfig() {
    try {
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Error reading config file:', error);
        return null;
    }
}

// Feature state management - read directly from the config file each time
function getFeatureStates() {
    const config = getConfig();
    return {
        azanEnabled: config?.features?.azanEnabled ?? true,
        announcementEnabled: config?.features?.announcementEnabled ?? true,
        systemLogsEnabled: config?.features?.systemLogsEnabled ?? false
    };
}

function getTestModeConfig() {
    const config = getConfig();
    return {
        enabled: config?.testMode?.enabled ?? false,
        startTime: config?.testMode?.startTime ?? "00:00:00",
        timezone: config?.testMode?.timezone ?? "Europe/London"
    };
}

// Save config to file
function saveConfig(updatedConfig) {
    try {
        const configString = JSON.stringify(updatedConfig, null, 4);
        fs.writeFileSync(configPath, configString, 'utf8');
        return { success: true };
    } catch (error) {
        console.error('Error saving config:', error);
        return { success: false, error: error.message };
    }
}

// Setup feature routes
function setupFeatureRoutes(app) {
    // Get feature states
    app.get('/api/features', (req, res) => {
        const featureStates = getFeatureStates();
        res.json(featureStates);
    });

    // Update feature states
    app.post('/api/features', requireAuth, async (req, res) => {
        console.log('Received feature update request:', req.body);
        const { azanEnabled, announcementEnabled, systemLogsEnabled } = req.body;

        try {
            // Get current config
            const config = getConfig();
            if (!config) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to read configuration'
                });
            }
            
            // Ensure features object exists
            if (!config.features) {
                config.features = {};
            }

            // Update feature states
            let hasChanges = false;
            if (typeof azanEnabled === 'boolean') {
                console.log('Updating azanEnabled to:', azanEnabled);
                config.features.azanEnabled = azanEnabled;
                hasChanges = true;
            }
            if (typeof announcementEnabled === 'boolean') {
                console.log('Updating announcementEnabled to:', announcementEnabled);
                config.features.announcementEnabled = announcementEnabled;
                hasChanges = true;
            }
            if (typeof systemLogsEnabled === 'boolean') {
                console.log('Updating systemLogsEnabled to:', systemLogsEnabled);
                config.features.systemLogsEnabled = systemLogsEnabled;
                hasChanges = true;
            }

            if (hasChanges) {
                // Save changes to config file
                const saveResult = saveConfig(config);
                if (!saveResult.success) {
                    console.error('Failed to save config:', saveResult.error);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Failed to save configuration',
                        error: saveResult.error
                    });
                }

                // Reschedule timers with new feature states
                await scheduleNamazTimers();
            }

            res.json({ success: true, features: getFeatureStates() });
        } catch (error) {
            console.error('Error updating features:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error updating features',
                error: error.message
            });
        }
    });

    // Get test mode configuration
    app.get('/api/test-mode', (req, res) => {
        const testModeConfig = getTestModeConfig();
        res.json(testModeConfig);
    });

    // Update test mode configuration
    app.post('/api/test-mode', requireAuth, async (req, res) => {
        console.log('Received test mode update request:', req.body);
        const { enabled, startTime, timezone } = req.body;

        try {
            // Get current config
            const config = getConfig();
            if (!config) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to read configuration'
                });
            }
            
            // Ensure testMode object exists
            if (!config.testMode) {
                config.testMode = {
                    enabled: false,
                    startTime: "00:00:00",
                    timezone: "Europe/London"
                };
            }

            // Update test mode config
            let hasChanges = false;
            if (typeof enabled === 'boolean') {
                console.log('Updating test mode enabled to:', enabled);
                config.testMode.enabled = enabled;
                hasChanges = true;
            }
            if (startTime) {
                console.log('Updating test mode startTime to:', startTime);
                config.testMode.startTime = startTime;
                hasChanges = true;
            }
            if (timezone) {
                console.log('Updating test mode timezone to:', timezone);
                config.testMode.timezone = timezone;
                hasChanges = true;
            }

            if (hasChanges) {
                // Save changes to config file
                const saveResult = saveConfig(config);
                if (!saveResult.success) {
                    console.error('Failed to save test mode config:', saveResult.error);
                    return res.status(500).json({ 
                        success: false, 
                        message: 'Failed to save configuration',
                        error: saveResult.error
                    });
                }

                // Reschedule timers with new test mode config
                await scheduleNamazTimers();
            }

            res.json({ success: true, testMode: getTestModeConfig() });
        } catch (error) {
            console.error('Error updating test mode:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error updating test mode',
                error: error.message
            });
        }
    });
}

export {
    setupFeatureRoutes,
    getFeatureStates,
    getTestModeConfig,
    getConfig
};