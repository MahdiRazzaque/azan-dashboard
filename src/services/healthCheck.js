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

async function checkVoiceMonkey() {
    const config = configService.get();
    const token = config.automation?.voiceMonkey?.accessToken;
    const secret = config.automation?.voiceMonkey?.secretToken;

    if (!token || !secret) {
        console.warn('[Health] VoiceMonkey: Skipped (Credentials missing)');
        return { healthy: false, message: 'Credentials Missing' }; 
    }

    try {
        // Check if we can reach the API
        await axios.get(`https://api-v2.voicemonkey.io/devices`, {
            params: {
                access_token: token,
                secret_token: secret
            },
            timeout: 5000
        });
        
        console.log('[Health] VoiceMonkey: OK');
        return { healthy: true, message: 'Online' };
    } catch (e) {
        let msg = 'Unreachable';
        if (e.response && (e.response.status === 400 || e.response.status === 401 || e.response.status === 403)) {
            console.warn('[Health] VoiceMonkey: Invalid Credentials');
            msg = 'Invalid Credentials';
        } else {
            console.warn('[Health] VoiceMonkey: Unreachable/Error', e.message);
            msg = e.message || 'Request Failed';
        }
        return { healthy: false, message: msg };
    }
}

async function refresh(target = 'all') {
    console.log(`[Health] Refreshing target: ${target}`);
    
    const updates = {};
    const promises = [];



    if (target === 'all' || target === 'local') {
        promises.push(checkLocalAudio().then(res => updates.local = res));
    }
    if (target === 'all' || target === 'tts') {
        promises.push(checkPythonService().then(res => updates.tts = res));
    }
    if (target === 'all' || target === 'voicemonkey' || target === 'voiceMonkey') {
        promises.push(checkVoiceMonkey().then(res => updates.voiceMonkey = res));
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
