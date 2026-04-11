const path = require('path');
const { sanitiseFilename, isPathContained, FILENAME_ALLOWLIST } = require('@utils/pathSecurity');

describe('pathSecurity', () => {
    describe('sanitiseFilename', () => {
        it('should return a valid filename unchanged', () => {
            expect(sanitiseFilename('test.mp3')).toBe('test.mp3');
        });

        it('should accept filenames with dots, dashes, and underscores', () => {
            expect(sanitiseFilename('my-file_v2.0.mp3')).toBe('my-file_v2.0.mp3');
        });

        it('should return null for path traversal', () => {
            expect(sanitiseFilename('../etc/passwd')).toBeNull();
        });

        it('should return null for absolute path', () => {
            expect(sanitiseFilename('/etc/passwd')).toBeNull();
        });

        it('should return null for dot', () => {
            expect(sanitiseFilename('.')).toBeNull();
        });

        it('should return null for dotdot', () => {
            expect(sanitiseFilename('..')).toBeNull();
        });

        it('should return null for filename with slashes', () => {
            expect(sanitiseFilename('foo/bar.mp3')).toBeNull();
        });

        it('should return null for empty string', () => {
            expect(sanitiseFilename('')).toBeNull();
        });

        it('should return null for filename with spaces', () => {
            expect(sanitiseFilename('file name.mp3')).toBeNull();
        });

        it('should coerce non-string input to string', () => {
            expect(sanitiseFilename(12345)).toBe('12345');
        });

        it('should return null for backslash-separated path', () => {
            expect(sanitiseFilename('foo\\bar.mp3')).toBeNull();
        });
    });

    describe('isPathContained', () => {
        it('should return true for a path inside the root', () => {
            expect(isPathContained('/audio/custom/test.mp3', '/audio')).toBe(true);
        });

        it('should return true for a deeply nested path', () => {
            expect(isPathContained('/audio/custom/sub/deep/test.mp3', '/audio')).toBe(true);
        });

        it('should return false for an absolute path unrelated to root', () => {
            expect(isPathContained('/etc/passwd', '/audio')).toBe(false);
        });

        it('should return false for traversal that resolves outside root', () => {
            const escapingPath = path.resolve('/audio', '../etc/passwd');
            expect(isPathContained(escapingPath, '/audio')).toBe(false);
        });

        it('should return false when relative result is exact dotdot', () => {
            expect(isPathContained('/audio', '/audio/custom')).toBe(false);
        });

        it('should return true for a dotdot-prefixed filename inside root', () => {
            expect(isPathContained('/audio/..foo.mp3', '/audio')).toBe(true);
        });
    });

    describe('FILENAME_ALLOWLIST', () => {
        it('should match alphanumeric filenames with dots, dashes, underscores', () => {
            expect(FILENAME_ALLOWLIST.test('hello-world_v1.0.mp3')).toBe(true);
        });

        it('should reject filenames with spaces', () => {
            expect(FILENAME_ALLOWLIST.test('hello world.mp3')).toBe(false);
        });

        it('should reject empty string', () => {
            expect(FILENAME_ALLOWLIST.test('')).toBe(false);
        });
    });
});
