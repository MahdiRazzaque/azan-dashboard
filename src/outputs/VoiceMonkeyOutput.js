const BaseOutput = require('./BaseOutput');
const OutputFactory = require('./OutputFactory');
const axios = require('axios');
const fs = require('fs');
const ConfigService = require('../config');
const { voiceMonkeyQueue } = require('../utils/requestQueue');
const audioValidator = require('../utils/audioValidator');

class VoiceMonkeyOutput extends BaseOutput {
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
            leadTimeConstraints: { min: 0, max: 5000 },
            hidden: false,
            compatibilityKey: 'vmCompatible',
            params: [
                { key: 'token', type: 'string', label: 'API Token', sensitive: true, requiredForHealth: true },
                { key: 'device', type: 'string', label: 'Device ID', sensitive: true, requiredForHealth: false }
            ]
        };
    }

    /**
     * Executes the VoiceMonkey announcement via the remote API.
     * Validates that the audio is Alexa-compatible and that the system's
     * base URL is secured with HTTPS, as required by Amazon.
     *
     * @param {Object} payload The announcement data including source URL and parameters.
     * @param {import('./BaseOutput').ExecutionMetadata} metadata Execution context flags.
     * @param {AbortSignal} [signal] Optional signal to abort the network request.
     * @returns {Promise<void>}
     */
    async execute(payload, metadata, signal) {
        const isTest = metadata?.isTest;
        const prefix = isTest ? '[Test Output: VoiceMonkey]' : '[Output: VoiceMonkey]';

        if (!payload.source || !payload.source.url) return;

        // Verify compatibility metadata stored alongside the audio file.
        // If the validator previously flagged this file as incompatible, we skip execution.
        if (payload.source.filePath && fs.existsSync(payload.source.filePath + '.json')) {
            try {
                const meta = JSON.parse(fs.readFileSync(payload.source.filePath + '.json', 'utf8'));
                if (meta.vmCompatible === false) {
                    console.warn(`${prefix} Skipped: Audio incompatible with Alexa`);
                    return; // Skip
                }
            } catch(e) {}
        }

        const config = ConfigService.get();
        // Prefer parameters provided in the trigger payload, then fall back to global config.
        const token = (payload.params && payload.params.token) ||
                      config.automation?.outputs?.voicemonkey?.params?.token;
        const device = (payload.params && payload.params.device) ||
                       config.automation?.outputs?.voicemonkey?.params?.device;

        const baseUrl = payload.baseUrl || config.automation?.baseUrl;

        // REQ-001: Alexa requires public URLs to be served over HTTPS.
        if (!baseUrl || !baseUrl.startsWith('https://')) {
            console.warn(`${prefix} Skipped: HTTPS Base URL required`);
            return;
        }
        if (!token || !device) {
            console.warn(`${prefix} Skipped: Token or Device ID missing`);
            return;
        }

        const publicUrl = payload.source.url.startsWith('http')
            ? payload.source.url
            : `${baseUrl}${payload.source.url}`;

        console.log(`${prefix} Triggering announcement for device: ${device}`);

        try {
            // Use the request queue to prevent rate-limiting by the VoiceMonkey API.
            await voiceMonkeyQueue.schedule(() => axios.get('https://api-v2.voicemonkey.io/announcement', {
                params: {
                    token: token,
                    device: device,
                    audio: publicUrl
                },
                signal // REQ-007: Support aborting network requests on timeout
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
     * @returns {Promise<{healthy: boolean, message: string}>} status report.
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
            const response = await voiceMonkeyQueue.schedule(() => axios.get('https://api-v2.voicemonkey.io/announcement', {
                params: {
                    token: token,
                    device: deviceToCheck,
                    text: 'Test'
                },
                timeout: 5000
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
            const response = await voiceMonkeyQueue.schedule(() => axios.get('https://api-v2.voicemonkey.io/announcement', {
                params: {
                    token: credentials.token,
                    device: credentials.device,
                    text: 'Test'
                },
                timeout: 5000
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

        if (file && file.vmCompatible === false) {
            warnings.push(`${niceName}: Audio incompatible with Alexa (${file.vmIssues?.join(', ') || 'Unknown issues'})`);
        }

        return warnings;
    }

    /**
     * Enhances audio metadata with VoiceMonkey compatibility flags.
     * Uses the audio validator to determine if the bit rate, format,
     * and length are acceptable for Alexa devices.
     *
     * @param {Object} metadata Existing file metadata.
     * @returns {Object} Augmented metadata with 'vmCompatible' and 'vmIssues'.
     */
    augmentAudioMetadata(metadata) {
        const status = audioValidator.validateVoiceMonkeyCompatibility(metadata);
        return {
            vmCompatible: status.vmCompatible,
            vmIssues: status.vmIssues
        };
    }
}

OutputFactory.register(VoiceMonkeyOutput);
module.exports = VoiceMonkeyOutput;
