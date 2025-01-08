import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appConfig } from '../config/config-validator.js';
import { requireAuth } from '../auth/auth.js';
import { scheduleNamazTimers } from '../scheduler/scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '../../config.json');

// Feature state management
let featureStates = {
    azanEnabled: appConfig.features.azanEnabled,
    announcementEnabled: appConfig.features.announcementEnabled,
    systemLogsEnabled: appConfig.features.systemLogsEnabled || false
};

let testModeConfig = {
    enabled: appConfig.testMode.enabled,
    startTime: appConfig.testMode.startTime,
    timezone: appConfig.testMode.timezone
};

// Save config to file
function saveConfig() {
    try {
        const configString = JSON.stringify(appConfig, null, 4);
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
        res.json(featureStates);
    });

    // Update feature states
    app.post('/api/features', requireAuth, async (req, res) => {
        console.log('Received feature update request:', req.body);
        const { azanEnabled, announcementEnabled, systemLogsEnabled } = req.body;

        try {
            // Update feature states
            if (typeof azanEnabled === 'boolean') {
                console.log('Updating azanEnabled to:', azanEnabled);
                featureStates.azanEnabled = azanEnabled;
                appConfig.features.azanEnabled = azanEnabled;
            }
            if (typeof announcementEnabled === 'boolean') {
                console.log('Updating announcementEnabled to:', announcementEnabled);
                featureStates.announcementEnabled = announcementEnabled;
                appConfig.features.announcementEnabled = announcementEnabled;
            }
            if (typeof systemLogsEnabled === 'boolean') {
                console.log('Updating systemLogsEnabled to:', systemLogsEnabled);
                featureStates.systemLogsEnabled = systemLogsEnabled;
                appConfig.features.systemLogsEnabled = systemLogsEnabled;
            }

            // Save changes to config file
            const saveResult = saveConfig();
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

            res.json({ success: true, features: featureStates });
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
        res.json(testModeConfig);
    });

    // Update test mode configuration
    app.post('/api/test-mode', requireAuth, async (req, res) => {
        console.log('Received test mode update request:', req.body);
        const { enabled, startTime, timezone } = req.body;

        try {
            // Update test mode config
            if (typeof enabled === 'boolean') {
                console.log('Updating test mode enabled to:', enabled);
                testModeConfig.enabled = enabled;
                appConfig.testMode.enabled = enabled;
            }
            if (startTime) {
                console.log('Updating test mode startTime to:', startTime);
                testModeConfig.startTime = startTime;
                appConfig.testMode.startTime = startTime;
            }
            if (timezone) {
                console.log('Updating test mode timezone to:', timezone);
                testModeConfig.timezone = timezone;
                appConfig.testMode.timezone = timezone;
            }

            // Save changes to config file
            const saveResult = saveConfig();
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

            res.json({ success: true, testMode: testModeConfig });
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
    featureStates,
    testModeConfig
}; 