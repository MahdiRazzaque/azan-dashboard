/* eslint-disable no-undef */
const schedule = require('node-schedule');
const schedulerService = require('../../src/services/schedulerService');
const prayerTimeService = require('../../src/services/prayerTimeService');
const { DateTime } = require('luxon');

jest.mock('node-schedule');
jest.mock('../../src/services/prayerTimeService');
jest.mock('../../src/services/audioAssetService');
jest.mock('../../src/services/automationService');

jest.mock('../../src/config', () => ({
    location: { timezone: 'UTC' },
    automation: { triggers: {} },
    data: { staleCheckDays: 7 }
}));

describe('Scheduler Maintenance Jobs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        schedule.scheduleJob.mockReturnValue({ cancel: jest.fn() });
        prayerTimeService.getPrayerTimes.mockResolvedValue({ prayers: {} });
    });

    test('Schedules maintenance jobs on init', async () => {
        await schedulerService.initScheduler();
        expect(schedule.scheduleJob).toHaveBeenCalledWith('0 3 * * 0', expect.any(Function));
        expect(schedule.scheduleJob).toHaveBeenCalledWith('0 4 * * *', expect.any(Function));
    });

    test('Stale Check triggers refresh if data is old', async () => {
        let staleCallback;
        schedule.scheduleJob.mockImplementation((rule, cb) => {
            if (rule === '0 3 * * 0') staleCallback = cb;
            return { cancel: jest.fn() };
        });

        // Initialize (should populate callbacks)
        await schedulerService.initScheduler();
        expect(staleCallback).toBeDefined();

        const eightDaysAgo = DateTime.now().minus({ days: 8 }).toISO();
        prayerTimeService.readCache.mockReturnValue({
            meta: { lastFetched: eightDaysAgo }
        });

        // Manually trigger callback
        await staleCallback();

        expect(prayerTimeService.forceRefresh).toHaveBeenCalled();
    });

    test('Stale Check does NOT trigger refresh if data is fresh', async () => {
        let staleCallback;
        schedule.scheduleJob.mockImplementation((rule, cb) => {
            if (rule === '0 3 * * 0') staleCallback = cb;
            return { cancel: jest.fn() };
        });

        await schedulerService.initScheduler();
        
        const twoDaysAgo = DateTime.now().minus({ days: 2 }).toISO();
        prayerTimeService.readCache.mockReturnValue({
            meta: { lastFetched: twoDaysAgo }
        });

        await staleCallback();

        expect(prayerTimeService.forceRefresh).not.toHaveBeenCalled();
    });
});
