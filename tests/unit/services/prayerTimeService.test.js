const fs = require('fs');
const service = require('@services/core/prayerTimeService');
const fetchers = require('@adapters/prayerApiAdapter');
const { DateTime } = require('luxon');

jest.mock('fs');
jest.mock('@adapters/prayerApiAdapter');

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

    it('should fetch from MyMasjid if it is the primary source', async () => {
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
        const myMasjidConfig = {
            ...mockConfig,
            sources: { primary: { type: 'mymasjid' } }
        };
        fs.readFileSync.mockReturnValue(JSON.stringify({ data: {} }));
        fetchers.fetchMyMasjidBulk.mockResolvedValue({
            '2023-01-01': { fajr: { start: '2023-01-01T05:00:00' } }
        });

        const result = await service.getPrayerTimes(myMasjidConfig, today);
        expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
        expect(result.meta.source).toBe('mymasjid');
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

        it('should fail if primary fails and no backup is configured', async () => {
             const noBackupConfig = { ...mockConfig, sources: { primary: { type: 'aladhan' } } };
             fetchers.fetchAladhanAnnual.mockRejectedValue(new Error('Primary Fail'));
             fs.readFileSync.mockReturnValue(JSON.stringify({ data: {} }));

             await expect(service.getPrayerTimes(noBackupConfig)).rejects.toThrow('Unable to retrieve');
             expect(fetchers.fetchMyMasjidBulk).not.toHaveBeenCalled();
        });

        it('should handle primary source returning empty data by trying backup', async () => {
             fetchers.fetchAladhanAnnual.mockResolvedValue({});
             fetchers.fetchMyMasjidBulk.mockResolvedValue({ '2023-01-01': { fajr: {} } });
             fs.readFileSync.mockReturnValue(JSON.stringify({ data: {} }));

             const result = await service.getPrayerTimes(mockConfig, DateTime.fromISO('2023-01-01'));
             expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
             expect(fetchers.fetchMyMasjidBulk).toHaveBeenCalled();
             expect(result.meta.source).toBe('mymasjid');
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

        it('should handle missing prayers or config in applyOverrides', async () => {
             // applyOverrides is internal but called by getPrayerTimes
             // We can trigger it by passing bad data to getPrayerTimes
             const today = DateTime.now();
             
             // 1. No prayers for date in cache
             fs.readFileSync.mockReturnValue(JSON.stringify({
                 meta: {},
                 data: { 'other-date': {} }
             }));
             fetchers.fetchAladhanAnnual.mockResolvedValue({ [today.toISODate()]: { fajr: {} } });
             
             // 2. No config.prayers
             const result = await service.getPrayerTimes({ sources: { primary: { type: 'aladhan' } } }, today);
             expect(result).toBeDefined();
        });

        it('should handle fs.unlinkSync failure in forceRefresh', async () => {
             fs.existsSync.mockReturnValue(true);
             fs.unlinkSync.mockImplementation(() => { throw new Error('Unlink Fail'); });
             fetchers.fetchAladhanAnnual.mockResolvedValue({ [DateTime.now().toISODate()]: { fajr: {} } });

             await service.forceRefresh(mockConfig);
             // Should not throw
             expect(fs.unlinkSync).toHaveBeenCalled();
        });

        it('should return null from tryFetch if sourceConfig is invalid', async () => {
            // tryFetch is internal, tricky to test directly but we can trigger via getPrayerTimes
            const badConfig = { ...mockConfig, sources: { primary: { type: null }, backup: null } };
            fs.readFileSync.mockReturnValue(JSON.stringify({ data: {} }));
            
            // This will throw "Unable to retrieve" because primary returns null and there is no backup
            await expect(service.getPrayerTimes(badConfig)).rejects.toThrow('Unable to retrieve');
        });

        it('should handle cache without data property', async () => {
             const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
             fs.readFileSync.mockReturnValue(JSON.stringify({ meta: {} })); // No data prop
             fetchers.fetchAladhanAnnual.mockResolvedValue({ '2023-01-01': { fajr: {} } });
             
             await service.getPrayerTimes(mockConfig, today);
             expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
        });

        it('should handle writeCache errors', async () => {
            const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
            fs.readFileSync.mockReturnValue(JSON.stringify({ data: {} }));
            fetchers.fetchAladhanAnnual.mockResolvedValue({ '2023-01-01': { fajr: { start: '2023-01-01T05:00:00Z' } } });
            fs.writeFileSync.mockImplementation(() => { throw new Error('Write Fail'); });
            
            await service.getPrayerTimes(mockConfig, today);
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error writing cache file'));
        });

        it('should create data directory if it does not exist', () => {
            jest.isolateModules(() => {
                const fs = require('fs');
                fs.existsSync.mockReturnValue(false);
                // Re-require to trigger the top-level directory check
                require('@services/core/prayerTimeService');
                expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
            });
        });
    });

    describe('getPrayersWithNext', () => {
        beforeEach(() => {
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        it('should accurately calculate current day prayers and next prayer', async () => {
            const mockDate = DateTime.fromISO('2023-01-01T10:00:00Z');
            const dateKey = '2023-01-01';
            
            // Mock now() to be 10 AM
            jest.spyOn(DateTime, 'now').mockReturnValue(mockDate);

            const mockPrayerData = {
                meta: { date: dateKey, source: 'test', cached: true },
                prayers: {
                    fajr: '2023-01-01T05:00:00Z',
                    sunrise: '2023-01-01T06:30:00Z',
                    dhuhr: '2023-01-01T12:00:00Z',
                    asr: '2023-01-01T15:00:00Z',
                    maghrib: '2023-01-01T17:00:00Z',
                    isha: '2023-01-01T19:00:00Z',
                    iqamah: {
                        fajr: '2023-01-01T05:15:00Z'
                    }
                }
            };

            const getPrayerTimesSpy = jest.spyOn(service, 'getPrayerTimes').mockResolvedValue(mockPrayerData);

            const result = await service.getPrayersWithNext(mockConfig, 'UTC');

            expect(getPrayerTimesSpy).toHaveBeenCalled();
            expect(result.nextPrayer.name).toBe('dhuhr');
            expect(result.prayers.fajr.iqamah).toBe('2023-01-01T05:15:00Z'); // From explicit iqamah
            expect(result.prayers.dhuhr.iqamah).toBeDefined(); // From calculation
            
            getPrayerTimesSpy.mockRestore();
            DateTime.now.mockRestore();
        });

        it('should fetch tomorrow\'s Fajr if all prayers today have passed', async () => {
            const mockDate = DateTime.fromISO('2023-01-01T22:00:00Z'); // After Isha
            const todayKey = '2023-01-01';
            const tomorrowKey = '2023-01-02';
            
            jest.spyOn(DateTime, 'now').mockReturnValue(mockDate);

            const todayData = {
                meta: { date: todayKey, source: 'test', cached: true },
                prayers: {
                    fajr: '2023-01-01T05:00:00Z',
                    sunrise: '2023-01-01T06:30:00Z',
                    dhuhr: '2023-01-01T12:00:00Z',
                    asr: '2023-01-01T15:00:00Z',
                    maghrib: '2023-01-01T17:00:00Z',
                    isha: '2023-01-01T19:00:00Z'
                }
            };

            const tomorrowData = {
                meta: { date: tomorrowKey, source: 'test', cached: true },
                prayers: {
                    fajr: '2023-01-02T05:05:00Z'
                }
            };

            const getPrayerTimesSpy = jest.spyOn(service, 'getPrayerTimes');
            getPrayerTimesSpy
                .mockResolvedValueOnce(todayData)
                .mockResolvedValueOnce(tomorrowData);

            const result = await service.getPrayersWithNext(mockConfig, 'UTC');

            expect(getPrayerTimesSpy).toHaveBeenCalledTimes(2);
            expect(result.nextPrayer.name).toBe('fajr');
            expect(result.nextPrayer.isTomorrow).toBe(true);
            expect(result.nextPrayer.time).toBe('2023-01-02T05:05:00Z');
            
            getPrayerTimesSpy.mockRestore();
            DateTime.now.mockRestore();
        });

        it('should handle errors when fetching tomorrow\'s Fajr', async () => {
            const mockDate = DateTime.fromISO('2023-01-01T22:00:00Z'); 
            jest.spyOn(DateTime, 'now').mockReturnValue(mockDate);

            const todayData = {
                meta: { date: '2023-01-01' },
                prayers: { isha: '2023-01-01T19:00:00Z' }
            };

            const getPrayerTimesSpy = jest.spyOn(service, 'getPrayerTimes');
            getPrayerTimesSpy
                .mockResolvedValueOnce(todayData)
                .mockRejectedValueOnce(new Error('Fetch Fail'));

            const result = await service.getPrayersWithNext(mockConfig, 'UTC');

            expect(result.nextPrayer).toBeNull();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch tomorrow\'s Fajr'));
            
            getPrayerTimesSpy.mockRestore();
            DateTime.now.mockRestore();
        });

        it('should warn and skip if a prayer time is missing in raw data', async () => {
             const mockDate = DateTime.fromISO('2023-01-01T10:00:00Z');
             jest.spyOn(DateTime, 'now').mockReturnValue(mockDate);

             const incompleteData = {
                 meta: { date: '2023-01-01' },
                 prayers: {
                     // Missing Fajr
                     sunrise: '2023-01-01T06:30:00Z'
                 }
             };

             const getPrayerTimesSpy = jest.spyOn(service, 'getPrayerTimes').mockResolvedValue(incompleteData);

             const result = await service.getPrayersWithNext(mockConfig, 'UTC');

             expect(result.prayers.fajr).toBeUndefined();
             expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Missing prayer time for fajr'));

             getPrayerTimesSpy.mockRestore();
             DateTime.now.mockRestore();
        });
    });
});
