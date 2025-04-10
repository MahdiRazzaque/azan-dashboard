import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupFeatureRoutes } from '../features/feature-manager.js';
import { setupAuthRoutes } from '../auth/auth.js';
import { setupLogRoutes, initialiseLogging } from '../logging/log-manager.js';
import { scheduleNamazTimers } from '../scheduler/scheduler.js';
import { initialisePrayerDataSource } from '../prayer/prayer-data-provider.js';
import { setupPrayerRoutes } from '../prayer/prayer-times.js';
import { setupPrayerSettingsRoutes } from '../prayer/prayer-settings.js';
import { connectToDatabase } from '../database/db-connection.js';
import { TEST_MODE } from '../utils/utils.js';
import { validateEnv, validateConfig } from '../config/config-validator.js';
import { getConfig, initializeConfig } from '../config/config-service.js';
import configRoutes from '../config/config-routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialise Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Initialise logging first
initialiseLogging();

// Setup routes
app.use(configRoutes);  // Add the config routes
setupFeatureRoutes(app);
setupAuthRoutes(app);
setupLogRoutes(app);
setupPrayerRoutes(app);
setupPrayerSettingsRoutes(app);

// Initialise server
async function initialiseServer() {
    try {
        console.info('🚀 Initialising server...');
        
        // Validate environment variables
        validateEnv();
        console.info('✅ Environment variables validated');
          
        // Connect to MongoDB database first
        await connectToDatabase();
       
        // Load configuration from MongoDB and initialize the config system
        try {
            // Get configuration from database - this will initialize the in-memory config as well
            const config = await getConfig();
            
            // Configuration has been loaded into memory, now validate it
            const configInitialized = initializeConfig(config);
            
            if (!configInitialized) {
                console.error("❌ Failed to validate configuration");
                console.info("💡 Configuration validation failed. Check your configuration data.");
                return false;
            }
            
            console.info("✅ Configuration initialized and validated successfully");
        } catch (error) {
            console.error("❌ Failed to load configuration from MongoDB:", error);
            console.info("💡 Default values will be used. Please check database connection.");
            return false;
        }
        
        // Initialise prayer data source
        await initialisePrayerDataSource();
        
        // Initialise components
        await scheduleNamazTimers();

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