const path = require('path');
const player = require('play-sound')({});
const axios = require('axios');
const configService = require('../config'); // Singleton
const sseService = require('./sseService');
const { voiceMonkeyQueue } = require('../utils/requestQueue');

const AUDIO_DIR = path.join(__dirname, '../../public/audio');

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

const handleBrowser = (settings, prayer, event, source) => {
    if (!source.url) return;
    
    sseService.broadcast({
        type: 'AUDIO_PLAY',
        payload: {
            prayer,
            event,
            url: source.url
        }
    });
    console.log(`[Target:Browser] Sent SSE event for ${source.url}`);
};

const handleVoiceMonkey = async (settings, prayer, event, source) => {
    if (!source.url) return;
    
    const config = configService.get();
    const baseUrl = config.automation.baseUrl || ''; 
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
        const promises = targets.map(target => {
            if (target === 'local') return handleLocal(settings, prayer, event, source);
            if (target === 'browser') return handleBrowser(settings, prayer, event, source);
            if (target === 'voiceMonkey') return handleVoiceMonkey(settings, prayer, event, source);
        });
        
        await Promise.all(promises);
    } catch (error) {
        console.error(`[Automation] Error executing triggers for ${prayer} ${event}:`, error);
    }
};

const playTestAudio = (filePath) => {
     console.log(`[Test:Local] Playing ${filePath}`);
     const config = configService.get();
     const audioPlayer = config.automation.audioPlayer || 'mpg123';
     player.play(filePath, { player: audioPlayer }, (err) => {
        if (err) console.error(`[Test:Local] Playback error:`, err);
     });
};

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
    triggerEvent,
    playTestAudio,
    verifyCredentials
};
