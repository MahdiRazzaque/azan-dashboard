const fs = require('fs');
const path = require('path');

// Mock play-sound BEFORE requiring LocalOutput
jest.mock('play-sound', () => {
    const play = jest.fn((file, opts, cb) => cb(null));
    return () => ({ play });
});

const LocalOutput = require('@outputs/LocalOutput');
const { execFile } = require('child_process');
const ConfigService = require('@config');

jest.mock('child_process');
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        access: jest.fn()
    },
    existsSync: jest.fn(),
    readFileSync: jest.fn()
}));
jest.mock('@config');

// Helper to get the actual AUDIO_ROOT used by the service
const AUDIO_ROOT = path.resolve(__dirname, '../../../../public/audio');

describe('LocalOutput', () => {
    let output;
    let mockPlay;

    beforeEach(() => {
        jest.clearAllMocks();
        output = new LocalOutput();
        mockPlay = require('play-sound')().play;
        ConfigService.get.mockReturnValue({
            automation: {
                outputs: {
                    local: {
                        params: { audioPlayer: 'mpg123' }
                    }
                }
            }
        });
    });

    describe('Metadata', () => {
        it('should return correct metadata', () => {
            const meta = LocalOutput.getMetadata();
            expect(meta.id).toBe('local');
        });

        it('should have audioPlayer as a select type with options', () => {
            const meta = LocalOutput.getMetadata();
            const playerParam = meta.params.find(p => p.key === 'audioPlayer');
            expect(playerParam.type).toBe('select');
            expect(playerParam.options).toContain('mpg123');
        });
    });

    describe('execute', () => {
        it('should play audio file using configured player', async () => {
            const testFile = path.join(AUDIO_ROOT, 'custom/test.mp3');
            const payload = {
                source: { filePath: testFile },
                params: { audioPlayer: 'mpg123' }
            };

            await output.execute(payload, {});
            expect(mockPlay).toHaveBeenCalledWith(testFile, { player: 'mpg123' }, expect.any(Function));
        });

        it('should reject if audioPlayer is not in allowlist', async () => {
            const testFile = path.join(AUDIO_ROOT, 'custom/test.mp3');
            const payload = {
                source: { filePath: testFile },
                params: { audioPlayer: 'malicious_cmd; rm -rf /' }
            };

            await expect(output.execute(payload, {})).rejects.toThrow('Invalid audio player');
        });

        it('should default to mpg123 if player not specified', async () => {
            const testFile = path.join(AUDIO_ROOT, 'custom/test.mp3');
            const payload = {
                source: { filePath: testFile }
            };

            await output.execute(payload, {});
            expect(mockPlay).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ player: 'mpg123' }), expect.any(Function));
        });

        it('should do nothing if no filePath provided', async () => {
            await output.execute({ source: {} }, {});
            expect(mockPlay).not.toHaveBeenCalled();
        });

        it('should reject if playback fails', async () => {
            mockPlay.mockImplementationOnce((file, opts, cb) => cb(new Error('Play error')));

            const testFile = path.join(AUDIO_ROOT, 'custom/test.mp3');
            const payload = {
                source: { filePath: testFile }
            };

            await expect(output.execute(payload, {})).rejects.toThrow('Play error');
        });

        it('should block path traversal attempts', async () => {
            const payload = {
                source: { filePath: '/etc/passwd', path: '../../../../etc/passwd' }
            };

            await expect(output.execute(payload, {})).rejects.toThrow('Access denied');
        });
    });

    describe('healthCheck', () => {
        it('should return healthy if mpg123 is found', async () => {
            execFile.mockImplementation((file, args, cb) => cb(null));
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });
            
            fs.promises.access.mockResolvedValue(undefined); // /dev/snd exists

            const result = await output.healthCheck();
            expect(result.healthy).toBe(true);
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        it('should return unhealthy if player is missing', async () => {
            execFile.mockImplementation((file, args, cb) => cb(new Error('ENOENT')));
            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
        });

        it('should detect Docker without audio hardware', async () => {
            execFile.mockImplementation((file, args, cb) => cb(null));
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });
            
            fs.promises.access.mockRejectedValueOnce(new Error('ENOENT')) // /dev/snd missing
                             .mockResolvedValueOnce(undefined);        // /.dockerenv exists

            const result = await output.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toContain('Docker: No Audio HW');
            
            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });
    });

    describe('verifyCredentials', () => {
        it('should always return true', async () => {
            const result = await output.verifyCredentials({});
            expect(result.success).toBe(true);
        });
    });
});
