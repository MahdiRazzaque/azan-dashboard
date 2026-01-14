const { DateTime } = require('luxon');
const fs = require('fs');
const path = require('path');

describe('Task 2 Verification', () => {

    describe('Global Automation Switch', () => {
        let schedulerService;
        let schedule;
        let configMock;
        let prayerTimeServiceMock;

        beforeEach(() => {
            jest.resetModules();
            jest.mock('node-schedule');
            jest.mock('../../src/services/prayerTimeService');
            jest.mock('../../src/services/audioAssetService');
            jest.mock('../../src/services/automationService'); // Trigger event

            schedule = require('node-schedule');
            schedule.scheduleJob = jest.fn((date, cb) => ({ cancel: jest.fn() }));

            prayerTimeServiceMock = require('../../src/services/prayerTimeService');
            prayerTimeServiceMock.getPrayerTimes.mockResolvedValue({
                prayers: {
                    fajr: DateTime.now().plus({ hours: 1 }).toISO(),
                    iqamah: {}
                }
            });

            configMock = {
                location: { timezone: 'UTC' },
                prayers: {},
                automation: {
                    global: { enabled: true, adhanEnabled: true },
                    triggers: {
                        fajr: { adhan: { enabled: true } }
                    }
                }
            };
            jest.doMock('../../src/config', () => configMock);

            schedulerService = require('../../src/services/schedulerService');
        });

        test('should schedule jobs when enabled', async () => {
            await schedulerService.initScheduler();
            // Expect Midnight Job + Stale Check + Boundary Check + Fajr Adhan = 4
            expect(schedule.scheduleJob).toHaveBeenCalledTimes(4);
        });

        test('should skip non-maintenance jobs when global.enabled is false', async () => {
            configMock.automation.global.enabled = false;
            // Re-require not strictly necessary if module uses config reference, but initScheduler reads current config properties.
            await schedulerService.initScheduler();
            // Expect Only Midnight + Stale + Boundary = 3
            expect(schedule.scheduleJob).toHaveBeenCalledTimes(3);
        });
        
         test('should skip specific event type when disabled', async () => {
            configMock.automation.global.adhanEnabled = false;
            await schedulerService.initScheduler();
            // Expect Only Midnight + Stale + Boundary = 3 (Adhan skipped)
            expect(schedule.scheduleJob).toHaveBeenCalledTimes(3);
        });
    });

    describe('Iqamah Override Logic (Service Level)', () => {
        let prayerTimeService;
        let testDate;

        beforeEach(() => {
            jest.resetModules();
            jest.unmock('../../src/services/prayerTimeService'); // Ensure we use real implementation
            testDate = DateTime.now();
            
            // Mock Dependencies
            jest.doMock('../../src/services/fetchers', () => ({
                 fetchAladhanAnnual: jest.fn(),
                 fetchMyMasjidBulk: jest.fn()
            }));
            
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
                return JSON.stringify({
                    meta: { source: 'mymasjid', lastFetched: testDate.toISO() },
                    data: {
                        [testDate.toISODate()]: {
                            fajr: `${testDate.toISODate()}T05:00:00`,
                            iqamah: { fajr: `${testDate.toISODate()}T05:15:00` } 
                        }
                    }
                });
            });

            // Mock Config
            jest.doMock('../../src/config', () => ({
                location: { timezone: 'UTC' },
                sources: { primary: { type: 'mymasjid' } },
                prayers: {
                    fajr: { 
                        iqamahOverride: false,
                        iqamahOffset: 30, 
                        roundTo: 0
                    }
                }
            }));
            
            prayerTimeService = require('../../src/services/prayerTimeService');
        });
        
        afterEach(() => {
            jest.restoreAllMocks();
        });

        test('should return source iqamah when override is false', async () => {
            const config = require('../../src/config');
            config.prayers.fajr.iqamahOverride = false;
            
            const result = await prayerTimeService.getPrayerTimes(config, testDate);
            expect(result.prayers.iqamah.fajr).toContain('05:15:00');
        });

        test('should return calculated iqamah when override is true', async () => {
            const config = require('../../src/config');
            config.prayers.fajr.iqamahOverride = true;
            
            const result = await prayerTimeService.getPrayerTimes(config, testDate);
            // 05:00 + 30m = 05:30:00
            expect(result.prayers.iqamah.fajr).toContain('05:30:00');
        });
    });

});
