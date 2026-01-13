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
        const mockResponse = {
            success: true,
            data: {
                timings: [
                    {
                        date: "2023-01-01",
                        fajr: "05:00",
                        zuhr: "12:00",
                        asr: "15:00",
                        maghrib: "18:00",
                        isha: "20:00",
                        iqamah: { fajr: "05:30" }
                    }
                ]
            }
        };

        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockResponse
        });

        const result = await fetchMyMasjidBulk(mockConfig);

        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/bulk'));
        expect(result['2023-01-01']).toBeDefined();
        expect(result['2023-01-01'].iqamah.fajr).toBeDefined();
    });
});
