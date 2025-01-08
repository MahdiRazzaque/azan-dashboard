import { appConfig } from '../config/config-validator.js';

// Store logs in memory
const MAX_LOGS = 1000;
const logs = [];
const clients = new Set();

// Original console methods
const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
};

// Broadcast log to all connected clients
function broadcastLog(logEntry) {
    const deadClients = new Set();
    
    clients.forEach(client => {
        try {
            client.write(`data: ${JSON.stringify(logEntry)}\n\n`);
        } catch (error) {
            console.error('Error sending to client:', error.message);
            deadClients.add(client);
        }
    });
    
    // Cleanup dead clients
    deadClients.forEach(client => {
        clients.delete(client);
    });
}

// Add log entry
function addLog(level, message) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        level,
        message: typeof message === 'object' ? JSON.stringify(message) : message
    };

    logs.push(logEntry);
    if (logs.length > MAX_LOGS) {
        logs.shift();
    }

    broadcastLog(logEntry);
}

// Override console methods
function overrideConsole() {
    console.log = (...args) => {
        originalConsole.log(...args);
        addLog('info', args.join(' '));
    };

    console.error = (...args) => {
        originalConsole.error(...args);
        addLog('error', args.join(' '));
    };

    console.warn = (...args) => {
        originalConsole.warn(...args);
        addLog('warn', args.join(' '));
    };

    console.info = (...args) => {
        originalConsole.info(...args);
        addLog('info', args.join(' '));
    };
}

// Setup log routes
function setupLogRoutes(app) {
    // SSE endpoint for real-time logs
    app.get('/api/logs/stream', (req, res) => {
        if (!appConfig.features.systemLogsEnabled) {
            return res.status(403).json({ error: 'System logs are disabled' });
        }

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
        
        // Send initial heartbeat
        res.write('data: {"type":"connected","message":"Connected to log stream"}\n\n');
        
        // Send existing logs
        logs.forEach(log => {
            res.write(`data: ${JSON.stringify(log)}\n\n`);
        });
        
        // Add client to the Set
        clients.add(res);

        // Set up ping interval
        const pingInterval = setInterval(() => {
            try {
                res.write(': ping\n\n');
            } catch (error) {
                clearInterval(pingInterval);
                clients.delete(res);
            }
        }, 30000); // Send ping every 30 seconds

        // Handle client disconnect
        req.on('close', () => {
            clearInterval(pingInterval);
            clients.delete(res);
        });

        // Handle connection errors
        req.on('error', () => {
            clearInterval(pingInterval);
            clients.delete(res);
        });

        // Handle response errors
        res.on('error', () => {
            clearInterval(pingInterval);
            clients.delete(res);
        });
    });

    // Get all logs
    app.get('/api/logs', (req, res) => {
        if (!appConfig.features.systemLogsEnabled) {
            return res.status(403).json({ error: 'System logs are disabled' });
        }
        res.json(logs);
    });

    // Clear all logs
    app.post('/api/logs/clear', (req, res) => {
        if (!appConfig.features.systemLogsEnabled) {
            return res.status(403).json({ error: 'System logs are disabled' });
        }
        logs.length = 0;
        res.json({ success: true });
    });
}

// Initialize logging
function initializeLogging() {
    overrideConsole();
}

export {
    setupLogRoutes,
    initializeLogging
}; 