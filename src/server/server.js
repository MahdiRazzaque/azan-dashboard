// src/server/server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupFeatureRoutes } from '../features/feature-manager.js';
import { setupAuthRoutes } from '../auth/auth.js'; // Keep startSessionCleanup if used
import { setupLogRoutes, initialiseLogging } from '../logging/log-manager.js';
import { scheduleNamazTimers } from '../scheduler/scheduler.js';
import { initialisePrayerDataSource } from '../prayer/prayer-data-provider.js';
import { setupPrayerRoutes } from '../prayer/prayer-times.js';
import { setupPrayerSettingsRoutes } from '../prayer/prayer-settings.js';
import { setupPrayerSourceRoutes } from '../prayer/prayer-source-routes.js';
// import { connectToDatabase } from '../database/db-connection.js'; // REMOVE
import { getTestMode } from '../utils/utils.js';
import { validateEnv, validateConfig } from '../config/config-validator.js'; // Keep validateConfig
import { getConfig, enableWebSetup } from '../config/config-service.js';
import { setupConfigRoutes } from '../config/config-routes.js';
// Import startSessionCleanup if you want to keep it, otherwise remove it from auth.js too
import { startSessionCleanup } from '../auth/auth.js';
import constantsRoutes from '../prayer/constants-routes.js';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_FILE_PATH = path.join(__dirname, '../../config.json');
const PRAYER_TIMES_FILE_PATH = path.join(__dirname, '../../prayer_times.json');

const app = express();
// Flag to track if prayer services have been initialised
let prayerServicesinitialised = false;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

initialiseLogging();

app.use('/api/prayer/constants', constantsRoutes);
setupConfigRoutes(app);
setupFeatureRoutes(app);
setupAuthRoutes(app);
setupLogRoutes(app);
setupPrayerRoutes(app);
setupPrayerSettingsRoutes(app);
setupPrayerSourceRoutes(app);

// Add endpoint to initialize prayer services after setup
app.post('/api/initialize-services', async (req, res) => {
    try {
        if (prayerServicesinitialised) {
            return res.json({ success: true, message: 'Prayer services already initialised' });
        }
        
        const success = await initializePrayerServices();
        if (success) {
            res.json({ success: true, message: 'Prayer services initialised successfully' });
        } else {
            res.status(500).json({ success: false, error: 'Failed to initialize prayer services' });
        }
    } catch (error) {
        console.error('Error Initialising prayer services:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to initialize prayer services',
            details: error.message
        });
    }
});

/**
 * Initialize prayer-dependent services (prayer data source and scheduler)
 * Called either at startup or after setup completion
 * @returns {Promise<boolean>} Success status
 */
async function initializePrayerServices() {
    try {
        // Check if config exists and is valid before Initialising services
        if (!fs.existsSync(CONFIG_FILE_PATH)) {
            console.info('❌ Cannot initialize prayer services: No configuration file found');
            return false;
        }
        
        // Check if prayer_times.json exists, if not try to initialize prayer data source
        const prayerTimesExists = fs.existsSync(PRAYER_TIMES_FILE_PATH);
        
        try {
            const config = await getConfig();
            if (!validateConfig(config)) {
                console.error("❌ Cannot initialize prayer services: Invalid configuration");
                return false;
            }
            
            console.info("✅ Configuration validated, Initialising prayer services");
            
            // Initialize prayer data source (this will create prayer_times.json if needed)
            await initialisePrayerDataSource();
            
            // Schedule prayer timers
            await scheduleNamazTimers();
            
            // Start session cleanup
            startSessionCleanup();
            
            prayerServicesinitialised = true;
            console.info("✅ Prayer services initialised successfully");
            return true;
        } catch (error) {
            console.error("❌ Failed to initialize prayer services:", error);
            return false;
        }
    } catch (error) {
        console.error("❌ Error Initialising prayer services:", error);
        return false;
    }
}

async function initialiseServer() {
    try {
        console.info('🚀 Initialising server...');
        
        // Enable web-based setup mode to prevent console-based setup
        enableWebSetup();
        
        validateEnv();
        console.info('✅ Environment variables validated');
        
        // Check if config.json exists
        const configExists = fs.existsSync(CONFIG_FILE_PATH);
        
        if (!configExists) {
            console.info('ℹ️ No configuration file found. Setup modal will be shown to the user.');
            // Continue without Initialising prayer services - the setup modal will handle configuration
            return true;
        }
        
        try {
            // Try to read and parse the config file to catch JSON syntax errors
            try {
                const configFileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf8');
                JSON.parse(configFileContent); // This will throw if JSON is invalid
            } catch (jsonError) {
                console.error("❌ Failed to parse config.json: Invalid JSON format");
                console.info('ℹ️ Setup modal will be shown to the user.');
                return true; // Continue without Initialising prayer services
            }
            
            const config = await getConfig(); // This will load from file
            
            if (!validateConfig(config)) { // Keep validateConfig, it checks structure
                console.error("❌ Failed to validate configuration from file");
                console.info('ℹ️ Setup modal will be shown to the user.');
                return true; // Continue without Initialising prayer services
            }
            
            console.info("✅ Configuration loaded and validated successfully");
            
            // Initialize prayer services if config exists and is valid
            await initializePrayerServices();
            
            if(getTestMode()) { 
                console.log("🧪 TEST MODE enabled")
            }
        } catch (error) {
            console.error("❌ Failed to load configuration from file:", error);
            console.info('ℹ️ Setup modal will be shown to the user.');
            return true; // Continue without Initialising prayer services
        }
        
        return true;
    } catch (error) {
        console.error("Error initialising server:", error);
        return false;
    }
}

export { app, initialiseServer, initializePrayerServices };