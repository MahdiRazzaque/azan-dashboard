const BaseOutput = require('./BaseOutput');
const OutputFactory = require('./OutputFactory');
const sseService = require('../services/system/sseService');

class BrowserOutput extends BaseOutput {
    static getMetadata() {
        return {
            id: 'browser',
            label: 'Browser (SSE)',
            timeoutMs: 1000,
            hidden: true,  // Excluded from UI selection
            params: []
        };
    }

    async execute(payload, metadata) {
        const isTest = metadata?.isTest;
        const prefix = isTest ? '[Test Output: Browser]' : '[Output: Browser]';

        if (!payload.source || !payload.source.url) {
            console.warn(`${prefix} Broadcast skipped: No source URL provided`);
            return;
        }

        console.log(`${prefix} Broadcasting playback to all clients: ${payload.source.url}`);

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

    async healthCheck(requestedParams) {
        console.log('[Output: Browser] Starting health check');
        console.log('[Output: Browser] Health: Ready');
        return { healthy: true, message: 'Ready' };
    }

    async verifyCredentials(credentials) {
        console.log('[Output: Browser] Verifying credentials');
        console.log('[Output: Browser] Verification: OK');
        return { success: true };
    }
}

OutputFactory.register(BrowserOutput);
module.exports = BrowserOutput;
