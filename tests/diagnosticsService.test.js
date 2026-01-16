const fs = require('fs');
const path = require('path');
const diagnosticsService = require('../src/services/diagnosticsService');
const audioAssetService = require('../src/services/audioAssetService');

jest.mock('fs');
jest.mock('path');
jest.mock('../src/services/audioAssetService');

describe('diagnosticsService', () => {
    describe('getTTSStatus', () => {
        let mockConfig;
        const mockCacheDir = '/mock/cache/dir';

        beforeEach(() => {
            jest.clearAllMocks();
            jest.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
            path.join.mockImplementation((...args) => args.join('/'));
            path.basename.mockImplementation((p) => p.split('/').pop());
            
            mockConfig = {
                automation: {
                    triggers: {
                        fajr: {
                            adhan: {
                                enabled: true,
                                type: 'tts',
                                template: 'Time for Fajr',
                                offsetMinutes: 0
                            }
                        }
                    }
                }
            };

            audioAssetService.resolveTemplate.mockImplementation((template) => template);
        });

        it('should return GENERATED when file exists and text matches', async () => {
            fs.existsSync.mockReturnValue(true);
            const mockMeta = JSON.stringify({
                text: 'Time for Fajr',
                generatedAt: '2023-01-01T00:00:00.000Z'
            });
            fs.readFileSync.mockReturnValue(mockMeta);

            const status = await diagnosticsService.getTTSStatus(mockConfig);

            expect(status.fajr.adhan.status).toBe('GENERATED');
            expect(status.fajr.adhan.detail).toBe('2023-01-01T00:00:00.000Z');
        });

        it('should return MISMATCH when text does not match', async () => {
            fs.existsSync.mockReturnValue(true);
            const mockMeta = JSON.stringify({
                text: 'Old Template Text',
                generatedAt: '2023-01-01T00:00:00.000Z'
            });
            fs.readFileSync.mockReturnValue(mockMeta);

            const status = await diagnosticsService.getTTSStatus(mockConfig);

            expect(status.fajr.adhan.status).toBe('MISMATCH');
            expect(status.fajr.adhan.detail).toBe('Template changed');
        });

        it('should return MISSING when file does not exist', async () => {
            fs.existsSync.mockReturnValue(false);

            const status = await diagnosticsService.getTTSStatus(mockConfig);

            expect(status.fajr.adhan.status).toBe('MISSING');
        });
    });
});
