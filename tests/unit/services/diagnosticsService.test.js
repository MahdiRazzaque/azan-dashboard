const diagnosticsService = require('../../../src/services/diagnosticsService');
const prayerTimeService = require('../../../src/services/prayerTimeService');
const audioAssetService = require('../../../src/services/audioAssetService');
const fs = require('fs');
const { DateTime } = require('luxon');

jest.mock('../../../src/services/prayerTimeService');
jest.mock('../../../src/services/audioAssetService');
jest.mock('fs');

describe('Diagnostics Service', () => {
    const mockConfig = {
        location: { timezone: 'UTC' },
        prayers: {
            fajr: { iqamah: { type: 'offset', minutes: 10 } }
        },
        automation: {
            triggers: {
                fajr: {
                    adhan: { enabled: true, type: 'file', path: 'custom/adhan.mp3' },
                    preAdhan: { enabled: true, offsetMinutes: 5, type: 'tts', template: 'Time for {prayerEnglish}' },
                    iqamah: { enabled: false }
                }
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Suppress logs
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    describe('getAutomationStatus', () => {
        it('should return correct statuses for existing times', async () => {
            const now = DateTime.now().setZone('UTC');
            const fajrTime = now.plus({ hours: 1 }); // Upcoming
            
            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: {
                    fajr: fajrTime.toISO(),
                    dhuhr: now.plus({ hours: 5 }).toISO(),
                    iqamah: {}
                }
            });

            const result = await diagnosticsService.getAutomationStatus(mockConfig);
            
            expect(result.fajr.adhan.status).toBe('UPCOMING');
            expect(result.fajr.iqamah.status).toBe('DISABLED');
            expect(result.fajr.preAdhan.status).toBe('UPCOMING');
        });

        it('should handle passed events', async () => {
             const now = DateTime.now().setZone('UTC');
             const fajrTime = now.minus({ hours: 1 }); // Passed
             
             prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { fajr: fajrTime.toISO(), iqamah: {} }
            });
            
            const result = await diagnosticsService.getAutomationStatus(mockConfig);
            expect(result.fajr.adhan.status).toBe('PASSED');
        });
        
        it('should handle missing time data error', async () => {
             prayerTimeService.getPrayerTimes.mockResolvedValue({ prayers: {} });
             const result = await diagnosticsService.getAutomationStatus(mockConfig);
             expect(result.fajr.error).toBeDefined();
        });

        it('should handle getPrayerTimes failure', async () => {
            prayerTimeService.getPrayerTimes.mockRejectedValue(new Error('Network error'));
            const result = await diagnosticsService.getAutomationStatus(mockConfig);
            expect(result).toEqual({});
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Diagnostics] Failed to fetch'), expect.any(Error));
        });

        it('should use iqamah from source when not overridden', async () => {
            const now = DateTime.now().setZone('UTC');
            const fajrTime = now.plus({ hours: 1 });
            
            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: {
                    fajr: fajrTime.toISO(),
                    iqamah: {
                        fajr: fajrTime.plus({ minutes: 20 }).toISO()
                    }
                }
            });

            const configNoOverride = {
                ...mockConfig,
                prayers: { fajr: {} } // No override
            };

            const result = await diagnosticsService.getAutomationStatus(configNoOverride);
            expect(result.fajr.iqamah).toBeDefined();
        });
    });

    describe('getTTSStatus', () => {
        beforeEach(() => {
             audioAssetService.resolveTemplate.mockReturnValue('Expected Text');
        });

        it('should report GENERATED for existing TTS files', async () => {
             fs.existsSync.mockReturnValue(true);
             fs.readFileSync.mockReturnValue(JSON.stringify({ text: 'Expected Text', generatedAt: '2024' }));
             
             const result = await diagnosticsService.getTTSStatus(mockConfig);
             
             // Check Fajr PreAdhan (TTS)
             expect(result.fajr.preAdhan.status).toBe('GENERATED');
             expect(result.fajr.preAdhan.detail).toBe('2024');
         });

         it('should report MISSING for missing TTS files', async () => {
             fs.existsSync.mockReturnValue(false);
             
             const result = await diagnosticsService.getTTSStatus(mockConfig);
             
             expect(result.fajr.preAdhan.status).toBe('MISSING');
         });
         
         it('should report CUSTOM_FILE', async () => {
             const result = await diagnosticsService.getTTSStatus(mockConfig);
             expect(result.fajr.adhan.status).toBe('CUSTOM_FILE');
             expect(result.fajr.adhan.detail).toBe('adhan.mp3');
         });

         it('should report URL type', async () => {
             const urlConfig = {
                 ...mockConfig,
                 automation: {
                     triggers: {
                         fajr: {
                             adhan: { enabled: true, type: 'url', url: 'http://example.com/adhan.mp3' }
                         }
                     }
                 }
             };

             const result = await diagnosticsService.getTTSStatus(urlConfig);
             expect(result.fajr.adhan.status).toBe('URL');
             expect(result.fajr.adhan.detail).toBe('http://example.com/adhan.mp3');
         });

         it('should report MISMATCH when TTS text changed', async () => {
             fs.existsSync.mockReturnValue(true);
             fs.readFileSync.mockReturnValue(JSON.stringify({ text: 'Old Text', generatedAt: '2024' }));
             
             const result = await diagnosticsService.getTTSStatus(mockConfig);
             
             expect(result.fajr.preAdhan.status).toBe('MISMATCH');
             expect(result.fajr.preAdhan.detail).toBe('Template changed');
         });

         it('should report ERROR when meta is corrupt', async () => {
             fs.existsSync.mockReturnValue(true);
             fs.readFileSync.mockReturnValue('Invalid JSON');
             
             const result = await diagnosticsService.getTTSStatus(mockConfig);
             
             expect(result.fajr.preAdhan.status).toBe('ERROR');
             expect(result.fajr.preAdhan.detail).toBe('Corrupt Meta');
         });

         it('should report UNKNOWN for unrecognized audio types', async () => {
             const unknownConfig = {
                 ...mockConfig,
                 automation: {
                     triggers: {
                         fajr: {
                             adhan: { enabled: true, type: 'unknown-type' }
                         }
                     }
                 }
             };

             const result = await diagnosticsService.getTTSStatus(unknownConfig);
             expect(result.fajr.adhan.status).toBe('UNKNOWN');
         });
    });
});
