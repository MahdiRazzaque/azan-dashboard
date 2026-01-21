const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const numberToWords = require('number-to-words');
const configService = require('@config'); // Singleton

// Note: Python saves to <project>/public/audio/cache, not src/public
const CACHE_DIR = path.join(__dirname, '../../../public/audio/cache');
const ARABIC_NAMES = {
    fajr: 'فجر',
    sunrise: 'شُروق',
    dhuhr: 'ظُهْر',
    asr: 'عصر',
    maghrib: 'مغرب',
    isha: 'عِشَا'
};

const PRAYER_NAMES = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

/**
 * Ensures that the audio cache directory exists.
 * Creates the directory if it does not already exist.
 * 
 * @returns {void}
 */
const ensureCacheDir = () => {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
};

/**
 * Cleans up old audio files from the cache directory.
 * Deletes files that are older than 30 days.
 * 
 * @returns {Promise<void>}
 */
const cleanupCache = async () => {
    ensureCacheDir();
    const now = Date.now();
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

    try {
        const files = fs.readdirSync(CACHE_DIR);
        for (const file of files) {
            const filePath = path.join(CACHE_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > MAX_AGE) {
                fs.unlinkSync(filePath);
                console.log(`[AudioService] Deleted old cache file: ${file}`);
            }
        }
    } catch (error) {
        console.error('[AudioService] Cache cleanup failed:', error.message);
    }
};

/**
 * Cleans up temporary preview audio files.
 * Deletes files that are older than 1 hour, or all files if force is true.
 * 
 * @param {boolean} [force=false] - Whether to delete all files regardless of age.
 * @returns {Promise<void>}
 */
const cleanupTempAudio = async (force = false) => {
    console.log(`[AudioService] Cleaning up temporary audio files (force: ${force})...`);
    const TEMP_DIR = path.join(__dirname, '../../../public/audio/temp');
    if (!fs.existsSync(TEMP_DIR)) return;

    const now = Date.now();
    const MAX_AGE = 1 * 60 * 60 * 1000; // 1 hour

    try {
        const files = fs.readdirSync(TEMP_DIR);
        let deletedCount = 0;
        for (const file of files) {
            if (!file.endsWith('.mp3')) continue;
            
            const filePath = path.join(TEMP_DIR, file);
            
            if (force) {
                fs.unlinkSync(filePath);
                deletedCount++;
            } else {
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > MAX_AGE) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
        }
        if (deletedCount > 0) {
            console.log(`[AudioService] Cleaned up ${deletedCount} temporary preview files.`);
        } else {
            console.log('[AudioService] No temporary preview files found to clean up.');
        }
    } catch (error) {
        console.error('[AudioService] Temp cleanup failed:', error.message);
    }
};

/**
 * Resolves a message template by replacing placeholders with actual values.
 * Placeholders include {prayerEnglish}, {prayerArabic}, and {minutes}.
 * 
 * @param {string} template - The message template string.
 * @param {string} prayerKey - The English name of the prayer.
 * @param {number} [offsetMinutes] - The offset in minutes.
 * @returns {string} The resolved message string.
 */
const resolveTemplate = (template, prayerKey, offsetMinutes) => {
    let result = template;
    
    // {prayerEnglish}
    result = result.replace(/{prayerEnglish}/g, prayerKey.charAt(0).toUpperCase() + prayerKey.slice(1));
    
    // {prayerArabic}
    result = result.replace(/{prayerArabic}/g, ARABIC_NAMES[prayerKey] || prayerKey);

    // {minutes} - convert to words
    if (offsetMinutes !== undefined) {
        // Use number-to-words for English numbers as per requirement
        const words = numberToWords.toWords(offsetMinutes);
        result = result.replace(/{minutes}/g, words);
    }

    return result;
};

// Added serviceUrl parameter to make dependency explicit
/**
 * Generates an audio file using Text-to-Speech.
 * 
 * @param {string} filename - The name of the file to save.
 * @param {string} text - The text to convert to speech.
 * @param {string} serviceUrl - The URL of the TTS service.
 * @param {string} [triggerVoice] - Specific voice for this trigger.
 * @returns {Promise<void>}
 */
const generateTTS = async (filename, text, serviceUrl, triggerVoice = null) => {
    try {
        const url = `${serviceUrl}/generate-tts`;
        
        // Resolve voice: Trigger > Global Default > Fallback
        const config = configService.get();
        const globalDefault = config.automation?.defaultVoice;
        const FALLBACK_VOICE = 'ar-DZ-IsmaelNeural';
        const voice = triggerVoice || globalDefault || FALLBACK_VOICE;
                
        await axios.post(url, {
            text: text,
            filename: filename,
            voice: voice
        });
        console.log(`[AudioService] Generated: ${filename} using voice: ${voice}`);
    } catch (error) {
        console.error(`[AudioService] TTS Generation failed for ${filename}:`, error.message);
        // Don't throw, just log. We don't want to break the whole loop.
    }
};

/**
 * Synchronises audio assets with the current configuration.
 * Generates missing TTS files and optionally cleans the cache.
 * 
 * @param {boolean} [forceClean=false] - Whether to clear the cache before synchronising.
 * @returns {Promise<Object>} A report containing any warnings encountered during synchronisation.
 * @throws {Error} If the TTS service is unavailable.
 */
const syncAudioAssets = async (forceClean = false) => {
    console.log('[AudioService] Synchronising audio assets...');
    ensureCacheDir();
    
    const config = configService.get();
    const triggers = config.automation?.triggers;
    const pythonServiceUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';

    // Health Check: Ensure TTS service is available before doing anything
    const healthCheck = require('./healthCheck');
    console.log('[AudioService] Verifying TTS Service status...');
    await healthCheck.refresh('tts');
    const health = healthCheck.getHealth();
    
    if (!health.tts?.healthy) {
        console.error('[AudioService] Aborting: TTS Service is offline.');
        throw new Error('TTS Service is offline. Cannot generate audio assets.');
    }

    if (forceClean) {
        console.log('[AudioService] Force cleaning all cached assets...');
        try {
            const files = fs.readdirSync(CACHE_DIR);
            for (const file of files) {
                if (file.endsWith('.mp3') || file.endsWith('.json')) {
                    fs.unlinkSync(path.join(CACHE_DIR, file));
                }
            }
            console.log(`[AudioService] Cleared ${files.length} files.`);
        } catch (e) {
            console.error('[AudioService] Failed to force clean cache:', e);
        }
    }

    const warnings = [];
    if (!triggers) return { warnings };

    for (const prayer of PRAYER_NAMES) {
        const prayerTriggers = triggers[prayer];
        if (!prayerTriggers) continue;

        // Iterate events: preAdhan, adhan, preIqamah, iqamah
        for (const [event, settings] of Object.entries(prayerTriggers)) {
            // console.log(event, settings);
            if (!settings.enabled || settings.type !== 'tts' || !settings.template) {
                // console.log(`[AudioService] Skipping ${prayer} - ${event} (disabled or not TTS)`);
                continue;
            }

            const text = resolveTemplate(settings.template, prayer, settings.offsetMinutes);
            const filename = `tts_${prayer}_${event}.mp3`;
            const filePath = path.join(CACHE_DIR, filename);
            const metaPath = filePath + '.json';

            let shouldGenerate = true;

            // Check if file and metadata exist to verify if config changed
            if (fs.existsSync(filePath) && fs.existsSync(metaPath)) {
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    
                    // Determine the effective voice for this trigger
                    const effectiveVoice = settings.voice || config.automation?.defaultVoice || 'ar-DZ-IsmaelNeural';
                    
                    // Check both text AND voice match
                    if (meta.text === text && meta.voice === effectiveVoice) {
                        // Config hasn't changed, reuse file
                        // Touch file to prevent cleanup aging (update mtime)
                        const now = new Date();
                        fs.utimesSync(filePath, now, now);
                        fs.utimesSync(metaPath, now, now);
                        
                        shouldGenerate = false;
                        // console.log(`[AudioService] Skipping ${prayer} - ${event} (Cached)`);
                    }
                } catch (e) {
                    // Meta corrupt or read error, regenerate
                }
            }
            
            if (shouldGenerate) {
                console.log(`[AudioService] Preparing TTS for ${prayer} - ${event}`);
                // Quota Check
                const storageService = require('./storageService');
                const estimatedSize = text.length * 1024; // 1KB per char upper bound
                const quotaCheck = await storageService.checkQuota(estimatedSize);
                
                if (!quotaCheck.success) {
                const errorMsg = `Storage Limit Exceeded: Cannot generate ${prayer} ${event} (${quotaCheck.message})`;
                console.error(`[AudioService] ${errorMsg}`);
                throw new Error(errorMsg);
            }

                // Pass the URL derived from the fresh config
                await generateTTS(filename, text, pythonServiceUrl, settings.voice);
                fs.writeFileSync(metaPath, JSON.stringify({ 
                    text, 
                    voice: settings.voice || config.automation?.defaultVoice || 'ar-DZ-IsmaelNeural',
                    generatedAt: new Date().toISOString() 
                }));
            }
        }
    }
    
    await cleanupCache();
    await cleanupTempAudio();
    console.log('[AudioService] Asset preparation complete.');
};

/**
 * Proxies a request to generate a TTS preview audio file after resolving placeholders.
 * Uses hash-based caching to avoid regenerating identical previews.
 * 
 * @param {string} template - The message template string.
 * @param {string} prayerKey - The English name of the prayer.
 * @param {number} offsetMinutes - The offset in minutes.
 * @param {string} voice - The voice to use for generation.
 * @returns {Promise<Object>} The response with the audio URL.
 */
const previewTTS = async (template, prayerKey, offsetMinutes, voice) => {
    const text = resolveTemplate(template, prayerKey.toLowerCase(), offsetMinutes);
    const config = configService.get();
    const pythonUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';

    // Create a unique hash from the resolved text and voice
    const hash = crypto.createHash('md5').update(`${text}|${voice}`).digest('hex').slice(0, 12);
    const filename = `preview_${hash}.mp3`;
    // Note: Python saves to <project>/public/audio/temp, not src/public
    const TEMP_DIR = path.join(__dirname, '../../../public/audio/temp');
    const filePath = path.join(TEMP_DIR, filename);

    // Check if this exact preview already exists (cached)
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const ageMs = Date.now() - stats.mtimeMs;
        const MAX_AGE = 1 * 60 * 60 * 1000; // 1 hour

        if (ageMs < MAX_AGE) {
            console.log(`[AudioService] Serving cached preview: ${filename}`);
            // Touch the file to keep it alive
            const now = new Date();
            fs.utimesSync(filePath, now, now);
            return { url: `/public/audio/temp/${filename}` };
        }
    }

    // Generate new preview via Python service
    try {
        // Check storage quota before generating new file
        const storageService = require('./storageService');
        const estimatedSize = text.length * 1024; // 1KB per char upper bound
        const quotaCheck = await storageService.checkQuota(estimatedSize);
        
        if (!quotaCheck.success) {
            console.error('[AudioService] Preview quota exceeded:', quotaCheck.message);
            throw new Error('Storage limit reached. Please clean up temporary TTS files in the Developer Panel → System Actions.');
        }

        console.log(`[AudioService] Generating new preview: ${filename}`);
        const response = await axios.post(`${pythonUrl}/preview-tts`, { 
            text, 
            voice, 
            filename // Pass the deterministic filename to Python
        });
        return response.data;
    } catch (error) {
        console.error('[AudioService] Preview generation failed:', error.message);
        throw error; // Re-throw to preserve the user-friendly message
    }
};

module.exports = {
    syncAudioAssets,
    cleanupCache,
    cleanupTempAudio,
    resolveTemplate,
    previewTTS
};
