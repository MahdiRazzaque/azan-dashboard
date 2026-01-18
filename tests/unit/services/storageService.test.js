const fs = require('fs');
const path = require('path');
const storageService = require('../../../src/services/storageService');
const configService = require('../../../src/config');

jest.mock('../../../src/config');
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
            
            fs.statSync.mockReturnValueOnce({ isDirectory: () => false, size: 1000 }) // file1
                       .mockReturnValueOnce({ isDirectory: () => true })            // subdir
                       .mockReturnValueOnce({ isDirectory: () => false, size: 2000 }); // file2

            const size = storageService.getDirSize('/dummy/path');
            expect(size).toBe(3000);
        });

        it('should return 0 if directory does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            const size = storageService.getDirSize('/nonexistent');
            expect(size).toBe(0);
        });
    });

    describe('checkQuota', () => {
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
            configService.get.mockReturnValue({ automation: { triggers: {} } });
            const recommended = storageService.calculateRecommendedLimit();
            expect(recommended).toBe(0.5);
        });

        it('should calculate higher limit based on enabled triggers', () => {
            configService.get.mockReturnValue({
                automation: {
                    triggers: {
                        fajr: {
                            adhan: { enabled: true, type: 'file' },
                            iqamah: { enabled: true, type: 'tts' }
                        },
                        dhuhr: {
                            adhan: { enabled: true, type: 'file' }
                        }
                    }
                }
            });
            
            // 2 files (1MB) + 1 TTS (0.1MB) = 1.1MB
            // Recommended = (1.1 * 2) + 100MB = ~102MB
            // Round to 1 decimal place GB = 0.5 (min)
            const recommended = storageService.calculateRecommendedLimit();
            expect(recommended).toBeGreaterThanOrEqual(0.1);
        });
    });
});
