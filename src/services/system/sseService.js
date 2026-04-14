const logger = require("@utils/logger");

let clients = [];
const logHistory = [];
const MAX_HISTORY = 1000;

/**
 * Initialises and adds a new client to the SSE (Server-Sent Events) stream.
 *
 * @param {import('express').Response} res - The Express response object for the SSE connection.
 * @returns {void}
 */
const addClient = (res) => {
  // Send initial ping or retry info
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("retry: 10000\n\n");

  clients.push(res);
  console.log(`[SSE] Client connected. Total clients: ${clients.length}`);

  // Send history
  if (logHistory.length > 0) {
    logHistory.forEach((logEntry) => {
      // Frontend expects { type: 'LOG', payload: ... }
      res.write(
        `data: ${JSON.stringify({ type: "LOG", payload: logEntry })}\n\n`,
      );
    });
  }

  res.on("close", () => {
    clients = clients.filter((c) => c !== res);
    console.log(`[SSE] Client disconnected. Total clients: ${clients.length}`);
  });
};

/**
 * Broadcasts data to all currently connected SSE clients.
 *
 * @param {Object} data - The data object to broadcast.
 * @returns {void}
 */
const broadcast = (data) => {
  clients.forEach((client) => {
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  });
};

/**
 * Logs a message, stores it in the local history, and broadcasts it to all connected SSE clients.
 *
 * @param {string} message - The log message.
 * @param {string} [level='info'] - The log level (e.g., 'info', 'warn', 'error').
 * @returns {void}
 */
const log = (message, level = "info") => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  // Add to history
  logHistory.push(entry);
  if (logHistory.length > MAX_HISTORY) {
    logHistory.shift();
  }

  // [REQ-006] Write to persistent log file
  logger.writeToFile(entry).catch((err) => {
    console.error("[SSEService] Failed to write log to file:", err.message);
  });

  // Broadcast wrapped in LOG type to match frontend expectations
  broadcast({ type: "LOG", payload: entry });
};

// Keep connections alive with heartbeat (every 30s)
setInterval(() => {
  clients.forEach((client) => {
    client.write(": heartbeat\n\n");
  });
}, 30000).unref();

module.exports = { addClient, broadcast, log };
