const fs = require('fs');
const { analyseAudioFile, validateVoiceMonkeyCompatibility } = require('@utils/audioValidator');

jest.mock('fs');
// We cannot easily mock dynamic import() in Jest CJS without --experimental-vm-modules
// if it's called in the source code. But we can try to mock the module and see.
jest.mock('music-metadata', () => ({
    parseFile: jest.fn()
}), { virtual: true });

describe('AudioValidator Util', () => {
    describe('validateVoiceMonkeyCompatibility', () => {
        it('should return compatible if all checks pass', () => {
            const metadata = {
                format: 'mp3',
                codec: 'LAME',
                bitrate: 128000,
                sampleRate: 44100,
                size: 1024 * 1024,
                duration: 120
            };
            const result = validateVoiceMonkeyCompatibility(metadata);
            expect(result.vmCompatible).toBe(true);
            expect(result.vmIssues).toHaveLength(0);
        });

        it('should identify unsupported format', () => {
            const metadata = {
                format: 'flac',
                codec: 'flac'
            };
            const result = validateVoiceMonkeyCompatibility(metadata);
            expect(result.vmCompatible).toBe(false);
            expect(result.vmIssues[0]).toContain('Unsupported format');
        });

        it('should identify high bitrate', () => {
            const metadata = {
                format: 'mp3',
                bitrate: 2000000 // > 1411200
            };
            const result = validateVoiceMonkeyCompatibility(metadata);
            expect(result.vmCompatible).toBe(false);
            expect(result.vmIssues).toContain('Bitrate too high: 2000.00 kbps (Max 1411.20 kbps)');
        });

        it('should identify high sample rate', () => {
            const metadata = {
                format: 'mp3',
                sampleRate: 48001
            };
            const result = validateVoiceMonkeyCompatibility(metadata);
            expect(result.vmCompatible).toBe(false);
            expect(result.vmIssues).toContain('Sample rate too high: 48001 Hz (Max 48000 Hz)');
        });

        it('should identify large file size', () => {
            const metadata = {
                format: 'mp3',
                size: 11 * 1024 * 1024
            };
            const result = validateVoiceMonkeyCompatibility(metadata);
            expect(result.vmCompatible).toBe(false);
            expect(result.vmIssues).toContain('File size too large: 11.00 MB (Max 10 MB)');
        });

        it('should identify long duration', () => {
            const metadata = {
                format: 'mp3',
                duration: 241
            };
            const result = validateVoiceMonkeyCompatibility(metadata);
            expect(result.vmCompatible).toBe(false);
            expect(result.vmIssues).toContain('Duration too long: 241.00s (Max 240s)');
        });

        it('should handle missing metadata fields gracefully', () => {
            const result = validateVoiceMonkeyCompatibility({});
            // It will fail format check as undefined.toLowerCase() would throw if not handled
            // But the code does: const format = (metadata.format || '').toLowerCase();
            expect(result.vmCompatible).toBe(false);
        });
    });

    describe('analyseAudioFile', () => {
        it('should handle analysis errors', async () => {
            // Since we can't easily mock the dynamic import without breaking the test runner,
            // we'll at least test that if it fails it throws.
            // If the dynamic import itself fails due to environment, it should hit the catch block.
            await expect(analyseAudioFile('missing.mp3')).rejects.toThrow();
        });
    });
});
