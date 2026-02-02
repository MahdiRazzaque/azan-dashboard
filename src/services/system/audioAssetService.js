const fs = require('fs');
const fsp = fs.promises;
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
 * Helper to ensure a single directory exists.
 */
async function ensureDir(dir) {
    try {
        await fsp.access(dir);
    } catch (e) {
        await fsp.mkdir(dir, { recursive: true });
    }
}

/**
 * Ensures that necessary directories exist.
 */
const ensureDirs = async () => {
    const dirs = [AUDIO_CACHE_DIR, AUDIO_TEMP_DIR, AUDIO_CUSTOM_DIR, META_CACHE_DIR, META_CUSTOM_DIR];
    await Promise.all(dirs.map(ensureDir));
};

/**
 * Internal helper to build full metadata including compatibility blocks.
 */
const enrichMetadata = async (audioPath, basicMetadata) => {
    const compatibility = {};
    const strategyInstances = OutputFactory.getAllStrategyInstances();
    
    for (const instance of strategyInstances) {
        const metadata = instance.constructor.getMetadata();
        compatibility[metadata.id] = await instance.validateAsset(audioPath, basicMetadata);
    }
    
    // Legacy support: aggregate flat fields (e.g. vmCompatible)
    const legacyAugmentedData = {};
    strategyInstances.forEach(instance => {
        Object.assign(legacyAugmentedData, instance.augmentAudioMetadata(basicMetadata));
    });

    return {
        ...basicMetadata,
        ...legacyAugmentedData,
        compatibility,
        updatedAt: new Date().toISOString()
    };
};

/**
 * Cleans up old audio files from the cache directory.
 */
const cleanupCache = async () => {
    await ensureDirs();
    const now = Date.now();
    const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

    try {
        const files = await fsp.readdir(AUDIO_CACHE_DIR);
        for (const file of files) {
            const filePath = path.join(AUDIO_CACHE_DIR, file);
            const stats = await fsp.stat(filePath);
            if (now - stats.mtimeMs > MAX_AGE) {
                await fsp.unlink(filePath);
                
                // Cleanup metadata as well
                const metaPath = path.join(META_CACHE_DIR, file + '.json');
                try {
                    await fsp.access(metaPath);
                    await fsp.unlink(metaPath);
                } catch (e) { /* ignore */ }
                
                console.log(`[AudioService] Deleted old cache file and meta: ${file}`);
            }
        }
    } catch (error) {
        console.error('[AudioService] Cache cleanup failed:', error.message);
    }
};

/**
 * Cleans up temporary preview audio files.
 */
const cleanupTempAudio = async (force = false) => {
    console.log(`[AudioService] Cleaning up temporary audio files (force: ${force})...`);
    try {
        await fsp.access(AUDIO_TEMP_DIR);
    } catch (e) {
        return;
    }

    const now = Date.now();
    const MAX_AGE = 1 * 60 * 60 * 1000; // 1 hour

    try {
        const files = await fsp.readdir(AUDIO_TEMP_DIR);
        let deletedCount = 0;
        for (const file of files) {
            if (!file.endsWith('.mp3')) continue;
            const filePath = path.join(AUDIO_TEMP_DIR, file);
            const stats = await fsp.stat(filePath);
            
            if (force || (now - stats.mtimeMs > MAX_AGE)) {
                await fsp.unlink(filePath);
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
 */
const ensureTTSFile = async (prayer, event, settings, config) => {
    const pythonServiceUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';
    const text = resolveTemplate(settings.template, prayer, settings.offsetMinutes);
    const filename = `tts_${prayer}_${event}.mp3`;
    const audioPath = path.join(AUDIO_CACHE_DIR, filename);
    const metaPath = path.join(META_CACHE_DIR, filename + '.json');
    const effectiveVoice = settings.voice || config.automation?.defaultVoice || 'ar-SA-HamedNeural';

    let shouldGenerate = true;
    try {
        await fsp.access(audioPath);
        await fsp.access(metaPath);
        
        const content = await fsp.readFile(metaPath, 'utf8');
        const meta = JSON.parse(content);
        if (meta.text === text && meta.voice === effectiveVoice) {
            const now = new Date();
            await fsp.utimes(audioPath, now, now);
            await fsp.utimes(metaPath, now, now);
            shouldGenerate = false;
        }
    } catch (e) { /* missing or corrupted */ }

    if (!shouldGenerate) {
        return { success: true, message: 'Valid file exists', generated: false };
    }

    // Check TTS Health before generating
    const healthCheck = require('./healthCheck');
    const ttsHealth = await healthCheck.refresh('all');
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
        
        const basicMetadata = await audioValidator.analyseAudioFile(audioPath);
        const enrichedMetadata = await enrichMetadata(audioPath, basicMetadata);
        
        await fsp.writeFile(metaPath, JSON.stringify({ 
            text, 
            voice: effectiveVoice,
            generatedAt: new Date().toISOString(),
            ...enrichedMetadata
        }));
        return { success: true, message: 'Successfully generated', generated: true };
    } catch (e) {
        console.error(`[AudioService] TTS generation failed for ${filename}:`, e.message);
        return { success: false, message: e.message, generated: false };
    }
};

/**
 * Synchronises audio assets with the current configuration.
 */
const syncAudioAssets = async (forceClean = false) => {
    console.log('[AudioService] Synchronising audio assets...');
    await ensureDirs();
    
    const config = configService.get();
    const triggers = config.automation?.triggers;
    const warnings = [];

    if (forceClean) {
        console.log('[AudioService] Force cleaning all cached assets...');
        const dirs = [AUDIO_CACHE_DIR, META_CACHE_DIR];
        for (const dir of dirs) {
            try {
                await fsp.access(dir);
                const files = await fsp.readdir(dir);
                await Promise.all(files.map(f => fsp.unlink(path.join(dir, f))));
            } catch (e) { /* ignore */ }
        }
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
                throw err;
            }
        }
    }
    
    await cleanupCache();
    await cleanupTempAudio();
    console.log('[AudioService] Asset preparation complete.');
    return { warnings };
};

/**
 * Ensures that a "test.mp3" file exists.
 */
const ensureTestAudio = async () => {
    await ensureDirs();
    const testAudioPath = path.join(AUDIO_CUSTOM_DIR, 'test.mp3');
    const testMetaPath = path.join(META_CUSTOM_DIR, 'test.mp3.json');

    try {
        await fsp.access(testAudioPath);
        await fsp.access(testMetaPath);
        return;
    } catch (e) {
        // Continue to generation
    }

    console.log('[AudioService] Generating "test.mp3" for output testing...');
    const config = configService.get();
    const pythonServiceUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';
    const voice = 'en-GB-RyanNeural';
    const text = 'This is a test of the notification system!';
    const filename = 'test.mp3';

    try {
        await generateTTS(filename, text, pythonServiceUrl, voice);
        
        const cacheAudioPath = path.join(AUDIO_CACHE_DIR, filename);

        try {
            await fsp.access(cacheAudioPath);
            try {
                await fsp.copyFile(cacheAudioPath, testAudioPath);
                await fsp.unlink(cacheAudioPath);
            } catch (moveError) {
                console.error(`[AudioService] Move failed, attempting rename fallback:`, moveError.message);
                await fsp.rename(cacheAudioPath, testAudioPath);
            }
            
            const basicMetadata = await audioValidator.analyseAudioFile(testAudioPath);
            const enrichedMetadata = await enrichMetadata(testAudioPath, basicMetadata);

            await fsp.writeFile(testMetaPath, JSON.stringify({
                text,
                voice,
                generatedAt: new Date().toISOString(),
                hidden: true,
                ...enrichedMetadata
            }));
            
            console.log('[AudioService] "test.mp3" generated and moved to custom.');
        } catch (e) {
             console.error(`[AudioService] Cache file missing after generation: ${cacheAudioPath}`);
        }
    } catch (error) {
        console.error('[AudioService] Failed to generate test audio:', error.message);
    }
};

/**
 * Generates a temporary TTS preview.
 */
const previewTTS = async (template, prayerKey, offsetMinutes, voice) => {
    const text = resolveTemplate(template, prayerKey.toLowerCase(), offsetMinutes);
    const config = configService.get();
    const pythonUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';

    const hash = crypto.createHash('md5').update(`${text}|${voice}`).digest('hex').slice(0, 12);
    const filename = `preview_${hash}.mp3`;
    const audioPath = path.join(AUDIO_TEMP_DIR, filename);

    try {
        await fsp.access(audioPath);
        const stats = await fsp.stat(audioPath);
        if (Date.now() - stats.mtimeMs < 1 * 60 * 60 * 1000) {
            const now = new Date();
            await fsp.utimes(audioPath, now, now);
            return { url: `/public/audio/temp/${filename}` };
        }
    } catch (e) { /* doesn't exist */ }

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
 * Generates metadata sidecar files for any existing audio files.
 */
const generateMetadataForExistingFiles = async () => {
    await ensureDirs();
    const directories = [
        { audio: AUDIO_CUSTOM_DIR, meta: META_CUSTOM_DIR },
        { audio: AUDIO_CACHE_DIR, meta: META_CACHE_DIR }
    ];
    
    for (const dirSet of directories) {
        try {
            await fsp.access(dirSet.audio);
        } catch (e) { continue; }
        
        const files = (await fsp.readdir(dirSet.audio)).filter(f => f.endsWith('.mp3'));
        for (const file of files) {
            const audioPath = path.join(dirSet.audio, file);
            const metaPath = path.join(dirSet.meta, file + '.json');
            
            const legacyMetaPath = audioPath + '.json';
            const redundantMetaPath = audioPath + '.meta.json';
            
            try {
                await fsp.access(metaPath);
                // Already exists
            } catch (e) {
                try {
                    console.log(`[AudioService] Generating metadata for ${file}...`);
                    const basicMetadata = await audioValidator.analyseAudioFile(audioPath);
                    const enrichedMetadata = await enrichMetadata(audioPath, basicMetadata);
                    
                    let existingData = {};
                    try {
                        await fsp.access(legacyMetaPath);
                        existingData = JSON.parse(await fsp.readFile(legacyMetaPath, 'utf8'));
                    } catch (err1) {
                        try {
                            await fsp.access(redundantMetaPath);
                            existingData = JSON.parse(await fsp.readFile(redundantMetaPath, 'utf8'));
                        } catch (err2) {}
                    }
                    
                    if (file === 'azan.mp3') {
                        existingData.protected = true;
                    }
                    
                    await fsp.writeFile(metaPath, JSON.stringify({
                        ...existingData,
                        ...enrichedMetadata
                    }));

                    try { await fsp.unlink(legacyMetaPath); } catch (e) {}
                    try { await fsp.unlink(redundantMetaPath); } catch (e) {}
                    
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
    generateMetadataForExistingFiles,
    enrichMetadata
};