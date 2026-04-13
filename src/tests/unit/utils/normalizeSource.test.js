const path = require('path');

// The AUDIO_ROOT constant used in normalizeSource
const AUDIO_ROOT = path.resolve(__dirname, '../../../../public/audio');

const normalizeSource = require('@utils/normalizeSource');

describe('normalizeSource', () => {

    describe('file sources from relative path', () => {
        it('should normalize { path } into canonical file source', () => {
            const result = normalizeSource({ path: 'custom/test.mp3' });
            expect(result).toEqual({
                type: 'file',
                filePath: path.join(AUDIO_ROOT, 'custom/test.mp3'),
                url: '/public/audio/custom/test.mp3'
            });
        });

        it('should normalize { path } with cache directory', () => {
            const result = normalizeSource({ path: 'cache/tts_fajr_azan.mp3' });
            expect(result).toEqual({
                type: 'file',
                filePath: path.join(AUDIO_ROOT, 'cache/tts_fajr_azan.mp3'),
                url: '/public/audio/cache/tts_fajr_azan.mp3'
            });
        });

        it('should handle path with leading slash by stripping it', () => {
            const result = normalizeSource({ path: '/custom/test.mp3' });
            expect(result).toEqual({
                type: 'file',
                filePath: path.join(AUDIO_ROOT, 'custom/test.mp3'),
                url: '/public/audio/custom/test.mp3'
            });
        });
    });

    describe('file sources from filePath + url (automation flow)', () => {
        it('should normalize { filePath, url } into canonical file source', () => {
            const absolutePath = path.join(AUDIO_ROOT, 'cache/tts_fajr_azan.mp3');
            const result = normalizeSource({
                filePath: absolutePath,
                url: '/public/audio/cache/tts_fajr_azan.mp3'
            });
            expect(result).toEqual({
                type: 'file',
                filePath: absolutePath,
                url: '/public/audio/cache/tts_fajr_azan.mp3'
            });
        });

        it('should normalize { filePath, url } for custom files', () => {
            const absolutePath = path.join(AUDIO_ROOT, 'custom/adhan.mp3');
            const result = normalizeSource({
                filePath: absolutePath,
                url: '/public/audio/custom/adhan.mp3'
            });
            expect(result).toEqual({
                type: 'file',
                filePath: absolutePath,
                url: '/public/audio/custom/adhan.mp3'
            });
        });
    });

    describe('file sources from FileManagerView shape { path, url, filePath: null }', () => {
        it('should normalize FileManager shape using path for filePath derivation', () => {
            const result = normalizeSource({
                path: 'custom/adhan.mp3',
                url: '/public/audio/custom/adhan.mp3',
                filePath: null
            });
            expect(result).toEqual({
                type: 'file',
                filePath: path.join(AUDIO_ROOT, 'custom/adhan.mp3'),
                url: '/public/audio/custom/adhan.mp3'
            });
        });
    });

    describe('URL sources', () => {
        it('should normalize { url } with http URL as url source', () => {
            const result = normalizeSource({ url: 'http://example.com/audio.mp3' });
            expect(result).toEqual({
                type: 'url',
                url: 'http://example.com/audio.mp3'
            });
        });

        it('should normalize { url } with https URL as url source', () => {
            const result = normalizeSource({ url: 'https://example.com/audio.mp3' });
            expect(result).toEqual({
                type: 'url',
                url: 'https://example.com/audio.mp3'
            });
        });

        it('should treat external url in { filePath: null, url } as url source', () => {
            const result = normalizeSource({
                filePath: null,
                url: 'https://example.com/audio.mp3'
            });
            expect(result).toEqual({
                type: 'url',
                url: 'https://example.com/audio.mp3'
            });
        });
    });

    describe('already-typed sources (passthrough)', () => {
        it('should pass through a valid file source', () => {
            const absolutePath = path.join(AUDIO_ROOT, 'custom/test.mp3');
            const source = {
                type: 'file',
                filePath: absolutePath,
                url: '/public/audio/custom/test.mp3'
            };
            const result = normalizeSource(source);
            expect(result).toEqual(source);
        });

        it('should pass through a valid url source', () => {
            const source = {
                type: 'url',
                url: 'https://example.com/audio.mp3'
            };
            const result = normalizeSource(source);
            expect(result).toEqual(source);
        });
    });

    describe('path traversal protection', () => {
        it('should reject path with ../ traversal', () => {
            expect(() => normalizeSource({ path: '../../../etc/passwd' }))
                .toThrow('Path traversal detected');
        });

        it('should reject path that resolves outside AUDIO_ROOT', () => {
            expect(() => normalizeSource({ path: 'custom/../../outside.mp3' }))
                .toThrow('Path traversal detected');
        });
    });

    describe('URL security', () => {
        it('should reject file:// protocol URLs', () => {
            expect(() => normalizeSource({ url: 'file:///etc/passwd' }))
                .toThrow('Only http and https URLs are allowed');
        });

        it('should reject data: URLs', () => {
            expect(() => normalizeSource({ url: 'data:audio/mp3;base64,abc' }))
                .toThrow('Only http and https URLs are allowed');
        });

        it('should reject ftp: URLs', () => {
            expect(() => normalizeSource({ url: 'ftp://server/file.mp3' }))
                .toThrow('Only http and https URLs are allowed');
        });
    });

    describe('edge cases', () => {
        it('should throw on null input', () => {
            expect(() => normalizeSource(null)).toThrow('Invalid source');
        });

        it('should throw on undefined input', () => {
            expect(() => normalizeSource(undefined)).toThrow('Invalid source');
        });

        it('should throw on empty object', () => {
            expect(() => normalizeSource({})).toThrow('Invalid source');
        });

        it('should throw on object with no usable fields', () => {
            expect(() => normalizeSource({ foo: 'bar' })).toThrow('Invalid source');
        });

        it('should distinguish relative url (local file) from absolute url (external)', () => {
            // A relative URL like /public/audio/... with a path = file source
            const result = normalizeSource({
                path: 'custom/test.mp3',
                url: '/public/audio/custom/test.mp3'
            });
            expect(result.type).toBe('file');
        });

        it('should treat source with only relative url and no path as file source', () => {
            // Only a relative URL, no path — derive path from URL
            const result = normalizeSource({ url: '/public/audio/custom/test.mp3' });
            expect(result).toEqual({
                type: 'file',
                filePath: path.join(AUDIO_ROOT, 'custom/test.mp3'),
                url: '/public/audio/custom/test.mp3'
            });
        });
    });
});
