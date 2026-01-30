const fs = require('fs');
const path = require('path');
const service = require('@services/core/prayerTimeService');
const { ProviderFactory, ProviderConnectionError, ProviderValidationError } = require('@providers');
const { DateTime } = require('luxon');

jest.mock('fs');
jest.mock('@providers', () => {
    const original = jest.requireActual('@providers');
    return {
        ...original,
        ProviderFactory: {
            create: jest.fn()
        }
    };
});

describe('PrayerTimeService', () => {
    const mockConfig = {
        location: { timezone: 'UTC', coordinates: { lat: 0, long: 0 } },
        sources: { primary: { type: 'aladhan', method: 15 }, backup: { type: 'mymasjid' } },
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
        ProviderFactory.create.mockReset();
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
                    fajr: '2023-01-01T05:00:00Z',
                    dhuhr: '2023-01-01T12:00:00Z',
                    asr: '2023-01-01T15:00:00Z',
                    maghrib: '2023-01-01T17:00:00Z',
                    isha: '2023-01-01T19:00:00Z'
                }
            }
        }));

        const result = await service.getPrayerTimes(mockConfig, today);
        
        expect(result.meta.cached).toBe(true);
        expect(ProviderFactory.create).not.toHaveBeenCalled();
    });

    it('should fetch from primary source on cache miss', async () => {
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
        fs.readFileSync.mockReturnValue(JSON.stringify({ data: {}, meta: {} }));
        
        const fetchedData = {
            '2023-01-01': {
                fajr: '2023-01-01T05:00:00Z',
                dhuhr: '2023-01-01T12:00:00Z',
                asr: '2023-01-01T15:00:00Z',
                maghrib: '2023-01-01T17:00:00Z',
                isha: '2023-01-01T19:00:00Z'
            }
        };
        const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue(fetchedData) };
        ProviderFactory.create.mockReturnValue(mockProvider);

        const result = await service.getPrayerTimes(mockConfig, today);
        
        expect(result.meta.cached).toBeFalsy();
        expect(ProviderFactory.create).toHaveBeenCalled();
        expect(mockProvider.getAnnualTimes).toHaveBeenCalledWith(2023);
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should fallback to backup source if primary connection fails', async () => {
         const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
         fs.readFileSync.mockReturnValue(JSON.stringify({ data: {}, meta: {} }));
         
         const primaryProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new ProviderConnectionError('API Down')) };
         const backupProvider = { getAnnualTimes: jest.fn().mockResolvedValue({
             '2023-01-01': { fajr: '2023-01-01T05:00:00Z' }
         }) };
         
         ProviderFactory.create
             .mockReturnValueOnce(primaryProvider)
             .mockReturnValueOnce(backupProvider);

         const result = await service.getPrayerTimes(mockConfig, today);
         
         expect(primaryProvider.getAnnualTimes).toHaveBeenCalled();
         expect(backupProvider.getAnnualTimes).toHaveBeenCalled();
         expect(result.meta.source).toBe('mymasjid');
    });

    it('should NOT fallback to backup source if it is disabled', async () => {
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
        fs.readFileSync.mockReturnValue(JSON.stringify({ data: {}, meta: {} }));
        
        const primaryProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new ProviderConnectionError('API Down')) };
        const backupProvider = { getAnnualTimes: jest.fn() };
        
        ProviderFactory.create
            .mockReturnValueOnce(primaryProvider)
            .mockReturnValueOnce(backupProvider);

        const disabledBackupConfig = {
            ...mockConfig,
            sources: {
                ...mockConfig.sources,
                backup: { ...mockConfig.sources.backup, enabled: false }
            }
        };

        const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

        await expect(service.getPrayerTimes(disabledBackupConfig, today)).rejects.toThrow('API Down');
        
        expect(primaryProvider.getAnnualTimes).toHaveBeenCalled();
        expect(backupProvider.getAnnualTimes).not.toHaveBeenCalled();
        expect(spy).toHaveBeenCalledWith(expect.stringContaining('Backup source configured but disabled. Skipping.'));
        
        spy.mockRestore();
   });

    it('should NOT fallback to backup source if primary has validation error', async () => {
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
        fs.readFileSync.mockReturnValue(JSON.stringify({ data: {}, meta: {} }));
        
        const primaryProvider = { getAnnualTimes: jest.fn().mockRejectedValue(new ProviderValidationError('Bad Config')) };
        const backupProvider = { getAnnualTimes: jest.fn() };
        
        ProviderFactory.create
            .mockReturnValueOnce(primaryProvider)
            .mockReturnValueOnce(backupProvider);

        await expect(service.getPrayerTimes(mockConfig, today)).rejects.toThrow('Bad Config');
        
        expect(primaryProvider.getAnnualTimes).toHaveBeenCalled();
        expect(backupProvider.getAnnualTimes).not.toHaveBeenCalled();
   });

   it('should force refresh by deleting cache and fetching', async () => {
        fs.existsSync.mockReturnValue(true);
        const today = DateTime.now().toISODate();
        
        const fetchResult = { [today]: { fajr: '2023-01-01T05:00:00Z' } };
        const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue(fetchResult) };
        ProviderFactory.create.mockReturnValue(mockProvider);

        await service.forceRefresh(mockConfig);
        
        expect(fs.unlinkSync).toHaveBeenCalled();
        expect(ProviderFactory.create).toHaveBeenCalled();
   });

   describe('getPrayersWithNext', () => {
        it('should calculate current day prayers and next prayer', async () => {
            const mockDate = DateTime.fromISO('2023-01-01T10:00:00Z');
            jest.spyOn(DateTime, 'now').mockReturnValue(mockDate);

            const mockPrayerData = {
                meta: { date: '2023-01-01', source: 'aladhan', cached: true },
                prayers: {
                    fajr: '2023-01-01T05:00:00Z',
                    sunrise: '2023-01-01T06:30:00Z',
                    dhuhr: '2023-01-01T12:00:00Z',
                    asr: '2023-01-01T15:00:00Z',
                    maghrib: '2023-01-01T17:00:00Z',
                    isha: '2023-01-01T19:00:00Z'
                }
            };

            const getPrayerTimesSpy = jest.spyOn(service, 'getPrayerTimes').mockResolvedValue(mockPrayerData);

            const result = await service.getPrayersWithNext(mockConfig, 'UTC');

            expect(result.nextPrayer.name).toBe('dhuhr');
            expect(result.prayers.fajr.iqamah).toBeDefined();
            
            getPrayerTimesSpy.mockRestore();
            DateTime.now.mockRestore();
        });
   });
});
