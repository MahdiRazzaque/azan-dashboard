const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const axios = require('axios');
const configService = require('@config');

const CACHE_DIR = path.join(__dirname, '../../data');
const CACHE_FILE = path.join(CACHE_DIR, 'voices.json');
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Module-level state
let voices = [];
let isFetching = false;
let lastFetched = null;

/**
 * Checks if the cache is still valid based on its age.
 * 
 * @returns {boolean} True if the cache is within the allowed duration, otherwise false.
 */
const _isCacheValid = () => {
    if (!lastFetched) return false;
    const now = new Date();
    return (now - lastFetched) < CACHE_DURATION_MS;
};

/**
 * Loads voices from the persistent disk cache using async I/O.
 * 
 * @returns {Promise<Array|null>} The list of voices from cache, or null if loading fails or cache is invalid.
 */
const _loadFromCache = async () => {
    try {
        try {
            await fsp.access(CACHE_FILE);
        } catch (e) {
            return null;
        }

        const content = await fsp.readFile(CACHE_FILE, 'utf8');
        const data = JSON.parse(content);
        lastFetched = new Date(data.timestamp);
        
        if (_isCacheValid()) {
            voices = data.voices;
            console.log(`[VoiceService] Loaded ${voices.length} voices from disk cache (Last updated: ${lastFetched.toISOString()}).`);
            return voices;
        } else {
            console.log('[VoiceService] Disk cache is older than 24h, will refresh.');
        }
    } catch (error) {
        console.error('[VoiceService] Failed to read disk cache:', error.message);
    }
    return null;
};

/**
 * Saves the current voice list to the persistent disk cache using async I/O.
 * @param {Array} newVoices - The voices list to save.
 * @returns {Promise<void>}
 */
const _saveToCache = async (newVoices) => {
    try {
        try {
            await fsp.access(CACHE_DIR);
        } catch (e) {
            await fsp.mkdir(CACHE_DIR, { recursive: true });
        }

        const data = {
            timestamp: new Date().toISOString(),
            voices: newVoices
        };
        await fsp.writeFile(CACHE_FILE, JSON.stringify(data, null, 2));
        console.log('[VoiceService] Saved voices to disk cache.');
    } catch (error) {
        console.error('[VoiceService] Failed to save disk cache:', error.message);
    }
};

/**
 * Fetches the latest voice list from the Python microservice if cache is invalid.
 * @returns {Promise<Array>} The list of voices.
 */
const refreshVoices = async () => {
    if (isFetching) return voices;

    // 1. Check if we already have valid voices in memory
    if (voices.length > 0 && _isCacheValid()) {
        console.log("[VoiceService] Using voices from memory cache.");
        return voices;
    }

    // 2. Try to load from disk cache if memory is empty or invalid
    const diskCache = await _loadFromCache();
    if (diskCache) {
        console.log("[VoiceService] Using voices from disk cache.");
        return diskCache;
    }

    // 3. Otherwise, fetch from Python service
    const config = configService.get();
    const pythonUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';
    
    console.log('[VoiceService] Fetching voices from Python service...');
    isFetching = true;

    try {
        const response = await axios.get(`${pythonUrl}/voices`, { 
            timeout: 10000,
            maxContentLength: 5000000
        });
        if (response.data && Array.isArray(response.data)) {
            voices = response.data;
            lastFetched = new Date();
            
            // 4. Update disk cache
            await _saveToCache(voices);
            
            console.log(`[VoiceService] Successfully cached ${voices.length} voices.`);
        }
        return voices;
    } catch (error) {
        console.error('[VoiceService] Failed to fetch voices from Python service:', error.message);
        // Don't clear existing in-memory voices on failure
        return voices;
    } finally {
        isFetching = false;
    }
};

/**
 * Initialises the voice cache by fetching from the Python service.
 * @returns {Promise<void>}
 */
const init = async () => {
    await refreshVoices();
};

/**
 * Returns the currently cached list of voices.
 * 
 * @returns {Array} An array of voice objects currently held in memory.
 */
const getVoices = () => {
    return voices;
};

/**
 * Service for managing TTS voices, including fetching from the Python microservice
 * and caching the results for instant frontend access.
 */
module.exports = {
    init,
    refreshVoices,
    getVoices
};