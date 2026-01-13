const express = require('express');
const path = require('path');

const apiRoutes = require('./routes/api');
const { initScheduler } = require('./services/schedulerService');
const { checkSystemHealth } = require('./services/healthCheck');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, '../client/dist')));

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

    // Run System Health Checks
    await checkSystemHealth();

    // Start Scheduler
    await initScheduler();
  });
}

module.exports = app;
