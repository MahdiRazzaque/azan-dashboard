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
// import { connectToDatabase } from '../database/db-connection.js'; // REMOVE
import { TEST_MODE } from '../utils/utils.js';
import { validateEnv, validateConfig } from '../config/config-validator.js'; // Keep validateConfig
import { getConfig } from '../config/config-service.js';
import configRoutes from '../config/config-routes.js';
// Import startSessionCleanup if you want to keep it, otherwise remove it from auth.js too
import { startSessionCleanup } from '../auth/auth.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

initialiseLogging();

app.use(configRoutes);
setupFeatureRoutes(app);
setupAuthRoutes(app);
setupLogRoutes(app);
setupPrayerRoutes(app);
setupPrayerSettingsRoutes(app);

async function initialiseServer() {
    try {
        console.info('🚀 Initialising server (File Based Config)...');
        
        validateEnv();
        console.info('✅ Environment variables validated');
          
        // Connect to MongoDB database first - REMOVE
        // await connectToDatabase(); // REMOVE
       
        try {
            const config = await getConfig(); // This will load from file or initialize
                        
            if (!validateConfig(config)) { // Keep validateConfig, it checks structure
                console.error("❌ Failed to validate configuration from file");
                return false;
            }
            
            console.info("✅ Configuration loaded/initialised from file and validated successfully");
        } catch (error) {
            console.error("❌ Failed to load/initialise configuration from file:", error);
            return false;
        }
        
        await initialisePrayerDataSource();
        await scheduleNamazTimers();
        startSessionCleanup(); // If you're keeping session cleanup

        if(TEST_MODE) { 
            console.log("🧪 TEST MODE enabled")
        }
        
        return true;
    } catch (error) {
        console.error("Error initialising server:", error);
        return false;
    }
}

export { app, initialiseServer };