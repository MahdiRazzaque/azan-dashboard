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
        if (!payload.source || !payload.source.url) return;

        sseService.broadcast({
            type: 'AUDIO_PLAY',
            payload: {
                prayer: payload.prayer,
                event: payload.event,
                url: payload.source.url
            }
        });
    }

    async healthCheck(requestedParams) {
        return { healthy: true, message: 'Ready' };
    }

    async verifyCredentials(credentials) {
        return { success: true };
    }
}

OutputFactory.register(BrowserOutput);
module.exports = BrowserOutput;
