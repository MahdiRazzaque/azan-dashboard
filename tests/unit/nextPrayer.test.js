const { calculateNextPrayer } = require('../../src/utils/calculations');
const prayerTimeService = require('../../src/services/prayerTimeService');
const fetchers = require('../../src/services/fetchers');
const { DateTime } = require('luxon');
const fs = require('fs');
const request = require('supertest');
const app = require('../../src/server');

jest.mock('../../src/services/fetchers');
// Remove global fs mock to allow config loading
// jest.mock('fs');

describe('Next Prayer Logic & Caching (Task 3)', () => {
    
    // Setup generic spies
    let writeSpy;
    let readSpy;
    let existsSpy;

    beforeAll(() => {
        // Prevent actual file writing
        writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    describe('calculateNextPrayer Logic', () => {
        const prayers = {
            fajr: { start: '2023-10-01T05:00:00' },
            dhuhr: { start: '2023-10-01T13:00:00' },
            asr: { start: '2023-10-01T16:30:00' },
            maghrib: { start: '2023-10-01T19:00:00' },
            isha: { start: '2023-10-01T20:30:00' }
        };

        test('TC-01: Standard Countdown - Finds next prayer in same day', () => {
            // Mock time: 14:00 (Before Asr)
            const now = DateTime.fromISO('2023-10-01T14:00:00');
            const next = calculateNextPrayer(prayers, now);
            
            expect(next).not.toBeNull();
            expect(next.name).toBe('asr');
            expect(next.time).toBe('2023-10-01T16:30:00');
            expect(next.isTomorrow).toBe(false);
        });

        test('TC-02: Midnight Transition (Logic) - Returns null after Isha', () => {
            // Mock time: 21:00 (After Isha)
            const now = DateTime.fromISO('2023-10-01T21:00:00');
            const next = calculateNextPrayer(prayers, now);
            
            expect(next).toBeNull();
        });
    });

    describe('API Midnight Transition Integration', () => {
        beforeEach(() => {
             jest.clearAllMocks();
             jest.spyOn(console, 'log').mockImplementation(() => {});
             jest.spyOn(console, 'error').mockImplementation(() => {});
             // Mock writeFileSync again because clearAllMocks clears spies? 
             // calculateNextPrayer logic tests don't write, but integration might.
             jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        });

        test('TC-02: Midnight Transition (API) - Fetches tomorrow if logic returns null', async () => {
            jest.useFakeTimers();
            // Set time to 21:00 UTC (22:00 BST in London) - Still Oct 1st, after Isha
            jest.setSystemTime(new Date('2023-10-01T21:00:00Z'));
            
            // Mock responses
            // Return BOTH days in one "annual" fetch response (since service fetches year/bulk)
            // Use mockResolvedValue (persistent) because cache write is mocked (no-op), so 2nd request will trigger fetch again.
            fetchers.fetchAladhanAnnual.mockResolvedValue({
                '2023-10-01': {
                    fajr: '2023-10-01T05:00:00.000Z',
                    isha: '2023-10-01T20:00:00.000Z' 
                },
                '2023-10-02': {
                    fajr: '2023-10-02T05:00:00.000Z',
                    isha: '2023-10-02T20:00:00.000Z'
                }
            });

            // Mock existsSync to avoid picking up any real cache file
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);

            const res = await request(app).get('/api/prayers');
            
            expect(res.body.prayers).toBeDefined();
            expect(res.body.nextPrayer).toBeDefined();
            expect(res.body.nextPrayer.name).toBe('fajr');
            expect(res.body.nextPrayer.isTomorrow).toBe(true);
            expect(res.body.nextPrayer.time).toContain('2023-10-02');
            
            jest.useRealTimers();
        });
    });

    describe('TC-03: Cache Structure Persistence', () => {
         test('should store multiple dates in cache', async () => {
            const mockConfig = { sources: { primary: { type: 'aladhan' } } };
            const tomorrow = DateTime.fromISO('2023-10-02');
            
            // Mock reading existing cache
            // prayerTimeService expects cache to be { data: { 'YYYY-MM-DD': ... }, meta: ... }
            const existingCache = {
                data: {
                    '2023-10-01': { data: 'old-data' }
                }
            };
            
            // Spy on existsSync and readFileSync strictly for this test
            const existsSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            const readSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(existingCache));
            const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
            
            // Mock Fetch returning newer data
            fetchers.fetchAladhanAnnual.mockResolvedValue({ 
                '2023-10-02': { fajr: '05:00' } 
            });
            
            await prayerTimeService.getPrayerTimes(mockConfig, tomorrow);
            
            // Verify fs.writeFileSync was called
            expect(writeSpy).toHaveBeenCalled();
            const writeCall = writeSpy.mock.calls[0];
            const writtenData = JSON.parse(writeCall[1]);
            
            expect(writtenData.data).toHaveProperty('2023-10-01');
            expect(writtenData.data).toHaveProperty('2023-10-02');
            
            // Cleanup
            existsSpy.mockRestore();
            readSpy.mockRestore();
            writeSpy.mockRestore();
         });
    });
});

