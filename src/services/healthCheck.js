const { exec } = require('child_process');
const axios = require('axios');
const configService = require('../config');

let healthCache = {
    local: false,
    tts: false,
    voiceMonkey: false,
    lastChecked: null
};

async function checkLocalAudio() {
    try {
        await new Promise((resolve, reject) => {
            exec('mpg123 --version', (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        console.log('[Health] mpg123: OK');
        return true;
    } catch (e) {
        console.warn('[Health] mpg123: Not Found');
        return false;
    }
}

async function checkPythonService() {
    try {
        await axios.get('http://127.0.0.1:8000/docs', { timeout: 2000 });
        console.log('[Health] TTS Service: OK');
        return true;
    } catch (e) {
        console.warn('[Health] TTS Service: Unreachable');
        return false;
    }
}

async function checkVoiceMonkey() {
    const config = configService.get();
    const token = config.integrations?.voiceMonkey?.accessToken;
    const secret = config.integrations?.voiceMonkey?.secretToken;

    if (!token || !secret) {
        console.warn('[Health] VoiceMonkey: Skipped (Credentials missing)');
        return false; // Can't be healthy if not configured
    }

    try {
        // "Dry Run" type check implies we validat the credentials.
        // There isn't a dedicated "auth check" endpoint in VM API usually, but we can try to get devices
        // or just assume if we can reach the API it's "Online" in terms of internet/DNS, 
        // but to check credentials we need a real call. 
        // The PRD mentions "Validates tokens against api.voicemonkey.io (Dry run/Devices check)".
        // Let's assume a harmless GET if possible. 
        // Documentation for VoiceMonkey API is sparse on "check auth", usually you send a TTS.
        // Let's rely on a basic connectivity check or just return true if credentials exist for now 
        // IF we want to strictly follow PRD "Validates tokens", we'd need to know the specific endpoint.
        // Given earlier conversations (not shown here), I'll assume we can't easily validate without sending audio
        // unless there is a 'devices' endpoint. 
        // Let's try to hit the "get devices" endpoint if it exists or just check if the service is reachable.
        // For safety, let's just do a basic connectivity check to the base API URL to ensure DNS/Network is fine,
        // and assume credentials are "valid" if provided, unless we want to do a full test.
        // Actually, PRD says: "Validates tokens... (Dry run/Devices check)".
        // I will implement a "Dry Run" style check if I can find one, otherwise just basic reachability.
        // Assuming typical usage:
        // https://api.voicemonkey.io/v2/devices?access_token=...&secret_token=... mechanism
        
        // Changing strategy: We will just check if we can reach api.voicemonkey.io. 
        // If we want to be strict, we'd try to list devices.
        // Let's try listing devices as it's the safest read-only operation.
        
        await axios.get(`https://api.voicemonkey.io/v2/devices`, {
            params: {
                access_token: token,
                secret_token: secret
            },
            timeout: 5000
        });
        
        console.log('[Health] VoiceMonkey: OK');
        return true;
    } catch (e) {
        // 401/403 would mean invalid credentials
        // 500 or timeout means service issue
        if (e.response && (e.response.status === 401 || e.response.status === 403)) {
            console.warn('[Health] VoiceMonkey: Invalid Credentials');
        } else {
            console.warn('[Health] VoiceMonkey: Unreachable/Error', e.message);
        }
        return false;
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
