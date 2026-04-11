const path = require('path');

const FILENAME_ALLOWLIST = /^[a-zA-Z0-9._-]+$/;

/**
 * Sanitises a filename for safe filesystem use.
 * Strips path components via path.basename(), rejects traversal attempts,
 * and validates against an alphanumeric allowlist.
 *
 * @param {string} filename - The raw filename to sanitise.
 * @returns {string|null} The sanitised filename, or null if invalid.
 */
function sanitiseFilename(filename) {
    const raw = String(filename);
    const sanitised = path.basename(raw);

    if (
        !sanitised ||
        sanitised === '.' ||
        sanitised === '..' ||
        sanitised !== raw ||
        !FILENAME_ALLOWLIST.test(sanitised)
    ) {
        return null;
    }

    return sanitised;
}

/**
 * Returns whether a file path is contained within an allowed root directory.
 * Uses path.relative() to detect escape via absolute paths or .. traversal.
 *
 * @param {string} filePath - The file path to check.
 * @param {string} allowedRoot - The root directory that must contain filePath.
 * @returns {boolean} True if filePath is within allowedRoot, false otherwise.
 */
function isPathContained(filePath, allowedRoot) {
    const relativePath = path.relative(allowedRoot, filePath);
    return !path.isAbsolute(relativePath) && relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`);
}

module.exports = { sanitiseFilename, isPathContained, FILENAME_ALLOWLIST };
