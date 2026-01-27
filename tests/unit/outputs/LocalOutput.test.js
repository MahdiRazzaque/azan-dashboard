const mockPlay = jest.fn();
jest.mock('play-sound', () => {
    return jest.fn().mockImplementation(() => ({
        play: mockPlay
    }));
});

const LocalOutput = require('../../../src/outputs/LocalOutput');
const { exec } = require('child_process');
const fs = require('fs');
const ConfigService = require('../../../src/config');

jest.mock('../../../src/config', () => ({
    get: jest.fn(() => ({
        automation: {
            outputs: {
                local: { params: { audioPlayer: 'mpg123' } }
            }
        }
    }))
}));
jest.mock('child_process');
jest.mock('fs');

describe('LocalOutput', () => {
    let output;

    beforeEach(() => {
        output = new LocalOutput();
        mockPlay.mockReset();
        mockPlay.mockImplementation((file, opts, cb) => cb && cb(null));
        
        // Default fs mock
        fs.existsSync.mockReturnValue(true);
    });

    describe('Metadata', () => {
        it('should return correct metadata', () => {
            const meta = LocalOutput.getMetadata();
            expect(meta.id).toBe('local');
            expect(meta.params).toEqual(expect.arrayContaining([
                expect.objectContaining({ key: 'audioPlayer' })
            ]));
        });
    });

    describe('execute', () => {
        it('should play audio file using configured player', async () => {
            const payload = {
                source: { filePath: '/path/to/audio.mp3' },
                params: { audioPlayer: 'mplayer' }
            };
            
            await output.execute(payload);
            
            expect(mockPlay).toHaveBeenCalledWith(
                '/path/to/audio.mp3',
                { player: 'mplayer' },
                expect.any(Function)
            );
        });

        it('should default to mpg123 if player not specified', async () => {
            const payload = {
                source: { filePath: '/file.mp3' },
                params: {}
            };
            await output.execute(payload);
            expect(mockPlay).toHaveBeenCalledWith(
                '/file.mp3',
                { player: 'mpg123' },
                expect.any(Function)
            );
        });

        it('should do nothing if no filePath provided', async () => {
             const payload = { source: {} };
             await output.execute(payload);
             expect(mockPlay).not.toHaveBeenCalled();
        });
        
         it('should reject if playback fails', async () => {
            mockPlay.mockImplementation((file, opts, cb) => cb(new Error('Play error')));
            const payload = { source: { filePath: 'f.mp3' }, params: {} };
            await expect(output.execute(payload)).rejects.toThrow('Play error');
        });
    });

    describe('healthCheck', () => {
        it('should return healthy if mpg123 is found', async () => {
            exec.mockImplementation((cmd, cb) => cb(null)); // Success
            const result = await output.healthCheck();
            expect(result).toEqual({ healthy: true, message: 'Ready' });
        });

        it('should return unhealthy if mpg123 is missing', async () => {
            exec.mockImplementation((cmd, cb) => cb(new Error('Not found')));
            const result = await output.healthCheck();
            expect(result).toEqual({ healthy: false, message: 'mpg123 Not Found' });
        });
    });

    describe('verifyCredentials', () => {
        it('should always return true', async () => {
            const result = await output.verifyCredentials({});
            expect(result).toEqual({ success: true });
        });
    });
});
