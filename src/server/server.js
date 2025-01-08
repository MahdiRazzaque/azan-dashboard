import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupAuthRoutes, startSessionCleanup } from '../auth/auth.js';
import { setupFeatureRoutes } from '../features/feature-manager.js';
import { setupPrayerRoutes, startPrayerTimeUpdates } from '../prayer/prayer-times.js';
import { scheduleNamazTimers } from '../scheduler/scheduler.js';
import { setupLogRoutes, initializeLogging } from '../logging/log-manager.js';
import { logSection } from '../utils/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../public')));

// Initialize all components
async function initializeServer() {
    logSection('Server Initialization');

    // Initialize logging first
    initializeLogging();

    // Setup routes
    setupAuthRoutes(app);
    setupFeatureRoutes(app);
    setupPrayerRoutes(app);
    setupLogRoutes(app);

    // Start session cleanup
    startSessionCleanup();

    // Start prayer time updates
    await startPrayerTimeUpdates();

    // Schedule initial namaz timers
    await scheduleNamazTimers();

    // Start server
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
        console.log(`🚀 Server is running on port ${port}`);
    });
}

export { initializeServer }; 