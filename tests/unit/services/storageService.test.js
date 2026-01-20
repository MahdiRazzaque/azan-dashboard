const fs = require('fs');
const path = require('path');
const storageService = require('@services/system/storageService');
const configService = require('@config');

jest.mock('@config');
jest.mock('fs');
jest.mock('check-disk-space', () => ({
    default: jest.fn().mockResolvedValue({ free: 50 * 1024 * 1024 * 1024 }) // 50GB
}));

describe('StorageService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getDirSize', () => {
        it('should recursively calculate directory size', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValueOnce(['file1.mp3', 'subdir'])
                         .mockReturnValueOnce(['file2.mp3']);
            
            fs.lstatSync.mockReturnValueOnce({ isDirectory: () => false, isSymbolicLink: () => false, size: 1000 }) // file1
                       .mockReturnValueOnce({ isDirectory: () => true, isSymbolicLink: () => false })            // subdir
                       .mockReturnValueOnce({ isDirectory: () => false, isSymbolicLink: () => false, size: 2000 }); // file2

            const size = storageService.getDirSize('/dummy/path');
            expect(size).toBe(3000);
        });

        it('should return 0 if directory does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            const size = storageService.getDirSize('/nonexistent');
            expect(size).toBe(0);
        });

        it('should skip symbolic links', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['link']);
            fs.lstatSync.mockReturnValue({ isSymbolicLink: () => true });
            expect(storageService.getDirSize('/fake')).toBe(0);
        });

        it('should handle lstat errors', () => {
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['bad']);
            fs.lstatSync.mockImplementation(() => { throw new Error('fail'); });
            expect(storageService.getDirSize('/fake')).toBe(0);
            expect(console.warn).toHaveBeenCalled();
        });

        it('should handle readdir errors', () => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockImplementation(() => { throw new Error('fail'); });
            expect(storageService.getDirSize('/fake')).toBe(0);
            expect(console.error).toHaveBeenCalled();
        });

        it('should prevent recursion', () => {
            fs.existsSync.mockReturnValue(true);
            fs.readdirSync.mockReturnValue(['subdir']);
            fs.lstatSync.mockReturnValue({ isDirectory: () => true, isSymbolicLink: () => false });
            // readdirSync will keep returning 'subdir' if not careful
            // But getDirSize increments visitedPaths
            expect(storageService.getDirSize('/fake')).toBe(0); 
        });
    });

    describe('getUsage', () => {
        it('should get breakdown', async () => {
             jest.spyOn(storageService, 'getDirSize').mockReturnValue(50);
             const usage = await storageService.getUsage();
             expect(usage.total).toBe(100);
        });
    });

    describe('getSystemStats', () => {
        it('should return free space', async () => {
            const checkDiskSpace = require('check-disk-space').default;
            checkDiskSpace.mockResolvedValue({ free: 1000 });
            const free = await storageService.getSystemStats();
            expect(free).toBe(1000);
        });

        it('should handle disk space error', async () => {
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            const checkDiskSpace = require('check-disk-space').default;
            checkDiskSpace.mockRejectedValue(new Error('fail'));
            const free = await storageService.getSystemStats();
            expect(free).toBeNull();
        });
    });

    describe('checkQuota', () => {
        it('should use default limit if config missing', async () => {
             configService.get.mockReturnValue({});
             jest.spyOn(storageService, 'getUsage').mockResolvedValue({ total: 0 });
             const res = await storageService.checkQuota(100);
             expect(res.success).toBe(true);
        });

        it('should pass if adding bytes is within limit', async () => {
            configService.get.mockReturnValue({
                data: { storageLimit: 1.0 } // 1GB
            });
            
            // Mock getUsage indirectly via getDirSize or spying
            jest.spyOn(storageService, 'getUsage').mockResolvedValue({
                total: 500 * 1024 * 1024, // 500MB used
                custom: 250,
                cache: 250
            });

            const result = await storageService.checkQuota(100 * 1024 * 1024); // Adding 100MB
            expect(result.success).toBe(true);
        });

        it('should fail if adding bytes exceeds limit', async () => {
            configService.get.mockReturnValue({
                data: { storageLimit: 1.0 }
            });
            
            jest.spyOn(storageService, 'getUsage').mockResolvedValue({
                total: 950 * 1024 * 1024, // 950MB used
                custom: 475,
                cache: 475
            });

            const result = await storageService.checkQuota(100 * 1024 * 1024); // Adding 100MB
            expect(result.success).toBe(false);
            expect(result.message).toBe('Storage Limit Exceeded');
        });
    });

    describe('calculateRecommendedLimit', () => {
        it('should return minimum for no triggers', () => {
            configService.get.mockReturnValue({ automation: { triggers: null } });
            const recommended = storageService.calculateRecommendedLimit();
            expect(recommended).toBe(0.5);
        });

        it('should handle various trigger types', () => {
            configService.get.mockReturnValue({
                automation: {
                    triggers: {
                        fajr: {
                            adhan: { enabled: true, type: 'file' },
                            iqamah: { enabled: true, type: 'tts' },
                            preAdhan: { enabled: false, type: 'file' },
                            other: { enabled: true, type: 'url' } 
                        }
                    }
                }
            });
            const recommended = storageService.calculateRecommendedLimit();
            expect(recommended).toBeGreaterThanOrEqual(0.5);
        });
    });
});
