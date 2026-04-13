const path = require('path');
const { isWithinRoot } = require('./pathUtils');

const AUDIO_ROOT = path.resolve(__dirname, '../../public/audio');
const PUBLIC_AUDIO_PREFIX = '/public/audio/';

/**
 * Normalizes any source shape into a canonical ExecutionSource.
 *
 * Accepted input shapes:
 * - { path }                       (OutputStrategyCard test flow)
 * - { path }                       (automationService.getAudioSource — tts/file)
 * - { url }                        (automationService.getAudioSource — url)
 * - { path, url, filePath: null }  (FileManagerView)
 * - { url }                        (external URL or relative server URL)
 * - { type: 'file', filePath, url } (already normalized)
 * - { type: 'url', url }            (already normalized)
 *
 * @param {Object} source - Raw source object from any caller.
 * @returns {{ type: 'file', filePath: string, url: string } | { type: 'url', url: string }} Canonical ExecutionSource object.
 * @throws {Error} If source is invalid, contains path traversal, or uses forbidden URL protocol.
 */
function normalizeSource(source) {
    if (!source || typeof source !== 'object') {
        throw new Error('Invalid source: must be a non-null object');
    }

    if (source.type === 'file') {
        const hasFilePath = typeof source.filePath === 'string' && source.filePath.length > 0;
        const hasUrl = typeof source.url === 'string' && source.url.length > 0;

        if (!hasFilePath && !hasUrl) {
            throw new Error('Invalid source: typed file source requires filePath or url');
        }

        if (hasUrl && _hasProtocol(source.url)) {
            _validateUrlProtocol(source.url);
        }

        return _buildFileSource(source, false, hasFilePath, hasUrl);
    }
    if (source.type === 'url') {
        if (typeof source.url !== 'string' || source.url.length === 0) {
            throw new Error('Invalid source: typed url source requires url');
        }

        _validateUrlProtocol(source.url);
        return { type: 'url', url: source.url };
    }

    const hasPath = typeof source.path === 'string' && source.path.length > 0;
    const hasFilePath = typeof source.filePath === 'string' && source.filePath.length > 0;
    const hasUrl = typeof source.url === 'string' && source.url.length > 0;

    if (!hasPath && !hasFilePath && !hasUrl) {
        throw new Error('Invalid source: must contain at least one of path, filePath, or url');
    }

    if (hasUrl && _hasProtocol(source.url)) {
        _validateUrlProtocol(source.url);
        return { type: 'url', url: source.url };
    }

    if (hasPath || hasFilePath || hasUrl) {
        return _buildFileSource(source, hasPath, hasFilePath, hasUrl);
    }

    throw new Error('Invalid source: could not determine source type');
}

/**
 * Checks if a string has a URL protocol scheme.
 * @param {string} url - The URL string to check.
 * @returns {boolean} True if the URL has a protocol scheme.
 */
function _hasProtocol(url) {
     return /^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(url);
 }

/**
 * Validates that a URL uses http or https protocol.
 * @param {string} url - The URL string to validate.
 * @throws {Error} If the URL does not use http or https protocol.
 */
function _validateUrlProtocol(url) {
     if (!/^https?:\/\//i.test(url)) {
         throw new Error('Only http and https URLs are allowed');
     }
 }

/**
 * Builds a normalized file source object from various input shapes.
 * @param {Object} source - The raw source object.
 * @param {boolean} hasPath - Whether the source has a path property.
 * @param {boolean} hasFilePath - Whether the source has a filePath property.
 * @param {boolean} hasUrl - Whether the source has a url property.
 * @returns {{ type: 'file', filePath: string, url: string }} Normalized file source object.
 */
function _buildFileSource(source, hasPath, hasFilePath, hasUrl) {
    let relativePath;

    if (hasPath) {
        relativePath = source.path.replace(/^\//, '');
    } else if (hasFilePath) {
        relativePath = path.relative(AUDIO_ROOT, source.filePath);
    } else if (hasUrl && source.url.startsWith(PUBLIC_AUDIO_PREFIX)) {
        relativePath = source.url.slice(PUBLIC_AUDIO_PREFIX.length);
    } else {
        throw new Error('Invalid source: could not determine source type');
    }

    const absolutePath = hasFilePath ? source.filePath : path.resolve(AUDIO_ROOT, relativePath);
    _validatePathTraversal(absolutePath);

    const url = hasUrl ? source.url : `${PUBLIC_AUDIO_PREFIX}${relativePath}`;

    return { type: 'file', filePath: absolutePath, url };
}

/**
 * Validates that an absolute path does not traverse outside the audio directory.
 * @param {string} absolutePath - The absolute file path to validate.
 * @throws {Error} If the path traverses outside the audio directory.
 */
function _validatePathTraversal(absolutePath) {
    if (!isWithinRoot(AUDIO_ROOT, absolutePath)) {
        throw new Error('Path traversal detected: resolved path is outside audio directory');
    }
}

module.exports = normalizeSource;
