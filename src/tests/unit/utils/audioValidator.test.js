const { getMimeType } = require('@utils/audioValidator');

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

        it('should fallback to extension if container is unknown', () => {
            const format = {
                container: 'Unknown',
                codec: 'Unknown'
            };
            expect(getMimeType(format, 'test.mp3')).toBe('audio/mpeg');
            expect(getMimeType(format, 'test.wav')).toBe('audio/wav');
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
});
