const fs = require('fs/promises');
const path = require('path');

/**
 * Maps audio metadata to a MIME type.
 * 
 * @param {Object} format - Metadata format object.
 * @param {string} filePath - Path to the audio file for extension fallback.
 * @returns {string} The detected MIME type.
 */
const getMimeType = (format, filePath) => {
    const container = (format.container || '').toLowerCase();
    const codec = (format.codec || '').toLowerCase();
    const ext = path.extname(filePath).toLowerCase();

    // 1. Check by specific codecs first
    if (codec === 'opus') return 'audio/opus';
    if (codec.includes('aac')) return 'audio/aac';
    
    // 2. Check by container
    if (container === 'wav' || container === 'wave') return 'audio/wav';
    if (container === 'ogg') return 'audio/ogg';
    if (container === 'adts') return 'audio/aac';
    if (container === 'flac') return 'audio/flac';
    if (container === 'mpeg' && codec.includes('3')) return 'audio/mpeg';

    // 3. Fallback to extension
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.aac') return 'audio/aac';
    if (ext === '.ogg') return 'audio/ogg';
    if (ext === '.opus') return 'audio/opus';
    if (ext === '.flac') return 'audio/flac';

    // 4. Default based on lossy/lossless
    return format.lossless ? 'audio/wav' : 'audio/mpeg';
};

/**
 * Analyses an audio file using music-metadata.
 * Uses dynamic import since music-metadata is ESM only.
 * 
 * @param {string} filePath - Path to the audio file.
 * @returns {Promise<Object>} Metadata object.
 */
const analyseAudioFile = async (filePath) => {
    try {
        const { parseFile } = require('music-metadata');
        const metadata = await parseFile(filePath);
        const stats = await fs.stat(filePath);
        
        return {
            format: metadata.format.container,
            codec: metadata.format.codec,
            bitrate: metadata.format.bitrate,
            sampleRate: metadata.format.sampleRate,
            duration: metadata.format.duration,
            size: stats.size,
            mimeType: getMimeType(metadata.format, filePath)
        };
    } catch (error) {
        // nosemgrep: unsafe-formatstring -- filePath is an internal server path, not user HTTP input
        console.error(`[AudioValidator] Failed to analyse file ${filePath}:`, error.message);
        throw error;
    }
};

module.exports = {
    analyseAudioFile,
    getMimeType
};
