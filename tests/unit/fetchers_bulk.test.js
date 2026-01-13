/* eslint-disable no-undef */
const { fetchAladhanAnnual, fetchMyMasjidBulk } = require('../../src/services/fetchers');
const { DateTime } = require('luxon');

// Mock global fetch
global.fetch = jest.fn();

const mockConfig = {
    location: {
        timezone: 'Europe/London',
        coordinates: { lat: 51.5, long: -0.1 }
    },
    calculation: {
        method: 'MoonsightingCommittee',
        madhab: 'Hanafi'
    },
    sources: {
        backup: { type: 'mymasjid', masjidId: '123' }
    }
};

describe('Fetchers Bulk', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    test('fetchAladhanAnnual parses response correctly', async () => {
        const mockResponse = {
            code: 200,
            status: "OK",
            data: {
                "1": [
                    {
                        timings: { Fajr: "05:00", Dhuhr: "12:00", Asr: "15:00", Maghrib: "18:00", Isha: "20:00" },
                        date: { gregorian: { date: "01-01-2023" } }
                    }
                ]
            }
        };

        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const result = await fetchAladhanAnnual(mockConfig, 2023);
        
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/calendar/2023'));
        expect(result['2023-01-01']).toBeDefined();
        // Since we are mocking, the parsing might depend on timezone in config, but luxon usually handles empty zone.
        // We set timezone Europe/London.
        expect(result['2023-01-01'].fajr).toContain('2023-01-01');
    });

    test('fetchMyMasjidBulk parses response correctly', async () => {
        // Construct the mock response matching MyMasjidBulkResponseSchema
        // The implementation uses the *current* system year (via DateTime.now()) combined with the day/month from the response.
        const currentYear = DateTime.now().year;
        const mockResponse = {
            model: {
                salahTimings: [
                    {
                        day: 1,
                        month: 1,
                        fajr: "05:00",
                        zuhr: "12:00",
                        asr: "15:00",
                        maghrib: "18:00",
                        isha: "20:00",
                        iqamah_Fajr: "05:30",
                        iqamah_Zuhr: "12:30",
                        iqamah_Asr: "15:30",
                        iqamah_Maghrib: "18:30",
                        iqamah_Isha: "20:30"
                    }
                ]
            }
        };

        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const result = await fetchMyMasjidBulk(mockConfig);

        // Based on fetchers.js:141, the URL includes "GetMasjidTimings"
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('GetMasjidTimings'));
        
        // The result key should be YYYY-01-01
        const expectedDate = `${currentYear}-01-01`;
        expect(result[expectedDate]).toBeDefined();
        
        // The code processes 'iqamah_Fajr' -> 'iqamah.fajr'
        expect(result[expectedDate].iqamah.fajr).toBeDefined();
        expect(result[expectedDate].iqamah.fajr).toContain(`${currentYear}-01-01T05:30`);
    });
});
