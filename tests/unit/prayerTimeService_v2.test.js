/* eslint-disable no-undef */
const prayerTimeService = require('../../src/services/prayerTimeService');
const fetchers = require('../../src/services/fetchers');
const fs = require('fs');
const { DateTime } = require('luxon');

jest.mock('../../src/services/fetchers');
jest.mock('fs');

describe('Prayer Time Service V2', () => {
    const mockConfig = {
        location: { timezone: 'UTC' },
        sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid' } }
    };
    
    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReturnValue(true);
        fs.readFileSync.mockReturnValue('{}');
        fs.writeFileSync.mockImplementation(() => {});
        fs.mkdirSync.mockImplementation(() => {});
    });

    test('getPrayerTimes uses Cache Hit if available', async () => {
        const today = DateTime.now().toISODate();
        const cachedData = { 
            meta: { source: 'aladhan', lastFetched: '2023-01-01' },
            data: { 
                [today]: { fajr: '05:00' }
            }
        };
        fs.readFileSync.mockReturnValue(JSON.stringify(cachedData));
        fs.existsSync.mockReturnValue(true);

        const result = await prayerTimeService.getPrayerTimes(mockConfig);
        
        expect(fetchers.fetchAladhanAnnual).not.toHaveBeenCalled();
        expect(result.prayers.fajr).toBe('05:00');
        expect(result.meta.cached).toBe(true);
    });

    test('getPrayerTimes triggers Bulk Fetch on Cache Miss', async () => {
        // partial cache miss (empty data)
        fs.readFileSync.mockReturnValue(JSON.stringify({}));
        fs.existsSync.mockReturnValue(true);

        const today = DateTime.now().toISODate();
        const mockMap = {
            [today]: { fajr: '06:00' },
            '2026-02-01': { fajr: '06:10' }
        };

        fetchers.fetchAladhanAnnual.mockResolvedValue(mockMap);

        const result = await prayerTimeService.getPrayerTimes(mockConfig);

        expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
        expect(result.prayers.fajr).toBe('06:00');
        expect(result.meta.cached).toBe(false);
        
        // Check write
        expect(fs.writeFileSync).toHaveBeenCalled();
        const writtenData = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(writtenData.data[today]).toBeDefined();
        expect(writtenData.data['2026-02-01']).toBeDefined();
        expect(writtenData.meta.lastFetched).toBeDefined();
    });
});
