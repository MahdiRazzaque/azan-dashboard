const schedule = require('node-schedule');
const service = require('@services/core/schedulerService');
const configService = require('@config');
const prayerTimeService = require('@services/core/prayerTimeService');
const automationService = require('@services/core/automationService');
const { DateTime } = require('luxon');

jest.mock('node-schedule');
jest.mock('@config');
jest.mock('@services/core/prayerTimeService');
jest.mock('@services/core/automationService');
jest.mock('@services/system/healthCheck');
jest.mock('@services/system/audioAssetService'); 
jest.mock('@services/system/voiceService');

describe('Scheduler Catch-Up Logic', () => {
    const mockConfig = {
        location: { timezone: 'UTC', coordinates: { lat: 0, long: 0 } },
        prayers: {
            fajr: { iqamahOffset: 10, roundTo: 0, fixedTime: null, iqamahOverride: false }
        },
        automation: {
            global: { enabled: true, adhanEnabled: true },
            triggers: {
                fajr: { adhan: { enabled: true } }
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        configService.get.mockReturnValue(mockConfig);
        
        schedule.scheduleJob.mockImplementation((date, callback) => ({
            cancel: jest.fn()
        }));
        
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should catch up missed events within 60 seconds', async () => {
        // Mock current time to 05:00:30
        const now = DateTime.fromISO('2099-01-01T05:00:30Z');
        jest.useFakeTimers().setSystemTime(now.toJSDate());
        
        prayerTimeService.getPrayerTimes.mockResolvedValue({
            prayers: {
                fajr: '2099-01-01T05:00:00Z' // Missed by 30s
            }
        });
        
        await service.initScheduler();
        
        // Should trigger event immediately
        expect(automationService.triggerEvent).toHaveBeenCalledWith('fajr', 'adhan');
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Missed fajr adhan by 30.0s, executing catch-up.'));
    });

    it('should NOT catch up missed events older than 60 seconds', async () => {
        // Mock current time to 05:02:00
        const now = DateTime.fromISO('2099-01-01T05:02:00Z');
        jest.useFakeTimers().setSystemTime(now.toJSDate());
        
        prayerTimeService.getPrayerTimes.mockResolvedValue({
            prayers: {
                fajr: '2099-01-01T05:00:00Z' // Missed by 120s
            }
        });
        
        await service.initScheduler();
        
        // Should NOT trigger event
        expect(automationService.triggerEvent).not.toHaveBeenCalled();
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('is in the past'));
    });
});
