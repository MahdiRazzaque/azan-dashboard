const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const service = require('@services/core/prayerTimeService');
const { ProviderFactory, ProviderConnectionError, ProviderValidationError } = require('@providers');
const { DateTime } = require('luxon');

jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        unlink: jest.fn(),
        mkdir: jest.fn(),
        access: jest.fn()
    }
}));

jest.mock('@providers', () => {
    const original = jest.requireActual('@providers');
    return {
        ...original,
        ProviderFactory: {
            create: jest.fn()
        }
    };
});

describe('PrayerTimeService (with In-Memory Cache)', () => {
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

    beforeEach(async () => {
        jest.clearAllMocks();
        ProviderFactory.create.mockReset();
        
        // We need a way to clear the in-memory cache without triggering a full fetch cycle that might fail.
        // forceRefresh clears it but then calls getPrayerTimes.
        // Let's mock a successful fetch for forceRefresh.
        const today = DateTime.now().toISODate();
        const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue({ [today]: { fajr: 'ISO' } }) };
        ProviderFactory.create.mockReturnValue(mockProvider);
        fsp.unlink.mockResolvedValue();
        fsp.access.mockRejectedValue(new Error('not found')); // force miss
        fsp.writeFile.mockResolvedValue();

        await service.forceRefresh(mockConfig);
        jest.clearAllMocks();
    });

    it('should return cached data from disk if memory cache is empty', async () => {
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
        const dateKey = today.toISODate();
        
        fsp.readFile.mockResolvedValue(JSON.stringify({
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
        fsp.access.mockResolvedValue(); // cache file exists

        const result = await service.getPrayerTimes(mockConfig, today);
        
        expect(result.meta.cached).toBe(true);
        expect(fsp.readFile).toHaveBeenCalled();
        expect(ProviderFactory.create).not.toHaveBeenCalled();
    });

    it('should return data from in-memory cache without reading disk on second call', async () => {
        const today = DateTime.fromObject({ year: 2023, month: 1, day: 1 });
        const dateKey = today.toISODate();

        fsp.readFile.mockResolvedValue(JSON.stringify({
            meta: { source: 'test-source', lastFetched: '2022-12-31' },
            data: {
                [dateKey]: { fajr: '2023-01-01T05:00:00Z' }
            }
        }));
        fsp.access.mockResolvedValue();

        // First call - should read disk
        await service.getPrayerTimes(mockConfig, today);
        expect(fsp.readFile).toHaveBeenCalledTimes(1);

        // Second call - should NOT read disk
        const result = await service.getPrayerTimes(mockConfig, today);
        expect(result.meta.cached).toBe(true);
        expect(fsp.readFile).toHaveBeenCalledTimes(1); 
    });

    it('should force refresh by deleting cache file and clearing memory cache', async () => {
        const today = DateTime.now();
        const dateKey = today.toISODate();
        
        const fetchedData = {
            [dateKey]: { fajr: '2023-01-01T05:00:00Z' }
        };
        const mockProvider = { getAnnualTimes: jest.fn().mockResolvedValue(fetchedData) };
        ProviderFactory.create.mockReturnValue(mockProvider);
        fsp.unlink.mockResolvedValue();
        fsp.access.mockRejectedValue(new Error('miss'));
        fsp.writeFile.mockResolvedValue();

        await service.forceRefresh(mockConfig);
        
        expect(fsp.unlink).toHaveBeenCalled();
        expect(mockProvider.getAnnualTimes).toHaveBeenCalled();
    });
});