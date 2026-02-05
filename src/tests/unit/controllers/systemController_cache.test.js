const systemController = require('@controllers/systemController');
const fs = require('fs');
const fsp = fs.promises;

jest.mock('fs', () => ({
    promises: {
        readdir: jest.fn(),
        readFile: jest.fn(),
        access: jest.fn(),
        mkdir: jest.fn()
    }
}));

describe('SystemController File Caching', () => {
    let req, res;

    beforeEach(() => {
        req = { query: {} };
        res = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
        systemController.invalidateFileCache();
    });

    it('should return cached data within TTL (REQ-004)', async () => {
        fsp.readdir.mockResolvedValue(['f1.mp3']);
        fsp.readFile.mockResolvedValue(JSON.stringify({}));
        fsp.mkdir.mockResolvedValue();

        // First call - fresh scan
        await systemController.getAudioFiles(req, res);
        expect(fsp.readdir).toHaveBeenCalledTimes(2); // custom and cache

        // Second call - should hit cache
        await systemController.getAudioFiles(req, res);
        expect(fsp.readdir).toHaveBeenCalledTimes(2); // Still 2, no new calls
    });

    it('should perform fresh scan after cache invalidation (REQ-004)', async () => {
        fsp.readdir.mockResolvedValue(['f1.mp3']);
        fsp.readFile.mockResolvedValue(JSON.stringify({}));
        fsp.mkdir.mockResolvedValue();

        // First call
        await systemController.getAudioFiles(req, res);
        expect(fsp.readdir).toHaveBeenCalledTimes(2);

        // Invalidate
        systemController.invalidateFileCache();

        // Second call
        await systemController.getAudioFiles(req, res);
        expect(fsp.readdir).toHaveBeenCalledTimes(4); // 2 more calls
    });
});
