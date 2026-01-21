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

        it('should handle error states in getStatus', async () => {
            const errorConfig = {
                location: { timezone: 'UTC' },
                prayers: { 
                },
                automation: {
                    triggers: {
                        fajr: { 
                            iqamah: { enabled: true }
                        }
                    }
                }
            };
            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { fajr: '2024-01-01T05:00:00Z' }
            });
            const result = await diagnosticsService.getAutomationStatus(errorConfig);
            expect(result.fajr.iqamah.status).toBe('ERROR');
            expect(result.fajr.iqamah.error).toBe('Time calculation failed');
        });

        it('should handle edge cases for sources in getStatus', async () => {
            const edgeConfig = {
                location: { timezone: 'UTC' },
                prayers: {
                    fajr: {},
                    dhuhr: {}
                },
                automation: {
                    triggers: {
                        fajr: {
                            adhan: { enabled: true, type: 'file' },
                            preAdhan: { enabled: true, type: 'url' },
                            preIqamah: { enabled: true, type: 'tts' }
                        },
                        dhuhr: {
                            adhan: { enabled: true, type: 'file', path: 'adhan.mp3' },
                            preAdhan: { enabled: true, type: 'url', url: 'http://test.com' },
                            preIqamah: { enabled: true, type: 'tts', template: 'A'.repeat(40) }
                        }
                    }
                }
            };
            
            const now = DateTime.now().setZone('UTC');
            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { 
                    fajr: now.plus({ hours: 1 }).toISO(),
                    dhuhr: now.plus({ hours: 4 }).toISO()
                },
                iqamah: { 
                    fajr: (now.plus({ hours: 1, minutes: 10 })).toISO(),
                    dhuhr: (now.plus({ hours: 4, minutes: 10 })).toISO()
                }
            });

            const result = await diagnosticsService.getAutomationStatus(edgeConfig);
            expect(result.fajr.adhan.details.source).toBe('No File');
            expect(result.fajr.preAdhan.details.source).toBe('No URL');
            expect(result.fajr.preIqamah.details.source).toBe('No Template');
            
            expect(result.dhuhr.adhan.details.source).toBe('adhan.mp3');
            expect(result.dhuhr.preAdhan.details.source).toBe('http://test.com');
            expect(result.dhuhr.preIqamah.details.source).toBe('"' + 'A'.repeat(30) + '..."');
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

         it('should handle missing path for CUSTOM_FILE', async () => {
             const noPathConfig = {
                 automation: {
                     triggers: {
                         fajr: { adhan: { enabled: true, type: 'file' } }
                     }
                 }
             };
             const result = await diagnosticsService.getTTSStatus(noPathConfig);
             expect(result.fajr.adhan.detail).toBe('Unknown');
         });

         it('should report MISSING if only one of tts or meta exists', async () => {
             // Fajr PreAdhan is TTS in mockConfig
             fs.existsSync.mockImplementation((p) => p.endsWith('.mp3')); // Only mp3 exists
             const result = await diagnosticsService.getTTSStatus(mockConfig);
             expect(result.fajr.preAdhan.status).toBe('MISSING');
         });

         it('should handle long templates and non-existent triggers', async () => {
             const longTemplate = 'a'.repeat(40);
             const longConfig = {
                 automation: {
                     triggers: {
                         fajr: { preAdhan: { enabled: true, type: 'tts', template: longTemplate } }
                     }
                 }
             };
             // This also tests the truncation logic in getStatus indirectly if we were to check it there, 
             // but here we check getTTSStatus logic.
             // Wait, the truncation is in getStatus (Automation Status), not getTTSStatus.
             // I already added edge cases for source source in getStatus tests above.
             
             fs.existsSync.mockReturnValue(false);
             const result = await diagnosticsService.getTTSStatus(longConfig);
             expect(result.fajr.preAdhan.status).toBe('MISSING');
         });
    });
});
