require('module-alias/register');
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const ENV_FILE_PATH = process.env.ENV_FILE_PATH || path.join(__dirname, '../.env');
dotenv.config({ path: ENV_FILE_PATH });

require('@utils/loggerInitializer')(); // Initialise global logger interception

const apiRoutes = require('@routes/index');
const { initScheduler } = require('@services/core/schedulerService');
const healthCheck = require('@services/system/healthCheck');
const { forceRefresh } = require('@services/core/prayerTimeService');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(require('cookie-parser')());

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, '../client/dist')));

// Serve public directory for static assets (like audio)
app.use('/public', express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api', apiRoutes);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Azan Dashboard Server is running'
  });
});

// Catch-all route for React Router
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Startup Logic Encapsulated
/**
 * Initialises and starts the Express server.
 * Handles the initialisation of configuration services and application logic.
 * 
 * @param {number} [port=PORT] - The port to listen on.
 * @returns {Promise<import('http').Server>} A promise that resolves with the server instance.
 */
const startServer = async (port = PORT) => {
  return new Promise((resolve) => {
      const server = app.listen(port, async () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Health check available at http://localhost:${PORT}/api/health`);
        
        // Initialise Config Service
        const configService = require('@config');
        try {
            await configService.init();
            console.log('[Startup] ConfigService initialised.');
        } catch (e) {
            console.error('[Startup] Failed to initialise ConfigService:', e);
            process.exit(1);
        }
        const config = configService.get();

        console.log('[Config] Loaded Sources:');

        Object.entries(config.sources).forEach(([key, source]) => {

          if(!source) return;
          
          switch (source.type) {
            case "mymasjid":
              console.log(`  • ${key} (mymasjid) → masjidId: ${source.masjidId}`);
              break;
            case "aladhan":
              const { lat, long } = config.location.coordinates;
              console.log(`  • ${key} (aladhan) → latitude: ${lat}, longitude: ${long}`);
              break;
            default:
              console.log(`  • ${key} (${source.type}) →`, source);
          }
        });

        // Run System Health Checks
        await healthCheck.refresh('all');

        // Initialise Voice Cache (Decoupled from Scheduler)
        const voiceService = require('@services/system/voiceService');
        try {
            await voiceService.init();
            console.log('[Startup] VoiceService initialised.');
        } catch (e) {
            console.error('[Startup] VoiceService init failed (non-critical):', e.message);
        }

        // Ensure cache is cleared and refreshed at startup
        try {
          console.log('[Startup] Clearing and refreshing cache...');
          await forceRefresh(config);
          console.log('[Startup] Cache refresh completed.');
        } catch (e) {
          console.error('[Startup] Cache refresh failed:', e.message);
        }

        // Generate Audio Assets (Decoupled from Scheduler)
        const audioAssetService = require('@services/system/audioAssetService');
        try {
            await audioAssetService.syncAudioAssets();
            await audioAssetService.generateMetadataForExistingFiles();
        } catch (e) {
            console.error('[Startup] Failed to synchronise audio assets:', e.message);
        }

        // Start Scheduler
        await initScheduler();
        
        resolve(server);
      });
  });
};

// Start server if main module
if (require.main === module) {
  startServer();
}

app.startServer = startServer;
module.exports = app;
