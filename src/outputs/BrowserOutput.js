const BaseOutput = require('./BaseOutput');
const sseService = require('../services/system/sseService');

class BrowserOutput extends BaseOutput {
    /**
     * Retrieves the metadata for the Browser (SSE) output strategy.
     * @returns {Object} The strategy metadata including ID, label, and parameters.
     */
    static getMetadata() {
        return {
            id: 'browser',
            label: 'Browser (SSE)',
            supportedSourceTypes: ['file', 'url'],
            timeoutMs: 1000,
            hidden: true,
            params: []
        };
    }

    /**
     * Broadcasts a file source's URL to all connected clients.
     * @param {Object} payload - Payload with normalized source ({ type: 'file', filePath, url }).
     * @param {Object} metadata - Execution metadata.
     * @returns {Promise<void>}
     */
    async _executeFromFile(payload, metadata) {
        this._broadcastUrl(payload.source.url, payload, metadata);
    }

    /**
     * Broadcasts a remote URL to all connected clients.
     * @param {Object} payload - Payload with normalized source ({ type: 'url', url }).
     * @param {Object} metadata - Execution metadata.
     * @returns {Promise<void>}
     */
    async _executeFromUrl(payload, metadata) {
        this._broadcastUrl(payload.source.url, payload, metadata);
    }

    /**
     * Broadcasts an audio URL via SSE to all connected web clients.
     * @param {string} url - The audio URL to broadcast.
     * @param {Object} payload - The execution payload.
     * @param {Object} metadata - Execution metadata.
     */
    _broadcastUrl(url, payload, metadata) {
        const isTest = metadata?.isTest;
        const prefix = isTest ? '[Test Output: Browser]' : '[Output: Browser]';

        console.log(`${prefix} Broadcasting playback to all clients: ${url}`);
        sseService.broadcast({
            type: 'AUDIO_PLAY',
            payload: {
                prayer: payload.prayer,
                event: payload.event,
                url
            }
        });
        console.log(`${prefix} Broadcast complete`);
    }

    /**
     * Performs a health check for the browser output strategy.
     * @param {Object} _requestedParams - The parameters to check.
     * @returns {Promise<Object>} The health status result.
     */
    async healthCheck(_requestedParams) {
        console.log('[Output: Browser] Starting health check');
        console.log('[Output: Browser] Health: Ready');
        return { healthy: true, message: 'Ready' };
    }

    /**
     * Verifies the credentials for the browser output strategy.
     * @param {Object} _credentials - The credentials to verify.
     * @returns {Promise<Object>} The verification result.
     */
    async verifyCredentials(_credentials) {
        console.log('[Output: Browser] Verifying credentials');
        console.log('[Output: Browser] Verification: OK');
        return { success: true };
    }

    /**
     * Validates an audio asset for compatibility with the browser output strategy.
     * @param {string} _filePath - Path to the audio file.
     * @param {Object} _metadata - Audio metadata.
     * @returns {Promise<Object>} The validation result.
     */
    async validateAsset(_filePath, _metadata) {
        return {
            valid: true,
            lastChecked: new Date().toISOString(),
            issues: []
        };
    }
}

module.exports = BrowserOutput;
