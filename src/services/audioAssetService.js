const fs = require('fs');
const path = require('path');
const axios = require('axios');
const numberToWords = require('number-to-words');
const configService = require('../config'); // Singleton

const CACHE_DIR = path.join(__dirname, '../../public/audio/cache');
const ARABIC_NAMES = {
    fajr: 'فجر',
    dhuhr: 'ظُهْر',
    asr: 'عصر',
    maghrib: 'مغرب',
    isha: 'عشاء'
};

const PRAYER_NAMES = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

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

// Added serviceUrl parameter to make dependency explicit
const generateTTS = async (filename, text, serviceUrl) => {
    try {
        const url = `${serviceUrl}/generate-tts`;
                
        await axios.post(url, {
            text: text,
            filename: filename,
            voice: "ar-DZ-IsmaelNeural" // Forcing Arabic voice as per requirement for proper name pronunciation, usually handles English too.
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
    
    // Dynamic require to get fresh config ONCE
    const config = configService.get();
    const triggers = config.automation?.triggers;
    const pythonServiceUrl = config.automation?.pythonServiceUrl || 'http://localhost:8000';

    if (!triggers) return;

    for (const prayer of PRAYER_NAMES) {
        const prayerTriggers = triggers[prayer];
        if (!prayerTriggers) continue;

        // Iterate events: preAdhan, adhan, preIqamah, iqamah
        for (const [event, settings] of Object.entries(prayerTriggers)) {
            //console.log(event, settings);
            if (!settings.enabled || settings.type !== 'tts' || !settings.template) {
                //console.log(`[AudioService] Skipping ${prayer} - ${event} (disabled or not TTS)`);
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
                    if (meta.text === text) {
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
                // Pass the URL derived from the fresh config
                await generateTTS(filename, text, pythonServiceUrl);
                fs.writeFileSync(metaPath, JSON.stringify({ text, generatedAt: new Date().toISOString() }));
            }
        }
    }
    
    await cleanupCache();
    console.log('[AudioService] Asset preparation complete.');
};

module.exports = {
    prepareDailyAssets,
    cleanupCache
};
