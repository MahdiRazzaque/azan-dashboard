const fs = require('fs');
const path = require('path');

/**
 * Analyses an audio file using music-metadata.
 * Uses dynamic import since music-metadata is ESM only.
 * 
 * @param {string} filePath - Path to the audio file.
 * @returns {Promise<Object>} Metadata object.
 */
const analyseAudioFile = async (filePath) => {
    try {
        const { parseFile } = await import('music-metadata');
        const metadata = await parseFile(filePath);
        const stats = fs.statSync(filePath);
        
        return {
            format: metadata.format.container,
            codec: metadata.format.codec,
            bitrate: metadata.format.bitrate,
            sampleRate: metadata.format.sampleRate,
            duration: metadata.format.duration,
            size: stats.size,
            mimeType: metadata.format.lossless ? 'audio/wav' : 'audio/mpeg' // simplistic but enough for metadata sidecars
        };
    } catch (error) {
        console.error(`[AudioValidator] Failed to analyse file ${filePath}:`, error.message);
        throw error;
    }
};

/**
 * Validates audio metadata against VoiceMonkey/Alexa requirements.
 * 
 * @param {Object} metadata - Metadata object from analyseAudioFile.
 * @returns {Object} { vmCompatible: boolean, vmIssues: string[] }
 */
const validateVoiceMonkeyCompatibility = (metadata) => {
    const issues = [];
    
    // 1. Format Check (aac, mp3, ogg, opus, wav)
    const supportedFormats = ['aac', 'mp3', 'ogg', 'opus', 'wav', 'mpeg', 'ADTS', 'MPEG'];
    const format = (metadata.format || '').toLowerCase();
    const codec = (metadata.codec || '').toLowerCase();
    
    const isSupported = supportedFormats.some(f => 
        format.includes(f.toLowerCase()) || codec.includes(f.toLowerCase())
    );
    
    if (!isSupported) {
        issues.push(`Unsupported format: ${metadata.format} / ${metadata.codec}`);
    }

    // 2. Bitrate (<= 1411.20 kbps)
    if (metadata.bitrate && metadata.bitrate > 1411200) {
        issues.push(`Bitrate too high: ${(metadata.bitrate / 1000).toFixed(2)} kbps (Max 1411.20 kbps)`);
    }

    // 3. Sample Rate (<= 48000 Hz)
    if (metadata.sampleRate && metadata.sampleRate > 48000) {
        issues.push(`Sample rate too high: ${metadata.sampleRate} Hz (Max 48000 Hz)`);
    }

    // 4. File Size (<= 10 MB)
    if (metadata.size && metadata.size > 10 * 1024 * 1024) {
        issues.push(`File size too large: ${(metadata.size / (1024 * 1024)).toFixed(2)} MB (Max 10 MB)`);
    }

    // 5. Duration (<= 240 seconds)
    if (metadata.duration && metadata.duration > 240) {
        issues.push(`Duration too long: ${metadata.duration.toFixed(2)}s (Max 240s)`);
    }

    return {
        vmCompatible: issues.length === 0,
        vmIssues: issues
    };
};

module.exports = {
    analyseAudioFile,
    validateVoiceMonkeyCompatibility
};
