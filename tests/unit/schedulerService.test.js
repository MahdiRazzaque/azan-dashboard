const schedule = require('node-schedule');
const schedulerService = require('../../src/services/schedulerService');
const prayerTimeService = require('../../src/services/prayerTimeService');
const audioAssetService = require('../../src/services/audioAssetService');
const automationService = require('../../src/services/automationService');
const { DateTime } = require('luxon');

jest.mock('node-schedule');
jest.mock('../../src/services/prayerTimeService');
jest.mock('../../src/services/audioAssetService');
jest.mock('../../src/services/automationService');
jest.mock('../../src/config', () => ({
    location: { timezone: 'UTC' },
    prayers: {
        dhuhr: { iqamahOffsetMinutes: 15 }
    },
    automation: {
        triggers: {
            dhuhr: {
                preAdhan: { enabled: true, offsetMinutes: 15 },
                adhan: { enabled: true },
                preIqamah: { enabled: false }, // disabled
                iqamah: { enabled: false }
            }
        }
    }
}));

describe('Scheduler Service', () => {
    let mockJobs = [];

    beforeEach(() => {
        jest.clearAllMocks();
        mockJobs = [];
        
        schedule.scheduleJob.mockImplementation((datePattern, callback) => {
            const job = {
                cancel: jest.fn(),
                nextInvocation: () => datePattern
            };
            mockJobs.push(job);
            return job;
        });

        audioAssetService.prepareDailyAssets.mockResolvedValue();
        
        // Mock current time as 08:00 UTC
        const now = DateTime.fromISO('2023-10-01T08:00:00Z');
        jest.spyOn(DateTime, 'now').mockReturnValue(now);

        // Mock prayer times (Use correct structure)
        prayerTimeService.getPrayerTimes.mockResolvedValue({
            prayers: {
                dhuhr: '2023-10-01T13:00:00Z',
                iqamah: {
                    dhuhr: '2023-10-01T13:15:00Z'
                }
            }
        });
    });

    test('should schedule jobs for enabled triggers', async () => {
        await schedulerService.initScheduler();

        // 1 for Midnight refresh
        // 1 for PreAdhan (13:00 - 15m = 12:45)
        // 1 for Adhan (13:00)
        // 1 for Stale Check
        // 1 for Year Boundary Check
        // Total 5 calls to scheduleJob
        expect(schedule.scheduleJob).toHaveBeenCalledTimes(5);

        // Verify Midnight Job
        expect(schedule.scheduleJob).toHaveBeenCalledWith('0 0 * * *', expect.any(Function));

        // Verify PreAdhan
        const preAdhanTime = DateTime.fromISO('2023-10-01T12:45:00Z').toJSDate();
        expect(schedule.scheduleJob).toHaveBeenCalledWith(preAdhanTime, expect.any(Function));

        // Verify Adhan
        const adhanTime = DateTime.fromISO('2023-10-01T13:00:00Z').toJSDate();
        expect(schedule.scheduleJob).toHaveBeenCalledWith(adhanTime, expect.any(Function));
    });

    test('should hot reload and cancel old jobs', async () => {
        await schedulerService.initScheduler();
        expect(mockJobs.length).toBe(5);  // Midnight + 2 events + 2 maintenance

        const oldJobs = [...mockJobs];

        await schedulerService.hotReload();

        // Verify old jobs cancelled
        oldJobs.forEach(job => {
            expect(job.cancel).toHaveBeenCalled();
        });

        // New jobs created (Total calls to scheduleJob increases)
        expect(schedule.scheduleJob).toHaveBeenCalledTimes(10);
    });
});
