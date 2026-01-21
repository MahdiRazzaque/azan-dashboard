const schedule = require('node-schedule');
const service = require('@services/core/schedulerService');
const configService = require('@config');
const prayerTimeService = require('@services/core/prayerTimeService');
const automationService = require('@services/core/automationService');
const healthCheck = require('@services/system/healthCheck');
const audioAssetService = require('@services/system/audioAssetService');
const voiceService = require('@services/system/voiceService');
const { DateTime } = require('luxon');

jest.mock('node-schedule');
jest.mock('@config');
jest.mock('@services/core/prayerTimeService');
jest.mock('@services/core/automationService');
jest.mock('@services/system/audioAssetService'); 
jest.mock('@services/system/healthCheck');
jest.mock('@services/system/voiceService');

describe('SchedulerService', () => {
    const mockConfig = {
        location: { timezone: 'UTC', coordinates: { lat: 0, long: 0 } },
        prayers: {
            fajr: { iqamahOffset: 10, roundTo: 0, fixedTime: null, iqamahOverride: false },
            dhuhr: { iqamahOffset: 10, roundTo: 0, fixedTime: null, iqamahOverride: false },
            asr: { iqamahOffset: 10, roundTo: 0, fixedTime: null, iqamahOverride: false },
            maghrib: { iqamahOffset: 10, roundTo: 0, fixedTime: null, iqamahOverride: false },
            isha: { iqamahOffset: 10, roundTo: 0, fixedTime: null, iqamahOverride: false }
        },
        automation: {
            global: { enabled: true, preAdhanEnabled: true, adhanEnabled: true, preIqamahEnabled: true, iqamahEnabled: true },
            triggers: {
                fajr: {
                    preAdhan: { enabled: true, offsetMinutes: 10 },
                    adhan: { enabled: true },
                    preIqamah: { enabled: true, offsetMinutes: 10 },
                    iqamah: { enabled: true }
                },
                dhuhr: { adhan: { enabled: true } },
                asr: { adhan: { enabled: true } },
                maghrib: { adhan: { enabled: true } },
                isha: { adhan: { enabled: true } }
            }
        }
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers().setSystemTime(new Date('2099-01-01T00:00:00Z'));
        configService.get.mockReturnValue(mockConfig);
        
        // Robust Mock for 2-arg usage (Rule/Date, Callback)
        schedule.scheduleJob.mockImplementation((nameOrRule, callback) => {
            const job = { 
                name: typeof nameOrRule === 'string' ? nameOrRule : 'test-job',
                jobName: typeof nameOrRule === 'string' ? nameOrRule : 'test-job', 
                cancel: jest.fn(), 
                nextInvocation: () => new Date(),
                invoke: typeof nameOrRule === 'function' ? nameOrRule : callback 
            };
            return job;
        });
        
        prayerTimeService.getPrayerTimes.mockResolvedValue({
            prayers: {
                fajr: '2099-01-01T05:00:00Z', 
                dhuhr: '2099-01-01T12:00:00Z',
                asr: '2099-01-01T15:00:00Z',
                maghrib: '2099-01-01T17:00:00Z',
                isha: '2099-01-01T19:00:00Z',
                iqamah: {
                    fajr: '2099-01-01T05:20:00Z',
                    dhuhr: '2099-01-01T12:20:00Z',
                    asr: '2099-01-01T15:20:00Z',
                    maghrib: '2099-01-01T17:20:00Z',
                    isha: '2099-01-01T19:20:00Z'
                }
            }
        });
        
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should initialize and schedule midnight refresh', async () => {
        await service.initScheduler();
        expect(schedule.scheduleJob).toHaveBeenCalled();
    });

    it('should schedule and execute prayer triggered events', async () => {
        await service.initScheduler();
        const jobCall = schedule.scheduleJob.mock.calls.find(c => typeof c[0] === 'object');
        expect(jobCall).toBeDefined();
        await jobCall[1]();
        expect(automationService.triggerEvent).toHaveBeenCalled();
    });

    it('should respect global switches', async () => {
         const disabledMock = JSON.parse(JSON.stringify(mockConfig));
         disabledMock.automation.global.enabled = false;
         configService.get.mockReturnValue(disabledMock);
         await service.initScheduler();
         const automationJob = schedule.scheduleJob.mock.calls.find(c => typeof c[0] === 'object');
         expect(automationJob).toBeUndefined();
    });

    it('should respect individual global switches', async () => {
        const disabledMock = JSON.parse(JSON.stringify(mockConfig));
        disabledMock.automation.global.adhanEnabled = false;
        disabledMock.automation.global.preAdhanEnabled = false;
        disabledMock.automation.global.preIqamahEnabled = false;
        disabledMock.automation.global.iqamahEnabled = false;
        configService.get.mockReturnValue(disabledMock);
        await service.initScheduler();
        
        // Automation jobs use Date objects as first arg. Maintenance jobs use strings.
        const automationJobs = schedule.scheduleJob.mock.calls.filter(c => typeof c[0] === 'object' && !(c[0] instanceof String));
        expect(automationJobs.length).toBe(0);
    });

    it('should skip events in the past', async () => {
         prayerTimeService.getPrayerTimes.mockResolvedValue({
             prayers: { fajr: '1999-01-01T05:00:00Z', iqamah: {} }
         });
         await service.initScheduler();
         const jobCall = schedule.scheduleJob.mock.calls.find(c => typeof c[0] === 'object');
         expect(jobCall).toBeUndefined();
    });

    it('should hot reload by cancelling old jobs', async () => {
         await service.initScheduler();
         const initialJobs = schedule.scheduleJob.mock.results.map(r => r.value).filter(j => j !== null);
         await service.hotReload();
         initialJobs.forEach(job => {
             expect(job.cancel).toHaveBeenCalled();
         });
    });

    describe('Maintenance Jobs', () => {
        it('should run hourly health check', async () => {
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 * * * *');
            await call[1]();
            expect(healthCheck.refresh).toHaveBeenCalled();
        });

        it('should run stale check and force refresh if needed', async () => {
            prayerTimeService.readCache.mockReturnValue({
                meta: { lastFetched: DateTime.now().minus({ days: 10 }).toISO() }
            });
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 3 * * 0');
            await call[1]();
            expect(prayerTimeService.forceRefresh).toHaveBeenCalled();
        });

        it('should run stale check and skip if fresh', async () => {
            prayerTimeService.readCache.mockReturnValue({
                meta: { lastFetched: DateTime.now().minus({ days: 2 }).toISO() }
            });
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 3 * * 0');
            await call[1]();
            expect(prayerTimeService.forceRefresh).not.toHaveBeenCalled();
        });

        it('should run year boundary check and fetch next year if needed', async () => {
            // Mock date to Dec 28th
            jest.setSystemTime(new Date('2099-12-28T12:00:00Z'));
            prayerTimeService.readCache.mockReturnValue({ data: {} });
            
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 4 * * *');
            await call[1]();
            expect(prayerTimeService.getPrayerTimes).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ year: 2100 }));
        });

        it('should run audio asset maintenance daily', async () => {
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '30 3 * * *');
            await call[1]();
            expect(audioAssetService.syncAudioAssets).toHaveBeenCalledWith(false);
        });

        it('should run source health check daily', async () => {
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 2 * * *');
            await call[1]();
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource', 'silent');
        });

        it('should handle source health check failure', async () => {
            healthCheck.refresh.mockRejectedValue(new Error('Source Health Error'));
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 2 * * *');
            await call[1]();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Source Health Check Failed'), expect.anything());
        });

        it('should run midnight refresh', async () => {
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 0 * * *');
            await call[1]();
            expect(configService.reload).toHaveBeenCalled();
        });

        it('should handle maintenance job errors', async () => {
             prayerTimeService.readCache.mockImplementation(() => { throw new Error('Stale Error'); });
             healthCheck.refresh.mockRejectedValue(new Error('Health Error'));
             
             await service.initScheduler();
             
             // Trigger Stale Check
             const staleCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 3 * * 0');
             await staleCall[1]();
             
             // Trigger Health Check
             const healthCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 * * * *');
             await healthCall[1]();
             
             expect(console.error).toHaveBeenCalled();
        });

        it('should handle missing cache meta in stale check', async () => {
             prayerTimeService.readCache.mockReturnValue({ data: {} }); // no meta
             await service.initScheduler();
             const staleJobCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 3 * * 0');
             expect(staleJobCall).toBeDefined();
             const staleJobCb = staleJobCall[1];
             await staleJobCb();
             expect(prayerTimeService.getPrayerTimes).toHaveBeenCalled();
             expect(console.log).toHaveBeenCalledWith(expect.stringContaining('No cache meta found'));
        });

        it('should execute midnight refresh', async () => {
             await service.initScheduler();
             const midnightCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 0 * * *');
             expect(midnightCall).toBeDefined();
             const midnightJobCb = midnightCall[1];
             await midnightJobCb();
             expect(configService.reload).toHaveBeenCalled();
             expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Midnight Refresh'));
        });

        it('should handle year boundary error', async () => {
            jest.setSystemTime(new Date('2099-12-28T12:00:00Z'));
            prayerTimeService.readCache.mockImplementation(() => { throw new Error('Year Error'); });
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 4 * * *');
            await call[1]();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Year Boundary Check Failed'), expect.anything());
        });
    });

    describe('getJobs formatting', () => {
        it('should format jobs correctly in getJobs', async () => {
             const dt = DateTime.fromISO('2099-01-01T12:00:00Z');
             schedule.scheduleJob.mockImplementation((name, cb) => ({
                 jobName: name,
                 category: 'maintenance',
                 nextInvocation: () => dt,
                 cancel: jest.fn()
             }));
             await service.initScheduler();
             const list = service.getJobs();
             expect(list.maintenance[0].nextInvocation).toBe(dt.toISO());
        });

        it('should handle different date types in nextInvocation', async () => {
            const date = new Date('2099-01-01T12:00:00Z');
            
            // 1. Date object
            schedule.scheduleJob.mockImplementation((dateInput, cb) => ({
                jobName: 'date-test',
                category: 'automation',
                nextInvocation: () => date,
                cancel: jest.fn()
            }));
            await service.initScheduler();
            let list = service.getJobs();
            // In initScheduler, the automation jobs are created via scheduleEvent
            // which sets job.jobName = `${prayer} - ${event}`
            // But our mock overrides whatever it returns.
            // Actually, scheduleEvent does:
            // const job = schedule.scheduleJob(...);
            // if (job) { job.jobName = ...; jobs.push(job); }
            // So the jobName we set in mock will be OVERWRITTEN.
            
            // Wait, I should just find any automation job and check its nextInvocation
            expect(list.automation[0].nextInvocation).toBe(DateTime.fromJSDate(date).toISO());

            // 2. Object with toDate
            schedule.scheduleJob.mockImplementation((dateInput, cb) => ({
                jobName: 'todate-test',
                category: 'automation',
                nextInvocation: () => ({ toDate: () => date }),
                cancel: jest.fn()
            }));
            await service.initScheduler();
            list = service.getJobs();
            expect(list.automation[0].nextInvocation).toBe(DateTime.fromJSDate(date).toISO());

            // 3. Luxon DateTime (via toISO)
            const luxonDate = DateTime.fromJSDate(date);
            schedule.scheduleJob.mockImplementation((dateInput, cb) => ({
                jobName: 'luxon-test',
                category: 'automation',
                nextInvocation: () => luxonDate,
                cancel: jest.fn()
            }));
            await service.initScheduler();
            list = service.getJobs();
            expect(list.automation[0].nextInvocation).toBe(luxonDate.toISO());

            // 4. Fallback (e.g., number/string that can be passed to Date constructor)
            schedule.scheduleJob.mockImplementation((dateInput, cb) => ({
                jobName: 'fallback-test',
                category: 'automation',
                nextInvocation: () => date.getTime(),
                cancel: jest.fn()
            }));
            await service.initScheduler();
            list = service.getJobs();
            expect(list.automation[0].nextInvocation).toBe(date.toISOString());
        });

        it('should handle all date fallback types in formatJob', async () => {
            const dateStr = '2099-01-01T12:00:00.000Z';
            const date = new Date(dateStr);
            
            // 1. instance of Date
            schedule.scheduleJob.mockImplementation((d, cb) => ({
                jobName: 'date-test', nextInvocation: () => date, cancel: jest.fn(), category: 'maintenance'
            }));
            await service.initScheduler();
            // Stale check is usually the first maintenance job
            expect(service.getJobs().maintenance[0].nextInvocation).toBe(DateTime.fromJSDate(date).toISO());

            // 2. Luxon toISO
            const luxon = DateTime.fromJSDate(date);
            schedule.scheduleJob.mockImplementation((d, cb) => ({
                jobName: 'luxon-test', nextInvocation: () => luxon, cancel: jest.fn(), category: 'maintenance'
            }));
            await service.initScheduler();
            expect(service.getJobs().maintenance[0].nextInvocation).toBe(luxon.toISO());

            // 3. something else (fallback to new Date(next))
            schedule.scheduleJob.mockImplementation((d, cb) => ({
                jobName: 'raw-test', nextInvocation: () => dateStr, cancel: jest.fn(), category: 'maintenance'
            }));
            await service.initScheduler();
            expect(service.getJobs().maintenance[0].nextInvocation).toBe(new Date(dateStr).toISOString());
        });

        it('should skip year boundary check if far from end of year', async () => {
            // Mock now as June
            const june = DateTime.fromObject({ year: 2025, month: 6, day: 1 });
            const nowSpy = jest.spyOn(DateTime, 'now').mockReturnValue(june);
            
            await service.initScheduler();
            const boundaryJobCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 4 * * *');
            await boundaryJobCall[1]();
            
            expect(prayerTimeService.getPrayerTimes).toHaveBeenCalledTimes(1); // Only initial call
            nowSpy.mockRestore();
        });

        it('should skip year boundary check if next year already cached', async () => {
             // Mock dec 28
             const dec28 = DateTime.fromObject({ year: 2025, month: 12, day: 28 });
             const nowSpy = jest.spyOn(DateTime, 'now').mockReturnValue(dec28);
             
             const nextYearKey = '2026-01-01';
             prayerTimeService.readCache.mockReturnValue({
                 data: { [nextYearKey]: {} }
             });

             await service.initScheduler();
             const boundaryJobCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 4 * * *');
             await boundaryJobCall[1]();
             
             expect(prayerTimeService.getPrayerTimes).toHaveBeenCalledTimes(1); // Only initial call
             nowSpy.mockRestore();
        });

        it('should handle missing iqamah or preIqamah triggers', async () => {
             const config = JSON.parse(JSON.stringify(mockConfig));
             config.automation.triggers.fajr = {
                 adhan: { enabled: true },
                 iqamah: { enabled: false }, 
                 preIqamah: { enabled: true } 
             };
             configService.get.mockReturnValue(config);
             
             await service.initScheduler();
             const list = service.getJobs().automation;
             expect(list.some(j => j.name === 'fajr - iqamah')).toBeFalsy();
             expect(list.some(j => j.name === 'fajr - preIqamah')).toBeTruthy();
        });

        it('should handle global automation switch in scheduleEvent', async () => {
             const config = JSON.parse(JSON.stringify(mockConfig));
             config.automation.global.enabled = false;
             configService.get.mockReturnValue(config);
             
             await service.initScheduler();
             expect(service.getJobs().automation.length).toBe(0);
        });

        it('should handle individual event switches in scheduleEvent', async () => {
             const config = JSON.parse(JSON.stringify(mockConfig));
             config.automation.global.adhanEnabled = false;
             configService.get.mockReturnValue(config);
             
             await service.initScheduler();
             const list = service.getJobs().automation;
             expect(list.some(j => j.name.includes('adhan'))).toBeFalsy();
        });

        it('should handle scheduleJob returning null', async () => {
             schedule.scheduleJob.mockReturnValue(null);
             await service.initScheduler();
             const list = service.getJobs();
             expect(list.automation.length).toBe(0);
             expect(list.maintenance.length).toBe(0);
        });

        it('should handle conversion errors in formatJob', async () => {
             schedule.scheduleJob.mockImplementation((name, cb) => ({
                 jobName: 'error-test',
                 category: 'automation',
                 nextInvocation: () => ({ 
                     valueOf: () => { throw new Error('Inner'); }
                 }),
                 cancel: jest.fn()
             }));
             await service.initScheduler();
             const list = service.getJobs();
             // It will log error and nextInvocation will be null or whatever Date(err) returns
             expect(list.automation[0]).toBeDefined();
        });
    });

    describe('initScheduler edge cases', () => {
        it('should handle failure in getPrayerTimes', async () => {
             prayerTimeService.getPrayerTimes.mockRejectedValue(new Error('Fetch Failed'));
             await service.initScheduler();
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Initialisation failed'), expect.anything());
        });

        it('should handle missing prayer data', async () => {
            prayerTimeService.getPrayerTimes.mockResolvedValue(null);
            await service.initScheduler();
            expect(schedule.scheduleJob).toHaveBeenCalled(); // Only maintenance jobs
            const list = service.getJobs();
            expect(list.automation.length).toBe(0);
        });

        it('should handle missing triggers in config', async () => {
             const config = configService.get();
             const originalTriggers = config.automation.triggers;
             config.automation.triggers = null;
             
             await service.initScheduler();
             // Should return early after maintenance jobs
             expect(schedule.scheduleJob).toHaveBeenCalledTimes(6); 
             
             config.automation.triggers = originalTriggers;
        });

        it('should skip prayer if triggers for it are missing', async () => {
             const config = configService.get();
             delete config.automation.triggers.fajr;
             
             await service.initScheduler();
             expect(schedule.scheduleJob).toHaveBeenCalled();
             
             config.automation.triggers.fajr = { adhan: { enabled: true } };
        });

        it('should skip prayer if no time found', async () => {
             prayerTimeService.getPrayerTimes.mockResolvedValueOnce({
                 prayers: {
                     fajr: null,
                     sunrise: '2099-01-01T06:00:00Z'
                 }
             });
             await service.initScheduler();
             expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No time found for fajr, skipping.'));
        });

        it('should skip events if disabled', async () => {
             // Use a fresh config object to avoid side effects
             const config = JSON.parse(JSON.stringify(mockConfig));
             config.automation.triggers.fajr = {
                 adhan: { enabled: false },
                 preAdhan: { enabled: true, offsetMinutes: 5 }
             };
             configService.get.mockReturnValue(config);
            
             await service.initScheduler();

             const list = service.getJobs();
             const adhanJob = list.automation.find(j => j.name === 'fajr - adhan');
             const preAdhanJob = list.automation.find(j => j.name === 'fajr - preAdhan');
             
             expect(adhanJob).toBeUndefined();
             expect(preAdhanJob).toBeDefined();
        });

        it('should handle missing iqamah object in prayer data', async () => {
            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { fajr: '2099-01-01T05:00:00Z' } // No iqamah property
            });
            await service.initScheduler();
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Initialisation complete'));
        });

        it('should handle iqamah from source data', async () => {
            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: {
                    fajr: '2099-01-01T05:00:00Z',
                    iqamah: { fajr: '2099-01-01T05:30:00Z' }
                }
            });
            const configWithIqamah = JSON.parse(JSON.stringify(mockConfig));
            configWithIqamah.automation.triggers.fajr.iqamah = { enabled: true };
            configService.get.mockReturnValue(configWithIqamah);
            
            await service.initScheduler();
            const iqamahJob = schedule.scheduleJob.mock.calls.find(c => c[0] instanceof Date && c[0].toISOString() === '2099-01-01T05:30:00.000Z');
            expect(iqamahJob).toBeDefined();
        });

        it('should handle iqamah override from config', async () => {
             prayerTimeService.getPrayerTimes.mockResolvedValue({
                 prayers: {
                     fajr: '2099-01-01T05:00:00Z',
                     iqamah: { fajr: '2099-01-01T05:30:00Z' }
                 }
             });
             const configWithOverride = JSON.parse(JSON.stringify(mockConfig));
             configWithOverride.prayers.fajr.iqamahOverride = true;
             configWithOverride.prayers.fajr.iqamahOffset = 15;
             configWithOverride.automation.triggers.fajr.iqamah = { enabled: true };
             configService.get.mockReturnValue(configWithOverride);
             
             await service.initScheduler();
             // 05:00 + 15 = 05:15
             const iqamahJob = schedule.scheduleJob.mock.calls.find(c => c[0] instanceof Date && c[0].toISOString() === '2099-01-01T05:15:00.000Z');
             expect(iqamahJob).toBeDefined();
        });

        it('should handle sunrise without iqamah', async () => {
            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { sunrise: '2099-01-01T06:00:00Z' }
            });
            const configWithSunrise = JSON.parse(JSON.stringify(mockConfig));
            configWithSunrise.automation.triggers.sunrise = { adhan: { enabled: true } };
            configService.get.mockReturnValue(configWithSunrise);
            
            await service.initScheduler();
            const job = schedule.scheduleJob.mock.calls.find(c => c[0] instanceof Date && c[0].toISOString() === '2099-01-01T06:00:00.000Z');
            expect(job).toBeDefined();
        });
    });
});
