const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const numberToWords = require('number-to-words');
const configService = require('@config'); // Singleton
const audioValidator = require('@utils/audioValidator');

// AUDIO ROOT: public/audio (for mp3 files)
const AUDIO_ROOT = path.join(__dirname, '../../../public/audio');
const AUDIO_CACHE_DIR = path.join(AUDIO_ROOT, 'cache');
const AUDIO_TEMP_DIR = path.join(AUDIO_ROOT, 'temp');
const AUDIO_CUSTOM_DIR = path.join(AUDIO_ROOT, 'custom');

// METADATA ROOT: src/public/audio (for .mp3.json files)
const META_ROOT = path.join(__dirname, '../../public/audio');
const META_CACHE_DIR = path.join(META_ROOT, 'cache');
const META_CUSTOM_DIR = path.join(META_ROOT, 'custom');

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
 * Ensures that necessary directories exist.
 */
const ensureDirs = () => {
    [AUDIO_CACHE_DIR, AUDIO_TEMP_DIR, AUDIO_CUSTOM_DIR, META_CACHE_DIR, META_CUSTOM_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

/**
 * Cleans up old audio files from the cache directory.
 */
const cleanupCache = async () => {
    ensureDirs();
    const now = Date.now();
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

    try {
        const files = fs.readdirSync(AUDIO_CACHE_DIR);
        for (const file of files) {
            const filePath = path.join(AUDIO_CACHE_DIR, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > MAX_AGE) {
                fs.unlinkSync(filePath);
                
                // Cleanup metadata as well
                const metaPath = path.join(META_CACHE_DIR, file + '.json');
                if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
                
                console.log(`[AudioService] Deleted old cache file and meta: ${file}`);
            }
        }
    } catch (error) {
        console.error('[AudioService] Cache cleanup failed:', error.message);
    }
};

/**
 * Cleans up temporary preview audio files.
 * 
 * @param {boolean} [force=false] - If true, deletes all files regardless of age.
 * @returns {Promise<void>} Resolves when cleanup is complete.
 */
const cleanupTempAudio = async (force = false) => {
    console.log(`[AudioService] Cleaning up temporary audio files (force: ${force})...`);
    if (!fs.existsSync(AUDIO_TEMP_DIR)) return;

    const now = Date.now();
    const MAX_AGE = 1 * 60 * 60 * 1000; // 1 hour

    try {
        const files = fs.readdirSync(AUDIO_TEMP_DIR);
        let deletedCount = 0;
        for (const file of files) {
            if (!file.endsWith('.mp3')) continue;
            const filePath = path.join(AUDIO_TEMP_DIR, file);
            
            if (force || (now - fs.statSync(filePath).mtimeMs > MAX_AGE)) {
                fs.unlinkSync(filePath);
                deletedCount++;
            }
        }
        console.log(`[AudioService] Cleaned up ${deletedCount} temporary preview files.`);
    } catch (error) {
        console.error('[AudioService] Temp cleanup failed:', error.message);
    }
};

/**
 * Resolves placeholders within a message template string.
 * 
 * @param {string} template - The template string containing placeholders like {minutes}.
 * @param {string} prayerKey - The identifier of the prayer (e.g., 'fajr').
 * @param {number} [offsetMinutes] - The time offset in minutes to be converted to words.
 * @returns {string} The resolved message string.
 */
const resolveTemplate = (template, prayerKey, offsetMinutes) => {
    let result = template;
    result = result.replace(/{prayerEnglish}/g, prayerKey.charAt(0).toUpperCase() + prayerKey.slice(1));
    result = result.replace(/{prayerArabic}/g, ARABIC_NAMES[prayerKey] || prayerKey);
    if (offsetMinutes !== undefined) {
        const words = numberToWords.toWords(offsetMinutes);
        result = result.replace(/{minutes}/g, words);
    }
    return result;
};

/**
 * Generates an audio file using the external Text-to-Speech service.
 * 
 * @param {string} filename - The target filename for the generated audio.
 * @param {string} text - The text to be converted to speech.
 * @param {string} serviceUrl - The base URL of the TTS service.
 * @param {string} [triggerVoice=null] - Optional specific voice to use for this generation.
 * @returns {Promise<void>} Resolves when the TTS generation is triggered.
 */
const generateTTS = async (filename, text, serviceUrl, triggerVoice = null) => {
    try {
        const url = `${serviceUrl}/generate-tts`;
        const config = configService.get();
        const globalDefault = config.automation?.defaultVoice;
        const voice = triggerVoice || globalDefault || 'ar-SA-HamedNeural';
                
        await axios.post(url, { text, filename, voice });
        console.log(`[AudioService] Generated: ${filename} using voice: ${voice}`);
    } catch (error) {
        console.error(`[AudioService] TTS Generation failed for ${filename}:`, error.message);
    }
};

/**
 * Synchronises audio assets with the current configuration, generating missing TTS files.
 * 
 * @param {boolean} [forceClean=false] - If true, clears the cache before synchronising.
 * @returns {Promise<object>} An object containing any synchronization warnings.
 */
const syncAudioAssets = async (forceClean = false) => {
    console.log('[AudioService] Synchronising audio assets...');
    ensureDirs();
    
    const config = configService.get();
    const triggers = config.automation?.triggers;
    const pythonServiceUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';

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
        [AUDIO_CACHE_DIR, META_CACHE_DIR].forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
            }
        });
    }

    if (!triggers) return { warnings: [] };

    for (const prayer of PRAYER_NAMES) {
        const prayerTriggers = triggers[prayer];
        if (!prayerTriggers) continue;

        for (const [event, settings] of Object.entries(prayerTriggers)) {
            if (!settings.enabled || settings.type !== 'tts' || !settings.template) continue;

            const text = resolveTemplate(settings.template, prayer, settings.offsetMinutes);
            const filename = `tts_${prayer}_${event}.mp3`;
            const audioPath = path.join(AUDIO_CACHE_DIR, filename);
            const metaPath = path.join(META_CACHE_DIR, filename + '.json');

            let shouldGenerate = true;
            if (fs.existsSync(audioPath) && fs.existsSync(metaPath)) {
                try {
                    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                    const effectiveVoice = settings.voice || config.automation?.defaultVoice || 'ar-SA-HamedNeural';
                    if (meta.text === text && meta.voice === effectiveVoice) {
                        const now = new Date();
                        fs.utimesSync(audioPath, now, now);
                        fs.utimesSync(metaPath, now, now);
                        shouldGenerate = false;
                    }
                } catch (e) { /* corrupted */ }
            }
            
            if (shouldGenerate) {
                console.log(`[AudioService] Preparing TTS for ${prayer} - ${event}`);
                const storageService = require('./storageService');
                const estimatedSize = text.length * 1024;
                const quotaCheck = await storageService.checkQuota(estimatedSize);
                
                if (!quotaCheck.success) {
                    throw new Error(`Storage Limit Exceeded: ${quotaCheck.message}`);
                }

                await generateTTS(filename, text, pythonServiceUrl, settings.voice);
                
                const metadata = await audioValidator.analyseAudioFile(audioPath);
                const vmStatus = audioValidator.validateVoiceMonkeyCompatibility(metadata);
                
                fs.writeFileSync(metaPath, JSON.stringify({ 
                    text, 
                    voice: settings.voice || config.automation?.defaultVoice || 'ar-SA-HamedNeural',
                    generatedAt: new Date().toISOString(),
                    ...metadata,
                    ...vmStatus
                }));
            }
        }
    }
    
    await cleanupCache();
    await cleanupTempAudio();
    console.log('[AudioService] Asset preparation complete.');
};

/**
 * Generates a temporary TTS preview for the given template and voice settings.
 * 
 * @param {string} template - The message template to preview.
 * @param {string} prayerKey - The prayer identifier.
 * @param {number} offsetMinutes - The time offset in minutes.
 * @param {string} voice - The voice identifier to use for the preview.
 * @returns {Promise<object>} An object containing the URL of the generated preview audio.
 */
const previewTTS = async (template, prayerKey, offsetMinutes, voice) => {
    const text = resolveTemplate(template, prayerKey.toLowerCase(), offsetMinutes);
    const config = configService.get();
    const pythonUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';

    const hash = crypto.createHash('md5').update(`${text}|${voice}`).digest('hex').slice(0, 12);
    const filename = `preview_${hash}.mp3`;
    const audioPath = path.join(AUDIO_TEMP_DIR, filename);

    if (fs.existsSync(audioPath)) {
        if (Date.now() - fs.statSync(audioPath).mtimeMs < 1 * 60 * 60 * 1000) {
            const now = new Date();
            fs.utimesSync(audioPath, now, now);
            return { url: `/public/audio/temp/${filename}` };
        }
    }

    try {
        const storageService = require('./storageService');
        await storageService.checkQuota(text.length * 1024);
        const response = await axios.post(`${pythonUrl}/preview-tts`, { text, voice, filename });
        return response.data;
    } catch (error) {
        console.error('[AudioService] Preview generation failed:', error.message);
        throw error;
    }
};

/**
 * Generates metadata sidecar files for any existing audio files that lack them.
 * 
 * @returns {Promise<void>} Resolves when all files have been processed.
 */
const generateMetadataForExistingFiles = async () => {
    ensureDirs();
    const directories = [
        { audio: AUDIO_CUSTOM_DIR, meta: META_CUSTOM_DIR },
        { audio: AUDIO_CACHE_DIR, meta: META_CACHE_DIR }
    ];
    
    for (const dirSet of directories) {
        if (!fs.existsSync(dirSet.audio)) continue;
        
        const files = fs.readdirSync(dirSet.audio).filter(f => f.endsWith('.mp3'));
        for (const file of files) {
            const audioPath = path.join(dirSet.audio, file);
            const metaPath = path.join(dirSet.meta, file + '.json');
            
            const legacyMetaPath = audioPath + '.json';
            const redundantMetaPath = audioPath + '.meta.json';
            
            if (!fs.existsSync(metaPath)) {
                try {
                    console.log(`[AudioService] Generating metadata for ${file}...`);
                    const metadata = await audioValidator.analyseAudioFile(audioPath);
                    const vmStatus = audioValidator.validateVoiceMonkeyCompatibility(metadata);
                    
                    let existingData = {};
                    if (fs.existsSync(legacyMetaPath)) {
                        try { existingData = JSON.parse(fs.readFileSync(legacyMetaPath, 'utf8')); } catch (e) {}
                    } else if (fs.existsSync(redundantMetaPath)) {
                        try { existingData = JSON.parse(fs.readFileSync(redundantMetaPath, 'utf8')); } catch (e) {}
                    }
                    
                    fs.writeFileSync(metaPath, JSON.stringify({
                        ...existingData,
                        ...metadata,
                        ...vmStatus,
                        updatedAt: new Date().toISOString()
                    }));

                    // Cleanup redundant ones in root public
                    if (fs.existsSync(legacyMetaPath)) fs.unlinkSync(legacyMetaPath);
                    if (fs.existsSync(redundantMetaPath)) fs.unlinkSync(redundantMetaPath);
                    
                } catch (error) {
                    console.error(`[AudioService] Metadata generation failed for ${file}:`, error.message);
                }
            }
        }
    }
}

module.exports = {
    syncAudioAssets,
    cleanupCache,
    cleanupTempAudio,
    resolveTemplate,
    previewTTS,
    generateMetadataForExistingFiles
};
