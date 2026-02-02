const MyMasjidProvider = require('../../../providers/MyMasjidProvider');
const { ProviderConnectionError, ProviderValidationError } = require('../../../providers/errors');
const { DateTime } = require('luxon');

// Mock requestQueue
jest.mock('@utils/requestQueue', () => ({
    myMasjidQueue: { schedule: (fn) => fn() }
}));

describe('MyMasjidProvider', () => {
    let provider;
    const sourceConfig = { type: 'mymasjid', masjidId: 'test-guid' };
    const globalConfig = {
        location: { timezone: 'Europe/London' },
        sources: {
            primary: { type: 'mymasjid', masjidId: 'test-guid' }
        }
    };

    beforeEach(() => {
        provider = new MyMasjidProvider(sourceConfig, globalConfig);
        global.fetch = jest.fn();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    const mockNestedResponse = {
        model: {
            salahTimings: [{
                day: 1, month: 1,
                fajr: [{ salahName: 'Fajr', salahTime: '05:00', iqamahTime: '05:30' }],
                zuhr: [{ salahName: 'Dhuhr', salahTime: '12:30', iqamahTime: '13:00' }],
                asr: [{ salahName: 'Asr', salahTime: '15:30', iqamahTime: '16:00' }],
                maghrib: [{ salahName: 'Maghrib', salahTime: '17:00', iqamahTime: '17:15' }],
                isha: [{ salahName: 'Isha', salahTime: '19:00', iqamahTime: '20:00' }],
                shouruq: [{ salahName: 'Sunrise', salahTime: '07:00', iqamahTime: null }]
            }]
        }
    };

    it('should fetch and parse nested MyMasjid data', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockNestedResponse)
        });

        const result = await provider.getAnnualTimes(2024);
        
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('GuidId=test-guid'));
        const currentYear = DateTime.now().setZone('Europe/London').year;
        const key = `${currentYear}-01-01`;
        expect(result[key]).toBeDefined();
        expect(result[key].fajr).toContain('T05:00:00');
        expect(result[key].iqamah.fajr).toContain('T05:30:00');
    });

    it('should throw ProviderConnectionError on 5xx error', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        });

        await expect(provider.getAnnualTimes(2024)).rejects.toThrow(ProviderConnectionError);
    });

    it('should throw ProviderValidationError on 400 error', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 400,
            statusText: 'Bad Request'
        });

        await expect(provider.getAnnualTimes(2024)).rejects.toThrow(ProviderValidationError);
    });

    it('should handle flat response format', async () => {
        const mockFlatResponse = {
            model: {
                salahTimings: [{
                    day: 1, month: 1,
                    fajr: '05:00', zuhr: '12:00', asr: '15:00', maghrib: '18:00', isha: '20:00', shouruq: '07:00',
                    iqamah_Fajr: '05:30', iqamah_Zuhr: '12:30', iqamah_Asr: '15:30', iqamah_Maghrib: '18:15', iqamah_Isha: '20:30'
                }]
            }
        };
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockFlatResponse)
        });

        const result = await provider.getAnnualTimes(2024);
        const currentYear = DateTime.now().setZone('Europe/London').year;
        const key = `${currentYear}-01-01`;
        expect(result[key].fajr).toContain('T05:00:00');
        expect(result[key].iqamah.fajr).toContain('T05:30:00');
    });

    describe('healthCheck', () => {
        it('should return healthy if API is reachable (status < 500)', async () => {
            global.fetch.mockResolvedValue({ status: 400 });
            const result = await provider.healthCheck();
            expect(result.healthy).toBe(true);
        });

        it('should return unhealthy if API returns 5xx error', async () => {
            global.fetch.mockResolvedValue({ status: 500 });
            const result = await provider.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toContain('500');
        });

        it('should return unhealthy if network error', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));
            const result = await provider.healthCheck();
            expect(result.healthy).toBe(false);
            expect(result.message).toContain('Network error');
        });
    });
});