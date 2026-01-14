const request = require('supertest');
const app = require('../../src/server');
const fetchers = require('../../src/services/fetchers');
const fs = require('fs');

// Mock dependencies
jest.mock('../../src/services/fetchers');

// Spy to prevent cache writing but verify it happens
const writeMock = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

describe('API Integration', () => {
  beforeAll(async () => {
    await require('../../src/config').init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2023-10-01T10:00:00Z')); // Set "Now" to fit mocked data
    
    // Suppress logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });


  test('GET /api/prayers should return calculated times', async () => {
    const mockAnnualData = {
      '2023-10-01': {
        fajr: '2023-10-01T05:00:00.000+01:00',
        dhuhr: '2023-10-01T13:00:00.000+01:00',
        asr: '2023-10-01T16:30:00.000+01:00',
        maghrib: '2023-10-01T19:00:00.000+01:00',
        isha: '2023-10-01T20:30:00.000+01:00'
      }
    };
    
    fetchers.fetchAladhanAnnual.mockResolvedValue(mockAnnualData);

    const response = await request(app).get('/api/prayers');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('meta');
    expect(response.body.prayers).toBeDefined();
    
    // Check specific prayer structure
    const fajr = response.body.prayers.fajr;
    expect(fajr).toHaveProperty('start');
    expect(fajr).toHaveProperty('iqamah');
    
    // Check if fetcher was called
    expect(fetchers.fetchAladhanAnnual).toHaveBeenCalled();
  });

  test('GET /api/prayers should return 500 on total failure', async () => {
    fetchers.fetchAladhanAnnual.mockRejectedValue(new Error('Down'));
    fetchers.fetchMyMasjidBulk.mockRejectedValue(new Error('Down'));
    
    // Mock fs for cache failure
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    const response = await request(app).get('/api/prayers');
    
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });
});
