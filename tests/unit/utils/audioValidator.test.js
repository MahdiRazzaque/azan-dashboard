const { analyseAudioFile } = require('@utils/audioValidator');

describe('AudioValidator Util', () => {
    describe('analyseAudioFile', () => {
        it('should handle analysis errors', async () => {
            // Since we can't easily mock the dynamic import without breaking the test runner,
            // we'll at least test that if it fails it throws.
            // If the dynamic import itself fails due to environment, it should hit the catch block.
            await expect(analyseAudioFile('missing.mp3')).rejects.toThrow();
        });
    });
});