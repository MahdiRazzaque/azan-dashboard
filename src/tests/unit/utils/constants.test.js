const constants = require('@utils/constants');

describe('Constants Unit Test', () => {
    it('should have export all required constants', () => {
        expect(constants.CALCULATION_METHODS).toBeDefined();
        expect(constants.ASR_JURISTIC_METHODS).toBeDefined();
        expect(constants.LATITUDE_ADJUSTMENT_METHODS).toBeDefined();
        expect(constants.MIDNIGHT_MODES).toBeDefined();
        expect(constants.IQAMAH_PRAYERS).toBeDefined();
        expect(constants.API_BASE_URL).toBeDefined();
    });

    it('should have correct URL', () => {
        expect(constants.API_BASE_URL).toBe('http://api.aladhan.com/v1');
    });

    it('should have TTS_TEMPLATE_MAX_LENGTH', () => {
        expect(constants.TTS_TEMPLATE_MAX_LENGTH).toBe(50);
    });

    it('should have AUDIO_PATHS', () => {
        expect(constants.AUDIO_PATHS).toEqual({
            CUSTOM_DIR: 'public/audio/custom',
            CACHE_DIR: 'public/audio/cache',
            TEMP_DIR: 'public/audio/temp'
        });
    });

    it('should have TTS_FILENAME_PATTERN', () => {
        expect(constants.TTS_FILENAME_PATTERN).toBe('tts_{prayer}_{event}.mp3');
    });
});
