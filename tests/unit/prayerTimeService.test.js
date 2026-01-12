const prayerTimeService = require('../../src/services/prayerTimeService');
const fetchers = require('../../src/services/fetchers');
const fs = require('fs');
const { DateTime } = require('luxon');

jest.mock('../../src/services/fetchers');
jest.mock('fs');

describe('Prayer Time Service', () => {
    const mockConfig = {
        sources: {
            primary: { type: 'aladhan' },
            backup: { type: 'mymasjid', masjidId: '123' }
        },
        location: { timezone: 'UTC' } // minimal needed
    };
    
    const mockData = { fajr: '05:00', isha: '20:00' };

    beforeEach(() => {
        jest.clearAllMocks();
        // Setup console mocks to suppress logs during tests
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('should return data from primary source and cache it', async () => {
        fetchers.fetchAladhan.mockResolvedValue(mockData);
        
        const result = await prayerTimeService.getPrayerTimes(mockConfig);
        
        expect(fetchers.fetchAladhan).toHaveBeenCalled();
        expect(fetchers.fetchMyMasjid).not.toHaveBeenCalled();
        expect(result.prayers).toEqual(mockData);
        // Ensure cache writing happened
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('should fallback to backup if primary fails', async () => {
        fetchers.fetchAladhan.mockRejectedValue(new Error('Network Error'));
        fetchers.fetchMyMasjid.mockResolvedValue(mockData);
        
        const result = await prayerTimeService.getPrayerTimes(mockConfig);
        
        expect(fetchers.fetchAladhan).toHaveBeenCalled();
        expect(fetchers.fetchMyMasjid).toHaveBeenCalled();
        expect(result.meta.source).toBe('mymasjid');
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('should fallback to cache if both fail', async () => {
        fetchers.fetchAladhan.mockRejectedValue(new Error('Fail 1'));
        fetchers.fetchMyMasjid.mockRejectedValue(new Error('Fail 2'));
        
        const cachedData = JSON.stringify({
            date: '2023-01-01',
            data: mockData,
            source: 'aladhan'
        });
        
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue(cachedData);
        
        const result = await prayerTimeService.getPrayerTimes(mockConfig);
        
        expect(result.meta.cached).toBe(true);
        expect(result.prayers).toEqual(mockData);
    });

    test('should throw error if all fail and no cache', async () => {
        fetchers.fetchAladhan.mockRejectedValue(new Error('Fail'));
        fetchers.fetchMyMasjid.mockRejectedValue(new Error('Fail'));
        fs.existsSync.mockReturnValue(false);
        
        await expect(prayerTimeService.getPrayerTimes(mockConfig)).rejects.toThrow();
    });
});
