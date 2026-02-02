const fs = require('fs/promises');
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
        const stats = await fs.stat(filePath);
        
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

module.exports = {
    analyseAudioFile
};