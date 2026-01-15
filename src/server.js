const express = require('express');
const path = require('path');
require('./utils/loggerInitializer')(); // Initialize global logger interception

const apiRoutes = require('./routes/api');
const { initScheduler } = require('./services/schedulerService');
const healthCheck = require('./services/healthCheck');
const { forceRefresh } = require('./services/prayerTimeService');

const app = express();
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
const startServer = async (port = PORT) => {
  return new Promise((resolve) => {
      const server = app.listen(port, async () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Health check available at http://localhost:${PORT}/api/health`);
        
        // Initialize Config Service
        const configService = require('./config');
        try {
            await configService.init();
            console.log('[Startup] ConfigService initialized.');
        } catch (e) {
            console.error('[Startup] Failed to initialize ConfigService:', e);
            process.exit(1);
        }
        const config = configService.get();

        console.log('[Config] Loaded Sources:');

        Object.entries(config.sources).forEach(([key, source]) => {
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

        // Ensure cache is cleared and refreshed at startup
        try {
          console.log('[Startup] Clearing and refreshing cache...');
          await forceRefresh(config);
          console.log('[Startup] Cache refresh completed.');
        } catch (e) {
          console.error('[Startup] Cache refresh failed:', e.message);
        }

        // Generate Audio Assets (Decoupled from Scheduler)
        const audioAssetService = require('./services/audioAssetService');
        try {
            await audioAssetService.syncAudioAssets();
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
