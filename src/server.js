const express = require('express');
const path = require('path');
require('./utils/loggerInitializer')(); // Initialize global logger interception

const apiRoutes = require('./routes/api');
const { initScheduler } = require('./services/schedulerService');
const { checkSystemHealth } = require('./services/healthCheck');
const { forceRefresh } = require('./services/prayerTimeService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Start server if main module
if (require.main === module) {
  app.listen(PORT, async () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/api/health`);
    
    // Log Configuration (Sources)
    const config = require('./config');

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
    await checkSystemHealth();

    // Ensure cache is cleared and refreshed at startup
    try {
      console.log('[Startup] Clearing and refreshing cache...');
      await forceRefresh(config);
      console.log('[Startup] Cache refresh completed.');
    } catch (e) {
      console.error('[Startup] Cache refresh failed:', e.message);
    }

    // Start Scheduler
    await initScheduler();
  });
}

module.exports = app;
