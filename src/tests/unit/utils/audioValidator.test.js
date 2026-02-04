const { getMimeType, analyseAudioFile } = require('@utils/audioValidator');
const fs = require('fs/promises');

jest.mock('fs/promises');
jest.mock('music-metadata', () => ({
    parseFile: jest.fn()
}), { virtual: true });

describe('AudioValidator Util', () => {
    describe('getMimeType', () => {
        it('should return correct MIME type for MP3 (MPEG/L3)', () => {
            const format = {
                container: 'MPEG',
                codec: 'MPEG 1 Layer 3'
            };
            expect(getMimeType(format, 'test.mp3')).toBe('audio/mpeg');
        });

        it('should return correct MIME type for WAV', () => {
            const format = {
                container: 'WAV',
                codec: 'PCM'
            };
            expect(getMimeType(format, 'test.wav')).toBe('audio/wav');
        });

        it('should return correct MIME type for AAC', () => {
            const format = {
                container: 'ADTS',
                codec: 'AAC'
            };
            expect(getMimeType(format, 'test.aac')).toBe('audio/aac');
        });

        it('should return correct MIME type for OGG', () => {
            const format = {
                container: 'Ogg',
                codec: 'Vorbis'
            };
            expect(getMimeType(format, 'test.ogg')).toBe('audio/ogg');
        });

        it('should return correct MIME type for OPUS', () => {
            const format = {
                container: 'Ogg',
                codec: 'Opus'
            };
            expect(getMimeType(format, 'test.opus')).toBe('audio/opus');
        });

        it('should return correct MIME type for FLAC', () => {
            const format = {
                container: 'FLAC',
                codec: 'FLAC'
            };
            expect(getMimeType(format, 'test.flac')).toBe('audio/flac');
        });

        it('should return correct MIME type for AAC codec', () => {
            const format = {
                container: 'Unknown',
                codec: 'AAC'
            };
            expect(getMimeType(format, 'test.unknown')).toBe('audio/aac');
        });

        it('should fallback to extension if container is unknown', () => {
            const format = {
                container: 'Unknown',
                codec: 'Unknown'
            };
            expect(getMimeType(format, 'test.mp3')).toBe('audio/mpeg');
            expect(getMimeType(format, 'test.wav')).toBe('audio/wav');
            expect(getMimeType(format, 'test.aac')).toBe('audio/aac');
            expect(getMimeType(format, 'test.ogg')).toBe('audio/ogg');
            expect(getMimeType(format, 'test.opus')).toBe('audio/opus');
            expect(getMimeType(format, 'test.flac')).toBe('audio/flac');
        });

        it('should use lossless flag as last resort', () => {
            const format = {
                container: 'Unknown',
                codec: 'Unknown',
                lossless: true
            };
            expect(getMimeType(format, 'test.unknown')).toBe('audio/wav');

            const format2 = {
                container: 'Unknown',
                codec: 'Unknown',
                lossless: false
            };
            expect(getMimeType(format2, 'test.unknown')).toBe('audio/mpeg');
        });
    });

    describe('analyseAudioFile', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should analyse audio file successfully', async () => {
            const { parseFile } = require('music-metadata');
            parseFile.mockResolvedValue({
                format: {
                    container: 'MPEG',
                    codec: 'MPEG 1 Layer 3',
                    bitrate: 128000,
                    sampleRate: 44100,
                    duration: 10.5
                }
            });
            fs.stat.mockResolvedValue({ size: 1024 });

            const result = await analyseAudioFile('test.mp3');

            expect(result).toEqual({
                format: 'MPEG',
                codec: 'MPEG 1 Layer 3',
                bitrate: 128000,
                sampleRate: 44100,
                duration: 10.5,
                size: 1024,
                mimeType: 'audio/mpeg'
            });
        });

        it('should handle errors during analysis', async () => {
            const { parseFile } = require('music-metadata');
            parseFile.mockRejectedValue(new Error('Parse error'));

            await expect(analyseAudioFile('test.mp3')).rejects.toThrow('Parse error');
        });
    });
});
