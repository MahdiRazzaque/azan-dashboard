const BaseOutput = require('./BaseOutput');
const axios = require('axios');
const Bottleneck = require('bottleneck');
const ConfigService = require('../config');

/**
 * Strategy for triggering audio playback via the VoiceMonkey API (Alexa).
 */
class VoiceMonkeyOutput extends BaseOutput {
    /**
     * Rate limiter for VoiceMonkey API to prevent bans.
     * Observed Limit: Blocked after 170 reqs (15 min ban).
     * Safe Limit: 150 req / 15 min = 10 RPM.
     */
    static queue = new Bottleneck({
        minTime: 0,
        maxConcurrent: 5,
        reservoir: 5,
        reservoirRefreshAmount: 10,
        reservoirRefreshInterval: 60000 // 10 req / min
    });

    /**
     * Retrieves the metadata definition for the VoiceMonkey output strategy.
     * Defines the requirements for Alexa-compatible announcements, including
     * the mandatory HTTPS base URL and API authentication tokens.
     *
     * @returns {import('./BaseOutput').OutputMetadata} Strategy configuration object.
     */
    static getMetadata() {
        return {
            id: 'voicemonkey',
            label: 'VoiceMonkey (Alexa)',
            timeoutMs: 10000,
            defaultLeadTimeMs: 2000,
            hidden: false,
            supportedSourceTypes: ['file', 'url'],
            params: [
                { key: 'token', type: 'string', label: 'API Token', sensitive: true, requiredForHealth: true },
                { key: 'device', type: 'string', label: 'Device ID', sensitive: true, requiredForHealth: false }
            ]
        };
    }

    /**
     * Handles file-based audio sources. Constructs a public URL and sends to the API.
     * Sidecar compatibility is checked by BaseOutput.execute() before this hook runs.
     *
     * @param {Object} payload - Payload with normalized source ({ type: 'file', filePath, url }).
     * @param {Object} metadata - Execution context flags (isTest, etc).
     * @param {AbortSignal} [signal] - Optional signal to abort the network request.
     * @returns {Promise<void>}
     */
    async _executeFromFile(payload, metadata, signal) {
        const prefix = this._getLogPrefix(metadata);

        const audioUrl = this._resolvePublicUrl(payload.source.url, payload, prefix);
        if (!audioUrl) return;

        await this._sendToApi(audioUrl, payload, prefix, signal);
    }

    /**
     * Handles URL-based audio sources. Validates HTTPS and sends directly to the API.
     *
     * @param {Object} payload - Payload with normalized source ({ type: 'url', url }).
     * @param {Object} metadata - Execution context flags (isTest, etc).
     * @param {AbortSignal} [signal] - Optional signal to abort the network request.
     * @returns {Promise<void>}
     */
    async _executeFromUrl(payload, metadata, signal) {
        const prefix = this._getLogPrefix(metadata);
        const audioUrl = payload.source.url;

        // REQ-001: Alexa requires audio URLs to be served over HTTPS.
        if (!audioUrl.startsWith('https://')) {
            console.warn(`${prefix} Skipped: Alexa requires HTTPS audio URL`);
            return;
        }

        await this._sendToApi(audioUrl, payload, prefix, signal);
    }

    /**
      * Returns the log prefix based on test mode.
      * @param {Object} metadata - Execution metadata.
      * @returns {string} Formatted log prefix string.
      * @private
      */
    _getLogPrefix(metadata) {
        return metadata?.isTest ? '[Test Output: VoiceMonkey]' : '[Output: VoiceMonkey]';
    }

    /**
     * Resolves the final public URL for the VoiceMonkey API.
     * Absolute URLs (http/https) pass through; relative URLs are prefixed
     * with the configured HTTPS base URL.
     *
     * @param {string} sourceUrl - The source URL (relative or absolute).
     * @param {Object} payload - The full payload (for baseUrl and params).
     * @param {string} prefix - Log prefix.
     * @returns {string|null} The resolved URL, or null if requirements not met.
     * @private
     */
    _resolvePublicUrl(sourceUrl, payload, prefix) {
        if (sourceUrl.startsWith('http')) return sourceUrl;

        const config = ConfigService.get();
        const baseUrl = payload.baseUrl || config.automation?.baseUrl;

        // REQ-001: Alexa requires public URLs to be served over HTTPS.
        if (!baseUrl || !baseUrl.startsWith('https://')) {
            console.warn(`${prefix} Skipped: HTTPS Base URL required`);
            return null;
        }

        return `${baseUrl}${sourceUrl}`;
    }

    /**
     * Sends the audio URL to the VoiceMonkey API via the rate-limited queue.
     *
     * @param {string} audioUrl - The fully-resolved public audio URL.
     * @param {Object} payload - The full payload (for params).
     * @param {string} prefix - Log prefix.
     * @param {AbortSignal} [signal] - Optional abort signal.
     * @returns {Promise<void>}
     * @private
     */
    async _sendToApi(audioUrl, payload, prefix, signal) {
        const config = ConfigService.get();
        const token = (payload.params && payload.params.token) ||
                      config.automation?.outputs?.voicemonkey?.params?.token;
        const device = (payload.params && payload.params.device) ||
                       config.automation?.outputs?.voicemonkey?.params?.device;

        if (!token || !device) {
            console.warn(`${prefix} Skipped: Token or Device ID missing`);
            return;
        }

        console.log(`${prefix} Triggering announcement for device: ${device}`);

        try {
            await VoiceMonkeyOutput.queue.schedule(() => axios.get('https://api-v2.voicemonkey.io/announcement', {
                params: { token, device, audio: audioUrl },
                signal, // REQ-007: Support aborting network requests on timeout
                maxContentLength: 5000000
            }));
            console.log(`${prefix} Announcement triggered successfully`);
        } catch (error) {
            if (error.name === 'CanceledError' || error.name === 'AbortError') {
                console.warn(`${prefix} Execution aborted due to timeout`);
                return;
            }
            console.error(`${prefix} Trigger failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Checks the health of the VoiceMonkey integration by attempting a lightweight API call.
     * Uses a dummy device ID to ensure the check remains silent and doesn't wake actual devices.
     *
     * @param {Object} [requestedParams] Optional credentials to test instead of config.
     * @returns {Promise<{healthy: boolean, message: string}>} The health status result.
     */
    async healthCheck(requestedParams) {
        console.log('[Output: VoiceMonkey] Starting health check');
        const config = ConfigService.get();
        // Use provided token (e.g. during credential verification) or fallback to saved config
        const token = (requestedParams && requestedParams.token) ||
                      config.automation?.outputs?.voicemonkey?.params?.token;
        const baseUrl = config.automation?.baseUrl;

        if (!baseUrl || !baseUrl.startsWith('https://')) {
            console.log('[Output: VoiceMonkey] Health: Offline (HTTPS Base URL required)');
            return { healthy: false, message: 'Offline: HTTPS Base URL required' };
        }
        if (!token) {
            console.log('[Output: VoiceMonkey] Health: Offline (Token Missing)');
            return { healthy: false, message: 'Token Missing' };
        }

        // Always use a random device for health checks to ensure they are silent (REQ-004)
        const deviceToCheck = `azan_check_${Date.now()}`;

        try {
            const response = await VoiceMonkeyOutput.queue.schedule(() => axios.get('https://api-v2.voicemonkey.io/announcement', {
                params: {
                    token: token,
                    device: deviceToCheck,
                    text: 'Test'
                },
                timeout: 5000,
                maxContentLength: 5000000
            }));

            if (response.data && response.data.success === true) {
                console.log('[Output: VoiceMonkey] Health: Online');
                return { healthy: true, message: 'Online' };
            } else {
                 throw new Error(response.data?.error || 'API Failure');
            }
        } catch (e) {
            console.log(`[Output: VoiceMonkey] Health: Offline (${e.message || 'Error'})`);
            return { healthy: false, message: e.message || 'Error' };
        }
    }

    /**
     * Validates the provided credentials by attempting to send a test announcement.
     * This is used during the settings configuration flow.
     *
     * @param {Object} credentials The token and device ID to verify.
     * @returns {Promise<{success: boolean}>} Object indicating if the credentials are valid.
     * @throws {Error} If verification fails or parameters are missing.
     */
    async verifyCredentials(credentials) {
        console.log('[Output: VoiceMonkey] Verifying credentials');
        if (!credentials.token || !credentials.device) {
            console.log('[Output: VoiceMonkey] Verification failed: Missing token or device');
            throw new Error('Missing token or device');
        }

        try {
            const response = await VoiceMonkeyOutput.queue.schedule(() => axios.get('https://api-v2.voicemonkey.io/announcement', {
                params: {
                    token: credentials.token,
                    device: credentials.device,
                    text: 'Test'
                },
                timeout: 5000,
                maxContentLength: 5000000
            }));
             if (response.data && response.data.success === true) {
                console.log('[Output: VoiceMonkey] Verification: OK');
                return { success: true };
            } else {
                 throw new Error(response.data?.error || 'Verification Failed');
            }
        } catch (error) {
            console.log(`[Output: VoiceMonkey] Verification failed: ${error.message}`);
            throw new Error(error.message || 'Verification Failed');
        }
    }

    /**
     * Validates if a specific trigger is compatible with the Alexa output.
     * Checks if the associated audio file meets VoiceMonkey requirements.
     *
     * @param {Object} trigger The trigger configuration to check.
     * @param {Object} context The current scheduling context.
     * @returns {string[]} List of warning messages.
     */
    validateTrigger(trigger, context) {
        const warnings = [];
        const { audioFiles, prayer, triggerType, niceName } = context;

        const file = audioFiles.find(f =>
            (trigger.type === 'file' && f.path === trigger.path) ||
            (trigger.type === 'tts' && f.name === `tts_${prayer}_${triggerType}.mp3`)
        );

        if (file) {
            // REQ-015: Read from nested compatibility object only
            const isCompatible = file.compatibility?.voicemonkey?.valid;

            if (isCompatible === false) {
                const issues = file.compatibility?.voicemonkey?.issues || ['Unknown issues'];
                warnings.push(`${niceName}: Audio incompatible with Alexa (${issues.join(', ')})`);
            }
        }

        return warnings;
    }

    /**
     * Internal helper to validate metadata against VoiceMonkey requirements.
     * Alexa requires MP3, AAC, OGG, OPUS or WAV format, bitrate <= 1411.2kbps, 
     * sample rate <= 48kHz, file size <= 10MB, and duration <= 240s.
     * 
     * @param {Object} metadata Audio metadata.
     * @returns {string[]} List of issues found.
     * @private
     */
    static _getValidationIssues(metadata) {
        const issues = [];
        
        // 1. Format Check (Alexa supports: aac, mp3, ogg, opus, wav)
        const allowedMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/opus', 'audio/aac'];
        if (metadata.mimeType && !allowedMimeTypes.includes(metadata.mimeType)) {
            issues.push(`Unsupported format: ${metadata.format} / ${metadata.codec} (${metadata.mimeType}). Alexa requires MP3, AAC, OGG, OPUS or WAV.`);
        } else if (!metadata.mimeType) {
            // Fallback to manual check if mimeType is missing (shouldn't happen with latest validator)
            const format = (metadata.format || '').toLowerCase();
            const codec = (metadata.codec || '').toLowerCase();
            const isMP3 = format.includes('mp3') || codec.includes('mp3') || (format === 'mpeg' && codec.includes('3'));
            const isWAV = format.includes('wav');
            const isOGG = format.includes('ogg') || codec.includes('vorbis') || codec.includes('opus');
            const isAAC = format.includes('aac') || format.includes('adts') || codec.includes('aac');

            if (!isMP3 && !isWAV && !isOGG && !isAAC) {
                issues.push(`Unsupported format: ${metadata.format} / ${metadata.codec}. Alexa requires MP3, AAC, OGG, OPUS or WAV.`);
            }
        }

        // 2. Bitrate (Max 1411.2 kbps)
        if (metadata.bitrate) {
            const bitrateKbps = metadata.bitrate / 1000;
            if (bitrateKbps > 1411.2) {
                issues.push(`Bitrate too high: ${bitrateKbps.toFixed(2)} kbps (Max 1411.2 kbps)`);
            }
        }

        // 3. Sample Rate (Max 48kHz)
        if (metadata.sampleRate) {
            const sampleRateKhz = metadata.sampleRate / 1000;
            if (sampleRateKhz > 48) {
                issues.push(`Sample rate too high: ${sampleRateKhz.toFixed(2)} kHz (Max 48 kHz)`);
            }
        }

        // 4. File Size (Max 10MB)
        if (metadata.size) {
            const sizeMb = metadata.size / (1024 * 1024);
            if (sizeMb > 10) {
                issues.push(`File size too large: ${sizeMb.toFixed(2)} MB (Max 10 MB)`);
            }
        }

        // 5. Duration (Max 240s)
        if (metadata.duration && metadata.duration > 240) {
            issues.push(`Duration too long: ${metadata.duration.toFixed(2)}s (Max 240s)`);
        }

        return issues;
    }

    /**
     * Validates an audio asset for compatibility with VoiceMonkey/Alexa.
     * 
     * @param {string} filePath - Path to the audio file.
     * @param {Object} metadata - Audio metadata.
     * @returns {Promise<{valid: boolean, lastChecked: string, issues: string[]}>} A promise that resolves to the validation result.
     */
    async validateAsset(filePath, metadata) {
        const issues = VoiceMonkeyOutput._getValidationIssues(metadata);

        return {
            valid: issues.length === 0,
            lastChecked: new Date().toISOString(),
            issues
        };
    }
}

// Log queue status if needed for debugging
VoiceMonkeyOutput.queue.on('failed', (error, jobInfo) => {
    console.warn(`[Queue:VoiceMonkey] Job ${jobInfo.options.id} failed: ${error.message}`);
});

module.exports = VoiceMonkeyOutput;