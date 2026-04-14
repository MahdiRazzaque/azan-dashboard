require('module-alias/register');
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const dotenv = require('dotenv');
const ENV_FILE_PATH = process.env.ENV_FILE_PATH || path.join(__dirname, '../.env');
dotenv.config({ path: ENV_FILE_PATH });

const logger = require('@utils/logger');
logger.ensureLogDir(); // Ensure log directory exists early for the logger initializer

require('@utils/loggerInitializer')(); // Initialise global logger interception

const apiRoutes = require('@routes/index');
const { initScheduler } = require('@services/core/schedulerService');
const healthCheck = require('@services/system/healthCheck');
const { forceRefresh } = require('@services/core/prayerTimeService');

// nosemgrep: express-check-csurf-middleware-usage -- API-only backend using JWT in httpOnly cookies; CSRF middleware not needed for token-based auth
const app = express();

// Security Hardening
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "script-src": ["'self'", "'unsafe-inline'"], // Needed for some client-side logic
            "img-src": ["'self'", "data:", "https:"]
        }
    }
}));

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
        
        const envManager = require('@utils/envManager');

        // [REQ-006] Maintain persistent logs
        await logger.rotateLogs();

        // [REQ-004] Ensure robust security secrets exist
        if (!process.env.JWT_SECRET) {
            console.log('[Startup] JWT_SECRET missing. Generating a robust 64-byte key...');
            const secret = envManager.generateSecret(64);
            await envManager.setEnvValue('JWT_SECRET', secret);
        }

        if (!process.env.ENCRYPTION_SALT) {
            console.log('[Startup] ENCRYPTION_SALT missing. Generating a robust 32-byte salt...');
            const salt = envManager.generateSecret(32);
            await envManager.setEnvValue('ENCRYPTION_SALT', salt);
        }

        // Initialise Config Service
        const configService = require('@config');

        // Wire output resolvers BEFORE init to break circular dependency (config <-> outputs).
        // Resolvers use lazy require() inside the callback so the outputs barrel isn't
        // imported at module evaluation time — only when ConfigService actually calls them.
        const migrationService = require('@services/system/migrationService');
        configService.setOutputStrategyResolver((id) => require('@outputs').getStrategy(id));
        configService.setOutputSecretKeysResolver(() => require('@outputs').getSecretRequirementKeys());
        migrationService.setOutputSecretKeysResolver(() => require('@outputs').getSecretRequirementKeys());

        try {
            await configService.init();
            console.log('[Startup] ConfigService initialised.');
        } catch (e) {
            console.error('[Startup] Failed to initialise ConfigService:', e);
            process.exit(1);
        }
        
        // Initialise Health Cache explicitly
        healthCheck.init();
        
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
              // nosemgrep: unsafe-formatstring -- key and source.type are internal config values, not user HTTP input
              console.log(`  • ${key} (${source.type}) →`, source);
          }
        });

        // Run System Health Checks
        await healthCheck.runStartupChecks();

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
            await audioAssetService.ensureTestAudio();
            await audioAssetService.generateMetadataForExistingFiles();
        } catch (e) {
            console.error('[Startup] Failed to synchronise audio assets:', e.message);
        }

        // Run Asset Migration (non-blocking)
        const assetMigrationService = require('@services/system/assetMigrationService');
        assetMigrationService.migrateAll().catch(e => {
            console.error('[Startup] Asset migration failed:', e.message);
        });

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
