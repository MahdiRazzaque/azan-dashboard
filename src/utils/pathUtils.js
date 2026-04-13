const path = require('path');

/**
 * Checks whether a target path resolves inside a root directory boundary.
 * @param {string} rootPath - Allowed root directory.
 * @param {string} targetPath - Target path to validate.
 * @returns {boolean} True when targetPath is within rootPath.
 */
function isWithinRoot(rootPath, targetPath) {
    if (!path.isAbsolute(rootPath) || !path.isAbsolute(targetPath)) {
        return false;
    }

    const normalizedRoot = path.normalize(rootPath);
    const normalizedTarget = path.normalize(targetPath);
    const relativePath = path.relative(normalizedRoot, normalizedTarget);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

module.exports = {
    isWithinRoot
};
