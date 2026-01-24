const { exec } = require('child_process');
const fs = require('fs');
const axios = require('axios');
const configService = require('@config');
const fetchers = require('@adapters/prayerApiAdapter');

let healthCache = {
    local: { healthy: false, message: 'Initialising...' },
    tts: { healthy: false, message: 'Initialising...' },
    voiceMonkey: { healthy: false, message: 'Initialising...' },
    primarySource: { healthy: false, message: 'Initialising...' },
    backupSource: { healthy: false, message: 'Initialising...' },
    ports: { api: process.env.PORT || 3000, tts: 8000 },
    lastChecked: null
};

// Extract TTS port from URL or default
try {
    const ttsUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    const port = new URL(ttsUrl).port;
    if (port) healthCache.ports.tts = port;
} catch (e) { /* ignore */ }

/**
 * Checks the local audio environment, including the presence of playback software
 * and hardware sound devices (Linux specific).
 * 
 * @returns {Promise<Object>} An object containing health status and a descriptive message.
 */
async function checkLocalAudio() {
    try {
        await new Promise((resolve, reject) => {
            exec('mpg123 --version', (error) => {
                if (error) reject(error);
                else resolve();
            });
        });
        console.log('[Health] mpg123: OK');

        // 2. Check for Audio Device Hardware (Linux/Docker specific)
        if (process.platform === 'linux') {
            if (!fs.existsSync('/dev/snd')) {
                
                // Check if we are running inside Docker
                let isDocker = false;
                try {
                    isDocker = fs.existsSync('/.dockerenv') || fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker');
                } catch (e) {
                    // Ignore errors reading cgroup
                }

                if (isDocker) {
                    console.warn('[Health] Docker detected, but /dev/snd is missing.');
                    // Return a specific message for Windows/Mac Docker users
                    return { 
                        healthy: false, 
                        message: 'Docker: No Audio HW' 
                    };
                }

                console.warn('[Health] mpg123 OK, but /dev/snd missing (No Audio Device)');
                return { healthy: false, message: 'No Audio Device' };
            }
        }

        return { healthy: true, message: 'Ready' };
    } catch (e) {
        console.warn('[Health] mpg123: Not Found');
        return { healthy: false, message: 'mpg123 Not Found' };
    }
}

/**
 * Checks the connectivity and availability of the local TTS (Text-to-Speech) service.
 * 
 * @returns {Promise<Object>} An object containing health status and a descriptive message.
 */
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

/**
 * Checks the Voice Monkey API connectivity and credentials.
 * 
 * @param {string} [mode='silent'] - The check mode ('silent' or 'loud'). 'Loud' uses actual devices.
 * @returns {Promise<Object>} An object containing health status and a descriptive message.
 */
async function checkVoiceMonkey(mode = 'silent') {
    const config = configService.get();
    const token = config.automation?.voiceMonkey?.token;
    const device = config.automation?.voiceMonkey?.device;
    const baseUrl = config.automation?.baseUrl;

    if (!baseUrl || !baseUrl.startsWith('https://')) {
        console.warn('[Health] VoiceMonkey: Unhealthy (HTTPS BASE_URL required)');
        return { healthy: false, message: 'Offline: HTTPS Base URL required' };
    }

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
    // console.log(`[Health] VoiceMonkey (${mode}): Checking device ${deviceToCheck}`);
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

        // console.log(`[Health] VoiceMonkey (${mode}): Response`, response.data);

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

/**
 * Checks the health of a specific prayer time data source (Primary or Backup).
 * Validates connectivity and the ability to fetch data for the current year.
 * 
 * @param {string} target - The source target to check ('primary' or 'backup').
 * @returns {Promise<Object>} An object containing health status and a descriptive message.
 */
async function checkSource(target) {
    const config = configService.get();
    const source = config.sources[target];
    
    if (!source) return { healthy: false, message: 'Not Configured' };
    if (target === 'backup' && source.enabled === false) return { healthy: false, message: 'Disabled' };

    try {
        if (source.type === 'aladhan') {
            const { DateTime } = require('luxon');
            const year = DateTime.now().setZone(config.location.timezone).year;
            await fetchers.fetchAladhanAnnual(config, year);
        } else if (source.type === 'mymasjid') {
            await fetchers.fetchMyMasjidBulk(config);
        }
        console.log(`[Health] ${target} Source: OK`);
        return { healthy: true, message: 'Online' };
    } catch (e) {
        console.warn(`[Health] ${target} Source Error:`, e.message);
        return { healthy: false, message: e.message || 'Offline' };
    }
}

/**
 * Refreshes the health status cache for specified targets.
 * 
 * @param {string} [target='all'] - The components to refresh ('all', 'local', 'tts', 'voicemonkey', etc.).
 * @param {string} [mode='silent'] - The check mode for automation services.
 * @returns {Promise<Object>} The updated health cache object.
 */
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
    if (target === 'all' || target === 'silent' || target === 'voicemonkey' || target === 'voiceMonkey') {
        promises.push(checkVoiceMonkey(mode).then(res => updates.voiceMonkey = res));
    }
    if (target === 'all' || target === 'primarySource') {
        promises.push(checkSource('primary').then(res => updates.primarySource = res));
    }
    if (target === 'all' || target === 'backupSource') {
        promises.push(checkSource('backup').then(res => updates.backupSource = res));
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

/**
 * Retrieves the current health status cache.
 * 
 * @returns {Object} The health status cache object.
 */
function getHealth() {
    return healthCache;
}

module.exports = {
    refresh,
    getHealth,
    checkSource
};
