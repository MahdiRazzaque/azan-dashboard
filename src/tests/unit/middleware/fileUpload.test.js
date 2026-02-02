const fs = require('fs');
const path = require('path');

jest.mock('fs');

// We need to require it AFTER mocking fs
const upload = require('@middleware/fileUpload');

describe('FileUpload Util', () => {
    describe('DiskStorage', () => {
        it('should have the correct destination path', () => {
            const req = {};
            const file = {};
            const cb = jest.fn();
            
            // Accessing internal storage configuration
            upload.storage.getDestination(req, file, cb);
            
            expect(cb).toHaveBeenCalledWith(null, expect.stringContaining(path.join('public', 'audio', 'custom')));
        });

        it('should set filename as originalname', () => {
            const req = {};
            const file = { originalname: 'test.mp3' };
            const cb = jest.fn();
            
            upload.storage.getFilename(req, file, cb);
            
            expect(cb).toHaveBeenCalledWith(null, 'test.mp3');
        });
    });

    describe('fileFilter', () => {
        it('should allow mp3 mimetype', () => {
            const req = {};
            const file = { mimetype: 'audio/mpeg', originalname: 'test.mp3' };
            const cb = jest.fn();
            
            upload.fileFilter(req, file, cb);
            
            expect(cb).toHaveBeenCalledWith(null, true);
        });

        it('should allow .mp3 extension even if mimetype is different', () => {
            const req = {};
            const file = { mimetype: 'application/octet-stream', originalname: 'test.mp3' };
            const cb = jest.fn();
            
            upload.fileFilter(req, file, cb);
            
            expect(cb).toHaveBeenCalledWith(null, true);
        });

        it('should reject non-mp3 files', () => {
            const req = {};
            const file = { mimetype: 'image/png', originalname: 'test.png' };
            const cb = jest.fn();
            
            upload.fileFilter(req, file, cb);
            
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
            expect(cb.mock.calls[0][0].message).toBe('Only mp3 files allowed');
        });
    });
});