const BaseOutput = require('./BaseOutput');
const OutputFactory = require('./OutputFactory');
const axios = require('axios');
const fs = require('fs');
const ConfigService = require('../config');
const { voiceMonkeyQueue } = require('../utils/requestQueue');
const audioValidator = require('../utils/audioValidator');

class VoiceMonkeyOutput extends BaseOutput {
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

    async execute(payload, metadata) {
        if (!payload.source || !payload.source.url) return;
        
        // Metadata validation
        if (payload.source.filePath && fs.existsSync(payload.source.filePath + '.json')) {
            try {
                const meta = JSON.parse(fs.readFileSync(payload.source.filePath + '.json', 'utf8'));
                if (meta.vmCompatible === false) {
                    return; // Skip
                }
            } catch(e) {}
        }

        const config = ConfigService.get();
        // Prefer payload params, then config params
        const token = (payload.params && payload.params.token) || 
                      config.automation?.outputs?.voicemonkey?.params?.token;
        const device = (payload.params && payload.params.device) || 
                       config.automation?.outputs?.voicemonkey?.params?.device;
        
        const baseUrl = payload.baseUrl || config.automation?.baseUrl;

        if (!baseUrl || !baseUrl.startsWith('https://')) return;
        if (!token || !device) return;

        const publicUrl = payload.source.url.startsWith('http') 
            ? payload.source.url 
            : `${baseUrl}${payload.source.url}`;

        try {
            await voiceMonkeyQueue.schedule(() => axios.get('https://api-v2.voicemonkey.io/announcement', {
                params: {
                    token: token,
                    device: device,
                    audio: publicUrl
                }
            }));
        } catch (error) {
            throw error;
        }
    }

    async healthCheck(requestedParams) {
        const config = ConfigService.get();
        const token = config.automation?.outputs?.voicemonkey?.params?.token;
        const baseUrl = config.automation?.baseUrl;

        if (!baseUrl || !baseUrl.startsWith('https://')) {
            return { healthy: false, message: 'Offline: HTTPS Base URL required' };
        }
        if (!token) {
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
                return { healthy: true, message: 'Online' };
            } else {
                 throw new Error(response.data?.error || 'API Failure');
            }
        } catch (e) {
            return { healthy: false, message: e.message || 'Error' };
        }
    }

    async verifyCredentials(credentials) {
        if (!credentials.token || !credentials.device) {
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
                return { success: true };
            } else {
                 throw new Error(response.data?.error || 'Verification Failed');
            }
        } catch (error) {
            throw new Error(error.message || 'Verification Failed');
        }
    }

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
