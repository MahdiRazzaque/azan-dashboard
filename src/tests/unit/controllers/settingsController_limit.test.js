const settingsController = require('@controllers/settingsController');
const fsAsync = require('fs/promises');

jest.mock('fs/promises', () => ({
    access: jest.fn(),
    unlink: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    rename: jest.fn(),
    readdir: jest.fn(),
    copyFile: jest.fn()
}));

jest.mock('@utils/audioValidator', () => ({
    analyseAudioFile: jest.fn()
}));

describe('SettingsController File Limit', () => {
    let req, res;

    beforeEach(() => {
        req = { body: {}, file: { filename: 'test.mp3', path: '/tmp/test.mp3' } };
        res = {
            json: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
    });

    it('should reject upload if file limit reached (REQ-005)', async () => {
        // Mock 500 files already present
        const files = Array(500).fill('f.mp3');
        fsAsync.readdir.mockResolvedValue(files);
        fsAsync.mkdir.mockResolvedValue();
        fsAsync.unlink.mockResolvedValue();

        await settingsController.uploadFile(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Limit Reached'
        }));
        expect(fsAsync.unlink).toHaveBeenCalledWith('/tmp/test.mp3');
    });
});
