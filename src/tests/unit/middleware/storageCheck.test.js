const storageCheck = require('@middleware/storageCheck');
const storageService = require('@services/system/storageService');

jest.mock('@services/system/storageService');

describe('StorageCheck Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {
            headers: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            set: jest.fn()
        };
        next = jest.fn();
        jest.clearAllMocks();
    });

    it('should call next if Content-Length is missing or NaN', async () => {
        req.headers['content-length'] = 'not-a-number';
        await storageCheck(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(storageService.checkQuota).not.toHaveBeenCalled();
    });

    it('should call next if quota check is successful', async () => {
        req.headers['content-length'] = '1000';
        storageService.checkQuota.mockResolvedValue({ success: true });
        
        await storageCheck(req, res, next);
        
        expect(storageService.checkQuota).toHaveBeenCalledWith(1000);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 413 if quota is exceeded', async () => {
        req.headers['content-length'] = '2000';
        storageService.checkQuota.mockResolvedValue({ 
            success: false, 
            message: 'Quota exceeded' 
        });
        
        await storageCheck(req, res, next);
        
        expect(storageService.checkQuota).toHaveBeenCalledWith(2000);
        expect(res.set).toHaveBeenCalledWith('Connection', 'close');
        expect(res.status).toHaveBeenCalledWith(413);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Storage Limit Exceeded',
            message: 'Quota exceeded'
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('should return 413 with default message if quota check fails without message', async () => {
        req.headers['content-length'] = '2000';
        storageService.checkQuota.mockResolvedValue({ 
            success: false
        });
        
        await storageCheck(req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(413);
        expect(res.json).toHaveBeenCalledWith({
            error: 'Storage Limit Exceeded',
            message: 'The uploaded file would exceed the storage quota.'
        });
    });

    it('should call next if storageService.checkQuota throws an error', async () => {
        req.headers['content-length'] = '1000';
        storageService.checkQuota.mockRejectedValue(new Error('Internal error'));
        
        // Mocking console.error to avoid noise in test output
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        await storageCheck(req, res, next);
        
        expect(next).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
