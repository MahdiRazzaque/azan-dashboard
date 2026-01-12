const { fetchAladhan } = require('../../src/services/fetchers');
const { DateTime, Settings } = require('luxon');

const mockConfig = {
  location: {
    timezone: 'Europe/London',
    coordinates: { lat: 51.5, long: -0.1 }
  },
  calculation: {
    method: 'MoonsightingCommittee',
    madhab: 'Hanafi'
  }
};

global.fetch = jest.fn();

describe('Data Fetchers', () => {
  beforeEach(() => {
    fetch.mockClear();
    Settings.defaultZone = 'system'; // Reset
  });

  test('fetchAladhan should return normalized times', async () => {
    const mockResponse = {
      code: 200,
      status: "OK",
      data: {
        timings: {
          Fajr: "05:00",
          Dhuhr: "13:00",
          Asr: "16:30",
          Maghrib: "19:00",
          Isha: "20:30",
          Sunrise: "06:30"
        },
        date: { gregorian: { date: "01-10-2023", format: "DD-MM-YYYY" } }
      }
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    // Determine a date. Note: 01-10-2023 is Oct 1st.
    const date = DateTime.fromISO('2023-10-01T12:00:00', { zone: 'Europe/London' });
    const result = await fetchAladhan(mockConfig, date);

    expect(fetch).toHaveBeenCalled();
    
    // Check construction
    // On Oct 1st 2023, London is BST (+01:00)
    expect(result.fajr).toBe('2023-10-01T05:00:00.000+01:00');
    expect(result.isha).toBe('2023-10-01T20:30:00.000+01:00');
  });

  test('fetchAladhan should throw on invalid schema', async () => {
    const invalidResponse = {
      code: 200,
      status: "OK",
      data: { 
          timings: { Fajr: "05:00" }, // Missing others
          date: { gregorian: { date: "01-10-2023", format: "DD-MM-YYYY" } }
      } 
    };

    fetch.mockResolvedValue({
      ok: true,
      json: async () => invalidResponse
    });

    await expect(fetchAladhan(mockConfig)).rejects.toThrow();
  });
});
