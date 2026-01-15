const { exec } = require('child_process');
const axios = require('axios');
const configService = require('../config');

let healthCache = {
    local: { healthy: false, message: 'Initializing...' },
    tts: { healthy: false, message: 'Initializing...' },
    voiceMonkey: { healthy: false, message: 'Initializing...' },
    ports: { api: process.env.PORT || 3000, tts: 8000 },
    lastChecked: null
};

// Extract TTS port from URL or default
try {
    const ttsUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    const port = new URL(ttsUrl).port;
    if (port) healthCache.ports.tts = port;
} catch (e) { /* ignore */ }

async function checkLocalAudio() {
    try {
        await new Promise((resolve, reject) => {
            exec('mpg123 --version', (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        console.log('[Health] mpg123: OK');
        return { healthy: true, message: 'Ready' };
    } catch (e) {
        console.warn('[Health] mpg123: Not Found');
        return { healthy: false, message: 'mpg123 Not Found' };
    }
}

async function checkPythonService() {
    try {
        const ttsUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        await axios.get(`${ttsUrl}/docs`, { timeout: 2000 });
        console.log('[Health] TTS Service: OK');
        return { healthy: true, message: 'Online' };
    } catch (e) {
        console.warn('[Health] TTS Service: Unreachable');
        return { healthy: false, message: 'Service Unreachable' };
    }
}

async function checkVoiceMonkey(mode = 'silent') {
    const config = configService.get();
    const token = config.automation?.voiceMonkey?.token;
    const device = config.automation?.voiceMonkey?.device;

    if (!token) {
        console.warn('[Health] VoiceMonkey: Skipped (Token missing)');
        return { healthy: false, message: 'Token Missing' }; 
    }

    // In Loud mode, we need the real device. In Silent mode, we use a random one.
    if (mode === 'loud' && !device) {
        console.warn('[Health] VoiceMonkey: Skipped (Device missing for Loud check)');
        return { healthy: false, message: 'Device Missing' };
    }

    const deviceToCheck = mode === 'silent' ? `azan_check_${Date.now()}` : device;
    //console.log(`[Health] VoiceMonkey (${mode}): Checking device ${deviceToCheck}`);
    try {
        // Check if we can reach the API
        const response = await axios.get(`https://api-v2.voicemonkey.io/announcement`, {
            params: {
                token: token,
                device: deviceToCheck,
                text: 'Test'
            },
            timeout: 5000
        });

        //console.log(`[Health] VoiceMonkey (${mode}): Response`, response.data);

        if (response.data && response.data.success === true) {
             console.log(`[Health] VoiceMonkey (${mode}): OK`);
             return { healthy: true, message: 'Online' };
        } else {
             console.warn(`[Health] VoiceMonkey (${mode}): API returned failure`, response.data);
             throw new Error(response.data?.error || 'VoiceMonkey API returned failure');
        }
    } catch (e) {
        console.error(`[Health] VoiceMonkey (${mode}) Error:`, e.message);
        const msg = e.response?.data?.error || e.message;
        return { healthy: false, message: msg };
    }
}

async function refresh(target = 'all', mode = 'silent') {
    console.log(`[Health] Refreshing target: ${target}, mode: ${mode}`);
    
    const updates = {};
    const promises = [];

    if (target === 'all' || target === 'silent' || target === 'local') {
        promises.push(checkLocalAudio().then(res => updates.local = res));
    }
    if (target === 'all' || target === 'silent' || target === 'tts') {
        promises.push(checkPythonService().then(res => updates.tts = res));
    }
    // Now 'silent' target ALSO includes VoiceMonkey (in silent mode by default)
    if (target === 'all' || target === 'silent' || target === 'voicemonkey' || target === 'voiceMonkey') {
        promises.push(checkVoiceMonkey(mode).then(res => updates.voiceMonkey = res));
    }

    await Promise.all(promises);

    // Refresh ports from env in case of restart/reload (though process.env is static, this handles if logic changes)
    try {
        const ttsUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
        const port = new URL(ttsUrl).port;
        if (port) healthCache.ports = { ...healthCache.ports, tts: port };
    } catch(e) {}
    healthCache.ports.api = process.env.PORT || 3000;

    healthCache = { ...healthCache, ...updates, lastChecked: new Date().toISOString() };
    return healthCache;
}

function getHealth() {
    return healthCache;
}

module.exports = {
    refresh,
    getHealth
};
