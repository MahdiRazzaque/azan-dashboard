const BaseOutput = require('./BaseOutput');
const sseService = require('../services/system/sseService');

class BrowserOutput extends BaseOutput {
    /**
     * Retrieves the metadata for the Browser (SSE) output strategy.
     *
     * @returns {Object} The strategy metadata including ID, label, and parameters.
     */
    static getMetadata() {
        return {
            id: 'browser',
            label: 'Browser (SSE)',
            timeoutMs: 1000,
            hidden: true,  // Excluded from UI selection
            params: []
        };
    }

    /**
     * Executes the audio playback broadcast to all connected web clients via SSE.
     *
     * @param {Object} payload - The execution payload containing audio source information.
     * @param {Object} metadata - Additional metadata for the execution.
     * @param {AbortSignal} _signal - An optional signal to abort the execution.
     * @returns {Promise<void>} A promise that resolves when the broadcast is complete.
     */
    async execute(payload, metadata, _signal) {
        const isTest = metadata?.isTest;
        const prefix = isTest ? '[Test Output: Browser]' : '[Output: Browser]';

        if (!payload.source || !payload.source.url) {
            console.warn(`${prefix} Broadcast skipped: No source URL provided`);
            return;
        }

        console.log(`${prefix} Broadcasting playback to all clients: ${payload.source.url}`);

        // Broadcast the audio playback event to all clients connected via Server-Sent Events (SSE).
        sseService.broadcast({
            type: 'AUDIO_PLAY',
            payload: {
                prayer: payload.prayer,
                event: payload.event,
                url: payload.source.url
            }
        });
        console.log(`${prefix} Broadcast complete`);
    }

    /**
     * Performs a health check for the browser output strategy.
     *
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
     *
     * @param {Object} _credentials - The credentials to verify.
     * @returns {Promise<Object>} The verification result.
     */
    async verifyCredentials(_credentials) {
        console.log('[Output: Browser] Verifying credentials');
        console.log('[Output: Browser] Verification: OK');
        return { success: true };
    }
}

module.exports = BrowserOutput;
