/* eslint-disable no-undef */
const request = require('supertest');
const express = require('express');

// Mock dependencies
jest.mock('../../src/services/schedulerService');
jest.mock('../../src/services/sseService');
jest.mock('../../src/services/prayerTimeService');
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn().mockReturnValue('{}'),
    writeFileSync: jest.fn() // For settings update
}));

// Mock config directly
const mockConfig = {
    location: { timezone: 'Europe/London' },
    prayers: { 
        fajr: { iqamahOffset: 10, roundTo: 5 }, 
        dhuhr: { iqamahOffset: 10, roundTo: 5 }, 
        asr: { iqamahOffset: 10, roundTo: 5 }, 
        maghrib: { iqamahOffset: 10, roundTo: 5 }, 
        isha: { iqamahOffset: 10, roundTo: 5 } 
    },
    sources: { primary: { type: 'aladhan' }, backup: { type: 'mymasjid' } } // Fixed sources structure
};
jest.mock('../../src/config', () => mockConfig);

const apiRoutes = require('../../src/routes/api');
const prayerTimeService = require('../../src/services/prayerTimeService');

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);

describe('Hybrid Iqamah Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('Uses Source Iqamah when available', async () => {
        const mockData = {
            meta: { source: 'mymasjid' },
            prayers: {
                fajr: '2023-01-01T05:00:00.000+00:00',
                dhuhr: '2023-01-01T12:00:00.000+00:00',
                asr: '2023-01-01T15:00:00.000+00:00',
                maghrib: '2023-01-01T18:00:00.000+00:00',
                isha: '2023-01-01T20:00:00.000+00:00',
                iqamah: {
                    fajr: '2023-01-01T05:30:00.000+00:00',
                    dhuhr: '2023-01-01T12:30:00.000+00:00'
                }
            }
        };
        prayerTimeService.getPrayerTimes.mockResolvedValue(mockData);

        const res = await request(app).get('/api/prayers');
        // console.log(res.body); 
        expect(res.statusCode).toBe(200);
        
        expect(res.body.prayers.fajr.iqamah).toBe('2023-01-01T05:30:00.000+00:00');
        expect(res.body.prayers.dhuhr.iqamah).toBe('2023-01-01T12:30:00.000+00:00');
        
        expect(res.body.prayers.asr.iqamah).toBeDefined();
    });

    test('Uses Calculation when Source Iqamah missing', async () => {
        const mockData = {
            meta: { source: 'aladhan' },
            prayers: {
                fajr: '2023-01-01T05:00:00.000+00:00',
                dhuhr: '2023-01-01T12:00:00.000+00:00',
                asr: '2023-01-01T15:00:00.000+00:00',
                maghrib: '2023-01-01T18:00:00.000+00:00',
                isha: '2023-01-01T20:00:00.000+00:00',
                iqamah: {}
            }
        };
        prayerTimeService.getPrayerTimes.mockResolvedValue(mockData);

        const res = await request(app).get('/api/prayers');
        
        expect(res.body.prayers.fajr.iqamah).toBeDefined();
        expect(res.body.prayers.fajr.iqamah).not.toBe(res.body.prayers.fajr.start);
    });
});
