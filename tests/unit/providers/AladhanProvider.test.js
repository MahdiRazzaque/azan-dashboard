const AladhanProvider = require('@providers/AladhanProvider');
const { ProviderConnectionError, ProviderValidationError } = require('@providers');

// Mock requestQueue
jest.mock('@utils/requestQueue', () => ({
    aladhanQueue: { schedule: (fn) => fn() }
}));

describe('AladhanProvider', () => {
    let provider;
    const sourceConfig = { 
        type: 'aladhan',
        method: 'ISNA',
        madhab: 'Shafi',
        latitudeAdjustmentMethod: 'Angle Based',
        midnightMode: 'Standard'
    };
    const globalConfig = {
        location: {
            coordinates: { lat: 51.5, long: -0.1 },
            timezone: 'Europe/London'
        }
    };

    beforeEach(() => {
        provider = new AladhanProvider(sourceConfig, globalConfig);
        global.fetch = jest.fn();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    const mockResponse = {
        code: 200,
        status: 'OK',
        data: {
            "1": [{
                date: { 
                    gregorian: { 
                        date: '01-01-2024',
                        day: '01',
                        month: { number: 1 },
                        year: '2024'
                    }
                },
                timings: {
                    Fajr: '05:00 (BST)',
                    Sunrise: '07:00 (BST)',
                    Dhuhr: '12:00 (BST)',
                    Asr: '15:00 (BST)',
                    Sunset: '18:00 (BST)',
                    Maghrib: '18:00 (BST)',
                    Isha: '19:30 (BST)',
                    Imsak: '04:50 (BST)',
                    Midnight: '00:00 (BST)'
                },
                meta: {
                    timezone: 'Europe/London'
                }
            }]
        }
    };

    it('should fetch and parse Aladhan data', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResponse)
        });

        const result = await provider.getAnnualTimes(2024);
        
        expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('latitude=51.5'));
        expect(result['2024-01-01']).toBeDefined();
        expect(result['2024-01-01'].fajr).toContain('T05:00:00');
    });

    it('should throw ProviderConnectionError on 5xx error', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 503,
            statusText: 'Service Unavailable'
        });

        await expect(provider.getAnnualTimes(2024)).rejects.toThrow(ProviderConnectionError);
    });

    it('should throw ProviderValidationError on 4xx error', async () => {
        global.fetch.mockResolvedValue({
            ok: false,
            status: 400,
            statusText: 'Bad Request'
        });

        await expect(provider.getAnnualTimes(2024)).rejects.toThrow(ProviderValidationError);
    });

    it('should throw ProviderValidationError on schema failure', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ data: "invalid" })
        });

        await expect(provider.getAnnualTimes(2024)).rejects.toThrow(ProviderValidationError);
    });

    it('should deduplicate concurrent requests for the same year', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 10))
        });

        const p1 = provider.getAnnualTimes(2024);
        const p2 = provider.getAnnualTimes(2024);

        await Promise.all([p1, p2]);
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
