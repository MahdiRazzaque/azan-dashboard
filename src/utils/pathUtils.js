const path = require('path');

/**
 * Checks whether a target path resolves inside a root directory boundary.
 * @param {string} rootPath - Allowed root directory.
 * @param {string} targetPath - Target path to validate.
 * @returns {boolean} True when targetPath is within rootPath.
 */
function isWithinRoot(rootPath, targetPath) {
    const resolvedRoot = path.resolve(rootPath);
    const resolvedTarget = path.resolve(targetPath);
    const relativePath = path.relative(resolvedRoot, resolvedTarget);
    return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

module.exports = {
    isWithinRoot
};
