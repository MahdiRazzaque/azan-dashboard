const fs = require("fs");
const fsAsync = require("fs/promises");
const path = require("path");
const { DateTime } = require("luxon");

const LOG_DIR = path.join(__dirname, "../../logs");
const MAX_FILES = 10;

/**
 * Ensures the log directory exists.
 */
const ensureLogDir = () => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

/**
 * Returns the path to the current log file.
 * Format: session-YYYY-MM-DD.log
 *
 * @returns {string} The full path to the current log file.
 */
const getLogFilePath = () => {
  const date = DateTime.now().toISODate();
  return path.join(LOG_DIR, `session-${date}.log`);
};

/**
 * Rotates log files, keeping only the most recent ones.
 * Reads all session-*.log files and deletes oldest ones if count > MAX_FILES.
 *
 * @returns {Promise<void>}
 */
const rotateLogs = async () => {
  try {
    ensureLogDir();
    const files = await fsAsync.readdir(LOG_DIR);
    const logFiles = [];

    for (const file of files) {
      if (file.startsWith("session-") && file.endsWith(".log")) {
        const filePath = path.join(LOG_DIR, file);
        try {
          const stats = await fsAsync.stat(filePath);
          logFiles.push({ name: file, path: filePath, mtime: stats.mtimeMs });
        } catch {
          // Skip if file disappeared or error
        }
      }
    }

    // Sort by modified time descending (newest first)
    logFiles.sort((a, b) => b.mtime - a.mtime);

    if (logFiles.length > MAX_FILES) {
      const toDelete = logFiles.slice(MAX_FILES);
      for (const file of toDelete) {
        try {
          await fsAsync.unlink(file.path);
        } catch {
          // Ignore errors during deletion
        }
      }
    }
  } catch {
    // Fail silently to avoid breaking the application due to logging issues
  }
};

/**
 * Appends a log entry to the current log file.
 * Includes timestamp and log level.
 *
 * @param {Object} entry - The log entry object { timestamp, level, message }.
 * @returns {Promise<void>}
 */
const writeToFile = async (entry) => {
  try {
    // [REF] Removed ensureLogDir() from hot path.
    // It is now called once during startup.
    const filePath = getLogFilePath();
    const formatted = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}\n`;

    // Append to file using promises API for non-blocking I/O
    await fsAsync.appendFile(filePath, formatted);
  } catch {
    // Fail silently
  }
};

module.exports = {
  writeToFile,
  rotateLogs,
  ensureLogDir,
  LOG_DIR,
};
