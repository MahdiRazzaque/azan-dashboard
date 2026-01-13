const fs = require('fs');
const path = require('path');
const axios = require('axios');
const numberToWords = require('number-to-words');
const config = require('../config');

const CACHE_DIR = path.join(__dirname, '../../public/audio/cache');
const ARABIC_NAMES = {
    fajr: 'الفجر',
    dhuhr: 'الظهر',
    asr: 'العصر',
    maghrib: 'المغرب',
    isha: 'العشاء'
};

const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

const getPythonServiceUrl = () => {
    return config.automation?.pythonServiceUrl || 'http://localhost:8000';
};

const ensureCacheDir = () => {
    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
};

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
        console.error('[AudioService] Cleanup failed:', error.message);
    }
};

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

const generateTTS = async (filename, text) => {
    try {
        const url = `${getPythonServiceUrl()}/generate-tts`;
        // Voice could be configurable, defaulting to Arabic for mixed content or English?
        // PRD US-1 says "Arabic pronunciation" for names but English text?
        // "Fifteen minutes till Al-Fajr"
        // Edge-TTS supports multi-lingual? Or just one voice.
        // If the text is mixed "Fifteen minutes till الفجر", Arabic voices like 'ar-SA-NaayfNeural' usually read English with an accent, 
        // while English voices might skip Arabic chars.
        // Phase 3 PRD goals: "Generate natural-sounding Arabic audio... using Edge TTS"
        // Task details: "Map English prayer names to Arabic".
        // I'll stick to the default voice defined in Python service (Arabic) or user configured.
        // We will send default voice if not specified.
        
        await axios.post(url, {
            text: text,
            filename: filename,
            voice: "ar-SA-NaayfNeural" // Forcing Arabic voice as per requirement for proper name pronunciation, usually handles English too.
        });
        console.log(`[AudioService] Generated: ${filename}`);
    } catch (error) {
        console.error(`[AudioService] TTS Generation failed for ${filename}:`, error.message);
        // Don't throw, just log. We don't want to break the whole loop.
    }
};

const prepareDailyAssets = async () => {
    console.log('[AudioService] Preparing daily audio assets...');
    ensureCacheDir();
    
    const triggers = config.automation?.triggers;
    if (!triggers) return;

    for (const prayer of PRAYER_NAMES) {
        const prayerTriggers = triggers[prayer];
        if (!prayerTriggers) continue;

        // Iterate events: preAdhan, adhan, preIqamah, iqamah
        for (const [event, settings] of Object.entries(prayerTriggers)) {
            if (!settings.enabled || settings.type !== 'tts' || !settings.template) {
                continue;
            }

            const text = resolveTemplate(settings.template, prayer, settings.offsetMinutes);
            const filename = `tts_${prayer}_${event}.mp3`;
            const filePath = path.join(CACHE_DIR, filename);

            // Check if exists? 
            // We regenerate daily to capture config changes (template/offset changes).
            // Optimization: could check if file exists and config hasn't changed? 
            // For now, allow overwrite. It's cheap.
            
            await generateTTS(filename, text);
        }
    }
    
    await cleanupCache();
    console.log('[AudioService] Asset preparation complete.');
};

module.exports = {
    prepareDailyAssets,
    cleanupCache
};
