const fs = require('fs');
const path = require('path');
const player = require('play-sound')({});
const axios = require('axios');
const configService = require('@config'); // Singleton
const sseService = require('@services/system/sseService');
const { voiceMonkeyQueue } = require('@utils/requestQueue');

const AUDIO_DIR = path.join(__dirname, '../../../public/audio');
const META_DIR = path.join(__dirname, '../../public/audio');

/**
 * Resolves the audio source path and URL based on the trigger settings.
 * 
 * @param {Object} settings - The trigger settings for the specific prayer event.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event (e.g., preAdhan, adhan).
 * @returns {Object} An object containing the absolute file path and relative URL of the audio.
 */
const getAudioSource = (settings, prayer, event) => {
    if (settings.type === 'tts') {
        const filename = `tts_${prayer}_${event}.mp3`;
        return {
            filePath: path.join(AUDIO_DIR, 'cache', filename),
            url: `/public/audio/cache/${filename}`
        };
    } else if (settings.type === 'file') {
        const relativePath = settings.path;
        return {
            filePath: path.join(AUDIO_DIR, relativePath),
            url: `/public/audio/${relativePath}`
        };
    } else if (settings.type === 'url') {
        return {
            filePath: settings.url,
            url: settings.url
        };
    }
    return { filePath: null, url: null };
};

/**
 * Handles local audio playback on the server.
 * 
 * @param {Object} settings - The trigger settings for the specific prayer event.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event.
 * @param {Object} source - The resolved audio source information.
 * @returns {void}
 */
const handleLocal = (settings, prayer, event, source) => {
    if (!source.filePath) return;
    const config = configService.get();
    console.log(`[Target:Local] Playing ${source.filePath}`);
    const audioPlayer = config.automation.audioPlayer || 'mpg123';
    
    // play-sound uses 'player' option to specify binary
    player.play(source.filePath, { player: audioPlayer }, (err) => {
        if (err) console.error(`[Target:Local] Playback error:`, err);
    });
};

/**
 * Broadcasts an audio playback event to all connected SSE clients.
 * 
 * @param {Object} settings - The trigger settings for the specific prayer event.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event.
 * @param {Object} source - The resolved audio source information.
 * @returns {void}
 */
const broadcastToClients = (settings, prayer, event, source) => {
    if (!source.url) return;
    
    sseService.broadcast({
        type: 'AUDIO_PLAY',
        payload: {
            prayer,
            event,
            url: source.url
        }
    });
    console.log(`[SSE:Broadcast] Sent AUDIO_PLAY for ${prayer} ${event}`);
};

/**
 * Triggers an announcement via Voice Monkey.
 * 
 * @param {Object} settings - The trigger settings for the specific prayer event.
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event.
 * @param {Object} source - The resolved audio source information.
 * @returns {Promise<void>}
 */
const handleVoiceMonkey = async (settings, prayer, event, source) => {
    if (!source.url || !source.filePath) return;
    
    // Resolve metadata path: src/public/audio/.../filename.mp3.json
    const relativePath = path.relative(AUDIO_DIR, source.filePath);
    const metaPath = path.join(META_DIR, relativePath + '.json');
    
    let metadata = null;
    if (fs.existsSync(metaPath)) {
        try { metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch(e) {}
    }

    if (metadata && metadata.vmCompatible === false) {
        console.warn(`[Automation] Skipped VoiceMonkey for ${source.filePath}: Audio properties violate Alexa requirements. Issues: ${metadata.vmIssues?.join(', ')}`);
        return;
    }
    
    const config = configService.get();
    const baseUrl = config.automation.baseUrl || ''; 

    // Guard: VoiceMonkey requires a valid HTTPS public URL for audio assets
    if (!baseUrl || !baseUrl.startsWith('https://')) {
        console.warn(`[Automation] Skipped VoiceMonkey for ${prayer} ${event}: Invalid or missing BASE_URL (${baseUrl}). HTTPS is required for Alexa to reach local assets.`);
        return;
    }

    const publicUrl = source.url.startsWith('http') ? source.url : `${baseUrl}${source.url}`;
    
    console.log(`[Target:VoiceMonkey] Triggering for ${publicUrl}`);
    
    const token = config.automation.voiceMonkey?.token;
    const device = config.automation.voiceMonkey?.device;
    
    if (!token || !device) {
        console.warn('[Target:VoiceMonkey] Missing credentials (token/device).');
        return;
    }
    
    try {
        await voiceMonkeyQueue.schedule(() => axios.get('https://api-v2.voicemonkey.io/announcement', {
            params: {
                token: token,
                device: device,
                audio: publicUrl
            }
        }));
    } catch (error) {
         console.error('[Target:VoiceMonkey] Request failed:', error.message);
    }
};

/**
 * Main entry point for triggering an automated prayer event.
 * Orchestrates local playback, SSE broadcasting, and remote automation triggers.
 * 
 * @param {string} prayer - The name of the prayer.
 * @param {string} event - The type of event.
 * @returns {Promise<void>}
 */
const triggerEvent = async (prayer, event) => {
    const config = configService.get();
    const settings = config.automation?.triggers?.[prayer]?.[event];
    
    if (!settings || !settings.enabled) {
        return;
    }

    console.log(`[Automation] Triggering ${prayer} ${event}...`);
    
    sseService.broadcast({
        type: 'LOG',
        payload: { message: `Triggering ${prayer} ${event}`, timestamp: new Date().toISOString() }
    });

    const source = getAudioSource(settings, prayer, event);
    const targets = settings.targets || [];
    
    try {
        // Always broadcast to connected clients (browser filtering is client-side)
        if (source.url) {
            broadcastToClients(settings, prayer, event, source);
        }

        const promises = targets.map(target => {
            if (target === 'local') return handleLocal(settings, prayer, event, source);
            if (target === 'voiceMonkey') return handleVoiceMonkey(settings, prayer, event, source);
        });
        
        await Promise.all(promises);
    } catch (error) {
        console.error(`[Automation] Error executing triggers for ${prayer} ${event}:`, error);
    }
};

/**
 * Verifies Voice Monkey API credentials by attempting a test announcement.
 * 
 * @param {string} token - The Voice Monkey API token.
 * @param {string} device - The Voice Monkey Device ID.
 * @returns {Promise<boolean>} A promise that resolves to true if verification succeeds.
 * @throws {Error} If credentials are missing or invalid.
 */
const verifyCredentials = async (token, device) => {
    if (!token || !device) {
        throw new Error('Missing API Token or Device ID');
    }

    try {
        // Use the announcement endpoint to verify credentials (scheduled via queue)
        const response = await voiceMonkeyQueue.schedule(() => axios.get('https://api-v2.voicemonkey.io/announcement', {
            params: {
                token: token,
                device: device,
                text: "Test"
            },
            timeout: 5000
        }));

        if (response.data && response.data.success === true) {
            return true;
        } else {
             throw new Error(response.data?.error || 'VoiceMonkey API verification failed');
        }
        
    } catch (error) {
        if (error.response) {
             const { status, data } = error.response;
             if ([400, 401, 403].includes(status) || (data && data.error && /authenticated|auth|token/i.test(data.error))) { 
                 throw new Error('Invalid Voice Monkey credentials');
             }
        }
        throw error; // Re-throw to caller
    }
};

module.exports = {
    getAudioSource,
    handleLocal,
    broadcastToClients,
    handleVoiceMonkey,
    triggerEvent,
    verifyCredentials
};
