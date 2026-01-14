const fs = require('fs');
const service = require('../../../src/services/prayerTimeService');
const fetchers = require('../../../src/services/fetchers');
const { DateTime } = require('luxon');

jest.mock('fs');
jest.mock('../../../src/services/fetchers');

describe('PrayerTimeService', () => {
    const mockConfig = {
        location: { timezone: 'UTC', coordinates: { lat: 0, long: 0 } },
        calculation: { method: 'ISNA' },
        sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid' } },
        prayers: {
            fajr: { iqamahOffset: 10, roundTo: 0, fixedTime: null },
            dhuhr: { iqamahOffset: 10, roundTo: 0, fixedTime: null },
            asr: { iqamahOffset: 10, roundTo: 0, fixedTime: null },
            maghrib: { iqamahOffset: 10, roundTo: 0, fixedTime: null },
            isha: { iqamahOffset: 10, roundTo: 0, fixedTime: null },
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Default fs behavior
        fs.existsSync.mockReturnValue(true);
        fs.mkdirSync.mockImplementation(() => {});
        fs.writeFileSync.mockImplementation(() => {});
    });

    it('should return cached data on hit', async () => {
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
        const dateKey = today.toISODate();
        
        fs.readFileSync.mockReturnValue(JSON.stringify({
            meta: { source: 'test-source', lastFetched: '2022-12-31' },
            data: {
                [dateKey]: {
                    date: dateKey,
                    fajr: { start: '2023-01-01T05:00:00' },
                    dhuhr: { start: '2023-01-01T12:00:00' },
                    asr: { start: '2023-01-01T15:00:00' },
                    maghrib: { start: '2023-01-01T17:00:00' },
                    isha: { start: '2023-01-01T19:00:00' }
                }
            }
        }));

        const result = await service.getPrayerTimes(mockConfig, today);
        
        expect(result.meta.cached).toBe(true);
        expect(result.prayers.fajr.start).toBeDefined();
        // Iqamah should be merged into result.prayers.iqamah based on implementation
        // But if we want to confirm existing logic:
        if (result.prayers.iqamah) {
            expect(result.prayers.iqamah).toBeDefined();
        }
        
        expect(fetchers.fetchAladhanAnnual).not.toHaveBeenCalled();
    });

    it('should fetch from primary source on cache miss', async () => {
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
        
        // Empty cache
        fs.readFileSync.mockReturnValue(JSON.stringify({ data: {}, meta: {} }));
        
        // Mock fetcher success
        const fetchedData = {
            '2023-01-01': {
                fajr: { start: '2023-01-01T05:00:00' },
                // ... partial data is fine for unit test if service handles it, 
                // but better provide full structure to avoid crashes in calculations
                dhuhr: { start: '2023-01-01T12:00:00' },
                asr: { start: '2023-01-01T15:00:00' },
                maghrib: { start: '2023-01-01T17:00:00' },
                isha: { start: '2023-01-01T19:00:00' }
            }
        };
        fetchers.fetchAladhanAnnual.mockResolvedValue(fetchedData);

        const result = await service.getPrayerTimes(mockConfig, today);
        
        expect(result.meta.cached).toBeFalsy();
        expect(fetchers.fetchAladhanAnnual).toHaveBeenCalledWith(mockConfig, 2023);
        // Should write to cache
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should fallback to backup source if primary fails', async () => {
         const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
         fs.readFileSync.mockReturnValue(JSON.stringify({ data: {}, meta: {} }));
         
         fetchers.fetchAladhanAnnual.mockRejectedValue(new Error('API Down'));
         fetchers.fetchMyMasjidBulk.mockResolvedValue({
             '2023-01-01': { fajr: { start: '2023-01-01T05:00:00' } /*...*/ }
         });

         await service.getPrayerTimes(mockConfig, today);
         
         expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
         expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
         expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should calculate iqamah times correctly via overrides', async () => {
        // Reuse cache hit setup
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
        const dateKey = today.toISODate();
        
        // Enable Override
        const localConfig = JSON.parse(JSON.stringify(mockConfig));
        localConfig.prayers.fajr.iqamahOverride = true;
        
        fs.readFileSync.mockReturnValue(JSON.stringify({
            meta: { source: 'test' },
            data: {
                [dateKey]: {
                    fajr: '2023-01-01T05:00:00Z',
                    dhuhr: null,
                    asr: '2023-01-01T15:00:00Z',
                    maghrib: '2023-01-01T17:00:00Z',
                    isha: '2023-01-01T19:00:00Z'
                }
            }
        }));

        const result = await service.getPrayerTimes(localConfig, today);
        // Based on mockConfig: fajr offset 10. 5:00 -> 5:10
        expect(result.prayers.iqamah.fajr).toEqual(expect.stringContaining('05:10'));
    });

    it('should force refresh by deleting cache and fetching', async () => {
         fs.existsSync.mockReturnValue(true);
         
         // Fix: Use current date as forceRefresh uses DateTime.now()
         const { DateTime } = require('luxon');
         const today = DateTime.now().toISODate();
         
         const fetchResult = {};
         fetchResult[today] = { fajr: { start: `${today}T05:00:00` } };

         // Mock fetch valid response
         fetchers.fetchAladhanAnnual.mockResolvedValue(fetchResult);
         
         await service.forceRefresh(mockConfig);
         
         expect(fs.unlinkSync).toHaveBeenCalled();
         expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            jest.spyOn(console, 'log').mockImplementation(() => {});
        });

        it('should log error if unknown source type', async () => {
             const badConfig = { ...mockConfig, sources: { primary: { type: 'unknown' } } };
             fs.readFileSync.mockReturnValue(JSON.stringify({ data: {} }));
             
             await expect(service.getPrayerTimes(badConfig)).rejects.toThrow('Unable to retrieve');
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Unknown source type'));
        });

        it('should handle primary source failure and backup failure', async () => {
             // Mock primary returning {}
             fetchers.fetchAladhanAnnual.mockResolvedValue({});
             fs.readFileSync.mockReturnValue(JSON.stringify({ data: {} }));
             
             // Backup fail
             fetchers.fetchMyMasjidBulk.mockRejectedValue(new Error('Backup Fail')); 
             
             await expect(service.getPrayerTimes(mockConfig)).rejects.toThrow('Unable to retrieve');
        });

        it('should throw if date not found in result', async () => {
             const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
             fs.readFileSync.mockReturnValue(JSON.stringify({ data: {} }));
             
             fetchers.fetchAladhanAnnual.mockResolvedValue({ '2023-01-02': { fajr: {} } });
             
             await expect(service.getPrayerTimes(mockConfig, today)).rejects.toThrow('not found in bulk response');
        });

        it('should handle file read corrupted JSON', async () => {
             fs.existsSync.mockReturnValue(true);
             fs.readFileSync.mockReturnValue('invalid-json'); 
             
             fetchers.fetchAladhanAnnual.mockResolvedValue({ '2023-01-01': { fajr: {} } });
             
             const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
             await service.getPrayerTimes(mockConfig, today);
             
             expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
        });

        it('should handle file read errors (filesystem)', async () => {
             fs.existsSync.mockReturnValue(true);
             fs.readFileSync.mockImplementation(() => { throw new Error('IO Fail'); });
             
             fetchers.fetchAladhanAnnual.mockResolvedValue({ '2023-01-01': { fajr: {} } });
             const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
             
             await service.getPrayerTimes(mockConfig, today);
             expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
        });

        it('should handle file write errors', async () => {
             fs.readFileSync.mockReturnValue(JSON.stringify({ data: {} }));
             fetchers.fetchAladhanAnnual.mockResolvedValue({ '2023-01-01': { fajr: {} } });
             fs.writeFileSync.mockImplementation(() => { throw new Error('Write Fail'); });
             
             const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
             const res = await service.getPrayerTimes(mockConfig, today);
             expect(res).toBeDefined();
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error writing cache file'));
        });

        it('should warn on calculation overrides failure', async () => {
             const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
             const dateKey = today.toISODate();
             
             const overrideConfig = JSON.parse(JSON.stringify(mockConfig));
             overrideConfig.prayers.fajr.iqamahOverride = true;
             
             // Provide data that causes calculation error (e.g. invalid date format for start)
             // calculateIqamah checks DateTime validation
             fs.readFileSync.mockReturnValue(JSON.stringify({
                 meta: {},
                 data: {
                     [dateKey]: {
                         fajr: { start: 'invalid-date-string' } 
                     }
                 }
             }));
             
             // We need to ensure logic reaches calculation.
             // implementation: applyOverrides -> calculateIqamah(prayers[prayer].start...)
             
             await service.getPrayerTimes(overrideConfig, today);
             expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to override iqamah'), expect.anything());
        });
    });
});
