const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const numberToWords = require('number-to-words');
const configService = require('@config'); // Singleton
const audioValidator = require('@utils/audioValidator');
const OutputFactory = require('../../outputs');

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
 * @param {string} voice - The voice profile to be used for the speech generation.
 * @returns {Promise<void>} Resolves when the TTS generation is triggered successfully.
 */
const generateTTS = async (filename, text, serviceUrl, voice) => {
    const url = `${serviceUrl}/generate-tts`;
    try {
        await axios.post(url, { text, filename, voice }, {
            maxContentLength: 5000000
        });
        console.log(`[AudioService] Successfully generated: ${filename}`);
    } catch (error) {
        console.error(`[AudioService] TTS Generation failed for ${filename}:`, error.message);
        throw error;
    }
};

/**
 * Ensures a TTS file exists and is valid based on current configuration.
 * Regenerates the file if it's missing or if the template/voice has changed.
 * 
 * @param {string} prayer - The prayer identifier.
 * @param {string} event - The event identifier.
 * @param {Object} settings - The trigger settings for this event.
 * @param {Object} config - The full application configuration.
 * @returns {Promise<{success: boolean, message: string, generated: boolean}>} Object containing success status, message, and generation flag.
 */
const ensureTTSFile = async (prayer, event, settings, config) => {
    const pythonServiceUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';
    const text = resolveTemplate(settings.template, prayer, settings.offsetMinutes);
    const filename = `tts_${prayer}_${event}.mp3`;
    const audioPath = path.join(AUDIO_CACHE_DIR, filename);
    const metaPath = path.join(META_CACHE_DIR, filename + '.json');
    const effectiveVoice = settings.voice || config.automation?.defaultVoice || 'ar-SA-HamedNeural';

    let shouldGenerate = true;
    if (fs.existsSync(audioPath) && fs.existsSync(metaPath)) {
        try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta.text === text && meta.voice === effectiveVoice) {
                const now = new Date();
                fs.utimesSync(audioPath, now, now);
                fs.utimesSync(metaPath, now, now);
                shouldGenerate = false;
            }
        } catch (e) { /* corrupted */ }
    }

    if (!shouldGenerate) {
        return { success: true, message: 'Valid file exists', generated: false };
    }

    // Check TTS Health before generating
    const healthCheck = require('./healthCheck');
    const ttsHealth = await healthCheck.refresh('tts');
    if (!ttsHealth.tts?.healthy) {
        return { 
            success: false, 
            message: 'TTS Service Offline. Generation will be attempted again at trigger time.', 
            generated: false 
        };
    }

    console.log(`[AudioService] Preparing TTS for ${prayer} - ${event}`);
    const storageService = require('./storageService');
    const estimatedSize = text.length * 1024;
    const quotaCheck = await storageService.checkQuota(estimatedSize);
    
    if (!quotaCheck.success) {
        throw new Error(`Storage Limit Exceeded: ${quotaCheck.message}`);
    }

    try {
        await generateTTS(filename, text, pythonServiceUrl, effectiveVoice);
        
        const metadata = await audioValidator.analyseAudioFile(audioPath);
        
        // Polymorphically augment metadata from all strategies
        const augmentedData = {};
        OutputFactory.getAllStrategyInstances().forEach(instance => {
            Object.assign(augmentedData, instance.augmentAudioMetadata(metadata));
        });
        
        fs.writeFileSync(metaPath, JSON.stringify({ 
            text, 
            voice: effectiveVoice,
            generatedAt: new Date().toISOString(),
            ...metadata,
            ...augmentedData
        }));
        return { success: true, message: 'Successfully generated', generated: true };
    } catch (e) {
        console.error(`[AudioService] TTS generation failed for ${filename}:`, e.message);
        return { success: false, message: e.message, generated: false };
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
    const warnings = [];

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

            try {
                const result = await ensureTTSFile(prayer, event, settings, config);
                if (!result.success) {
                    const niceName = `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} ${event.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`;
                    warnings.push(`${niceName}: ${result.message}`);
                }
            } catch (err) {
                console.error(`[AudioService] Asset sync failed for ${prayer} ${event}:`, err.message);
                throw err; // Quota issues should still be fatal
            }
        }
    }
    
    await cleanupCache();
    await cleanupTempAudio();
    console.log('[AudioService] Asset preparation complete.');
    return { warnings };
};

/**
 * Ensures that a "test.mp3" file exists in the custom audio directory.
 * If it doesn't exist, it generates one using the TTS service and moves it to custom.
 * 
 * @returns {Promise<void>} Resolves when the test audio is ensured.
 */
const ensureTestAudio = async () => {
    ensureDirs();
    const testAudioPath = path.join(AUDIO_CUSTOM_DIR, 'test.mp3');
    const testMetaPath = path.join(META_CUSTOM_DIR, 'test.mp3.json');

    if (fs.existsSync(testAudioPath) && fs.existsSync(testMetaPath)) {
        return;
    }

    console.log('[AudioService] Generating "test.mp3" for output testing...');
    const config = configService.get();
    const pythonServiceUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';
    const voice = 'en-GB-RyanNeural';
    const text = 'This is a test of the notification system!';
    const filename = 'test.mp3';

    try {
        // Generate into cache first (default behavior of TTS service)
        await generateTTS(filename, text, pythonServiceUrl, voice);
        
        const cacheAudioPath = path.join(AUDIO_CACHE_DIR, filename);

        // Move to custom (Use copy + unlink to handle cross-device moves in Docker)
        if (fs.existsSync(cacheAudioPath)) {
            try {
                fs.copyFileSync(cacheAudioPath, testAudioPath);
                fs.unlinkSync(cacheAudioPath);
            } catch (moveError) {
                // Fallback for extreme cases if copy fails
                console.error(`[AudioService] Move failed, attempting rename fallback:`, moveError.message);
                fs.renameSync(cacheAudioPath, testAudioPath);
            }
            
            // Generate metadata for the custom file
            const metadata = await audioValidator.analyseAudioFile(testAudioPath);
            const augmentedData = {};
            OutputFactory.getAllStrategyInstances().forEach(instance => {
                Object.assign(augmentedData, instance.augmentAudioMetadata(metadata));
            });

            fs.writeFileSync(testMetaPath, JSON.stringify({
                text,
                voice,
                generatedAt: new Date().toISOString(),
                hidden: true,
                ...metadata,
                ...augmentedData
            }));
            
            console.log('[AudioService] "test.mp3" generated and moved to custom.');
        }
    } catch (error) {
        console.error('[AudioService] Failed to generate test audio:', error.message);
    }
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
        const response = await axios.post(`${pythonUrl}/preview-tts`, 
            { text, voice, filename },
            { maxContentLength: 5000000 }
        );
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
                    
                    // Polymorphically augment metadata from all strategies
                    const augmentedData = {};
                    OutputFactory.getAllStrategyInstances().forEach(instance => {
                        Object.assign(augmentedData, instance.augmentAudioMetadata(metadata));
                    });
                    
                    let existingData = {};
                    if (fs.existsSync(legacyMetaPath)) {
                        try { existingData = JSON.parse(fs.readFileSync(legacyMetaPath, 'utf8')); } catch (e) {}
                    } else if (fs.existsSync(redundantMetaPath)) {
                        try { existingData = JSON.parse(fs.readFileSync(redundantMetaPath, 'utf8')); } catch (e) {}
                    }
                    
                    // REQ: azan.mp3 should be protected
                    if (file === 'azan.mp3') {
                        existingData.protected = true;
                    }
                    
                    fs.writeFileSync(metaPath, JSON.stringify({
                        ...existingData,
                        ...metadata,
                        ...augmentedData,
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
    ensureTTSFile,
    ensureTestAudio,
    cleanupCache,
    cleanupTempAudio,
    resolveTemplate,
    previewTTS,
    generateMetadataForExistingFiles
};
