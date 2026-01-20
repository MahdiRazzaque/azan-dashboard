const diagnosticsService = require('@services/system/diagnosticsService');
const prayerTimeService = require('@services/core/prayerTimeService');
const audioAssetService = require('@services/system/audioAssetService');
const fs = require('fs');
const { DateTime } = require('luxon');

jest.mock('@services/core/prayerTimeService');
jest.mock('@services/system/audioAssetService');
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

        it('should return empty object on prayerTimeService failure', async () => {
             prayerTimeService.getPrayerTimes.mockRejectedValue(new Error('API Fail'));
             const result = await diagnosticsService.getAutomationStatus(mockConfig);
             expect(result).toEqual({});
             expect(console.error).toHaveBeenCalled();
        });

        it('should handle iqamah from data vs calculated', async () => {
             const now = DateTime.now().setZone('UTC');
             const configWithIqamah = {
                 ...mockConfig,
                 automation: {
                     triggers: {
                         fajr: { adhan: { enabled: true }, iqamah: { enabled: true } }
                     }
                 }
             };

             prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { 
                    fajr: now.toISO(), 
                    iqamah: { fajr: now.plus({ minutes: 10 }).toISO() } 
                }
            });
            
            const res1 = await diagnosticsService.getAutomationStatus(configWithIqamah);
            expect(res1.fajr.iqamah.status).toBeDefined();

             prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { fajr: now.toISO(), iqamah: {} }
            });
            const res2 = await diagnosticsService.getAutomationStatus(configWithIqamah);
            expect(res2.fajr.iqamah.status).toBeDefined();
        });

        it('should handle all events enabled and upcoming', async () => {
             const now = DateTime.now().setZone('UTC');
             const complexConfig = {
                 location: { timezone: 'UTC' },
                 prayers: {
                     fajr: { iqamah: { type: 'offset', minutes: 10 } }
                 },
                 automation: {
                     triggers: {
                         fajr: { 
                             adhan: { enabled: true },
                             preAdhan: { enabled: true, offsetMinutes: 5 },
                             preIqamah: { enabled: true, offsetMinutes: 5 },
                             iqamah: { enabled: true }
                         }
                     }
                 }
             };
             prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { 
                    fajr: now.plus({ hours: 1 }).toISO(),
                    iqamah: { fajr: now.plus({ hours: 1, minutes: 10 }).toISO() }
                }
            });
            
            const result = await diagnosticsService.getAutomationStatus(complexConfig);
            expect(result.fajr.adhan.status).toBe('UPCOMING');
            expect(result.fajr.iqamah.status).toBe('UPCOMING');
            expect(result.fajr.preAdhan.status).toBe('UPCOMING');
            expect(result.fajr.preIqamah.status).toBe('UPCOMING');
        });

        it('should handle sunrise (subset of events)', async () => {
             const now = DateTime.now().setZone('UTC');
             prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { sunrise: now.plus({ hours: 1 }).toISO(), iqamah: {} }
            });
            const result = await diagnosticsService.getAutomationStatus(mockConfig);
            expect(result.sunrise).toBeDefined();
            expect(result.sunrise.iqamah).toBeUndefined();
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

         it('should report MISMATCH if text changed', async () => {
             fs.existsSync.mockReturnValue(true);
             fs.readFileSync.mockReturnValue(JSON.stringify({ text: 'Different Text' }));
             const result = await diagnosticsService.getTTSStatus(mockConfig);
             expect(result.fajr.preAdhan.status).toBe('MISMATCH');
         });

         it('should report ERROR if meta is corrupt', async () => {
             fs.existsSync.mockReturnValue(true);
             fs.readFileSync.mockImplementation(() => { throw new Error('BFS'); });
             const result = await diagnosticsService.getTTSStatus(mockConfig);
             expect(result.fajr.preAdhan.status).toBe('ERROR');
         });

         it('should handle URL and unknown types', async () => {
             const configWithUrl = {
                 location: { timezone: 'UTC' },
                 automation: {
                     triggers: {
                         fajr: { 
                             adhan: { enabled: true, type: 'url', url: 'http://test' },
                             preAdhan: { enabled: true, type: 'mystery' } 
                         }
                     }
                 }
             };
             const result = await diagnosticsService.getTTSStatus(configWithUrl);
             expect(result.fajr.adhan.status).toBe('URL');
             expect(result.fajr.preAdhan.status).toBe('UNKNOWN');
         });
    });
});
