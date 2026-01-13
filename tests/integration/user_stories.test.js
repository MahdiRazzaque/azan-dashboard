const request = require('supertest');
const fetchers = require('../../src/services/fetchers');
const fs = require('fs');
const config = require('../../src/config');
const app = require('../../src/server');

jest.mock('../../src/services/fetchers');
jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

describe('User Stories Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2023-10-01T10:00:00Z'));

        // Default Mock Data (Timezone matches London config presumably)
        const mockMap = {
            '2023-10-01': {
                fajr: '2023-10-01T05:00:00.000+01:00',
                dhuhr: '2023-10-01T13:00:00.000+01:00',
                asr: '2023-10-01T16:30:00.000+01:00',
                maghrib: '2023-10-01T19:00:00.000+01:00',
                isha: '2023-10-01T20:30:00.000+01:00',
                iqamah: {}
            }
        };
        fetchers.fetchAladhanAnnual.mockResolvedValue(mockMap);
        
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('US-1: Changing config changes iqamah calculation', async () => {
        // Backup original
        const originalFajr = { ...config.prayers.fajr };
        
        // Modify config: Set Fajr Fixed Time to 06:00
        config.prayers.fajr.fixedTime = "06:00";
        
        const response = await request(app).get('/api/prayers');
        
        expect(response.status).toBe(200);
        const fajr = response.body.prayers.fajr;
        
        // Input 05:00. Fixed 06:00.
        // Should contain 06:00:00
        expect(fajr.iqamah).toContain('T06:00:00');
        
        // Restore
        config.prayers.fajr = originalFajr;
    });

    test('US-2: Network Resilience (End-to-End)', async () => {
        // Fail Primary
        fetchers.fetchAladhanAnnual.mockRejectedValue(new Error('Network Down'));
        
        // Mock Backup
        const mockBackupMap = {
            '2023-10-01': {
                fajr: '2023-10-01T05:05:00.000+01:00',
                dhuhr: '2023-10-01T13:05:00.000+01:00',
                asr: '2023-10-01T16:35:00.000+01:00',
                maghrib: '2023-10-01T19:05:00.000+01:00',
                isha: '2023-10-01T20:35:00.000+01:00',
                iqamah: {}
            }
        };
        fetchers.fetchMyMasjidBulk.mockResolvedValue(mockBackupMap);

        const response = await request(app).get('/api/prayers');
        
        expect(response.status).toBe(200);
        expect(response.body.meta.source).toBe('mymasjid');
        expect(response.body.prayers.fajr.start).toContain('05:05:00');
    });
});
