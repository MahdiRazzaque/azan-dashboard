const schedule = require('node-schedule');
const service = require('../../../src/services/schedulerService');
const configService = require('../../../src/config');
const prayerTimeService = require('../../../src/services/prayerTimeService');
const automationService = require('../../../src/services/automationService');
const healthCheck = require('../../../src/services/healthCheck');
const audioAssetService = require('../../../src/services/audioAssetService');
const { DateTime } = require('luxon');

jest.mock('node-schedule');
jest.mock('../../../src/config');
jest.mock('../../../src/services/prayerTimeService');
jest.mock('../../../src/services/automationService');
jest.mock('../../../src/services/audioAssetService'); 
jest.mock('../../../src/services/healthCheck');
describe('SchedulerService', () => {
    const mockConfig = {
        location: { timezone: 'UTC', coordinates: { lat: 0, long: 0 } },
        prayers: {
            fajr: { iqamah: { type: 'offset', minutes: 10 } },
            dhuhr: {}, asr: {}, maghrib: {}, isha: {}
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
        configService.get.mockReturnValue(mockConfig);
        
        // Robust Mock for 2-arg usage (Rule/Date, Callback)
        schedule.scheduleJob.mockImplementation((...args) => {
            const callback = args[1];
            return { 
                name: 'test-job',
                jobName: 'test-job', 
                cancel: jest.fn(), 
                nextInvocation: () => new Date(),
                invoke: callback 
            };
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
        
        // Midnight refresh uses Cron String
        const jobCall = schedule.scheduleJob.mock.calls.find(c => typeof c[0] === 'string' && c[0].includes('0 0'));
        expect(jobCall).toBeDefined();
        
        // Callback is Arg 1
        const callback = jobCall[1];
        await callback();
        // Midnight refresh calls initScheduler, which calls getPrayerTimes
        expect(prayerTimeService.getPrayerTimes).toHaveBeenCalledTimes(2);
    });

    it('should schedule and execute prayer triggered events', async () => {
        await service.initScheduler();
        
        // Find a Date-based job call
        const jobCall = schedule.scheduleJob.mock.calls.find(c => typeof c[0] === 'object');
        expect(jobCall).toBeDefined();
        
        // Callback is Arg 1
        const callback = jobCall[1];
        await callback();
        
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

    it('should skip events in the past', async () => {
         prayerTimeService.getPrayerTimes.mockResolvedValue({
             prayers: { fajr: '1999-01-01T05:00:00Z', iqamah: {} }
         });
         
         await service.initScheduler();
         // Any date-based job should be absent because it's past
         const jobCall = schedule.scheduleJob.mock.calls.find(c => typeof c[0] === 'object');
         expect(jobCall).toBeUndefined();
    });

    it('should hot reload by cancelling old jobs', async () => {
         await service.initScheduler();
         const initialJobs = schedule.scheduleJob.mock.results.map(r => r.value);
         expect(initialJobs.length).toBeGreaterThan(0);
         
         await service.hotReload();
         
         initialJobs.forEach(job => {
             expect(job.cancel).toHaveBeenCalled();
         });
    });

    it('should get jobs list', async () => {
        await service.initScheduler();
        const jobs = service.getJobs();
        expect(jobs).toBeDefined();
        expect(jobs.maintenance).toBeInstanceOf(Array);
        expect(jobs.automation).toBeInstanceOf(Array);
    });

    describe('getJobs Edge Cases', () => {
        it('should handle error if nextInvocation throws', async () => {
            // Mock scheduleJob to return a job where nextInvocation throws
            // We use mockImplementation to ensure it stays for all calls during this test
            schedule.scheduleJob.mockImplementation((...args) => {
                return {
                    nextInvocation: () => { throw new Error('Boom'); },
                    cancel: jest.fn()
                };
            });
            await service.initScheduler();
            const jobs = service.getJobs();
            expect(jobs.maintenance.length).toBeGreaterThan(0);
            expect(jobs.maintenance[0].nextInvocation).toBeNull();
        });

        it('should handle standard Date type in getJobs', async () => {
            schedule.scheduleJob.mockImplementation((...args) => {
                return {
                    nextInvocation: () => new Date('2099-01-01T01:00:00Z'),
                    cancel: jest.fn()
                };
            });

            await service.initScheduler();
            const jobsList = service.getJobs();
            expect(jobsList.maintenance[0].nextInvocation).toContain('2099-01-01');
        });

        it('should handle Luxon DateTime type in getJobs', async () => {
            schedule.scheduleJob.mockImplementation((...args) => {
                return {
                    nextInvocation: () => DateTime.fromISO('2099-01-01T02:00:00Z'),
                    cancel: jest.fn()
                };
            });

            await service.initScheduler();
            const jobsList = service.getJobs();
            expect(jobsList.maintenance[0].nextInvocation).toContain('2099-01-01T02');
        });

        it('should handle conversion failure', async () => {
            schedule.scheduleJob.mockImplementation((...args) => {
                return {
                    nextInvocation: () => ({ toISO: () => { throw new Error('ISO Fail'); } }),
                    cancel: jest.fn()
                };
            });
            await service.initScheduler();
            const jobsList = service.getJobs();
            expect(jobsList.maintenance[0].nextInvocation).toBeNull();
        });

        it('should handle generic date strings in getJobs', async () => {
            schedule.scheduleJob.mockImplementation((...args) => {
                return {
                    nextInvocation: () => '2099-01-01T05:00:00Z',
                    cancel: jest.fn()
                };
            });

            await service.initScheduler();
            const jobsList = service.getJobs();
            expect(jobsList.maintenance[0].nextInvocation).toBeDefined();
            expect(jobsList.maintenance[0].nextInvocation).toContain('2099-01-01');
        });
    });

    it('should initialize successfully without internal errors', async () => {
         const errorSpy = jest.spyOn(console, 'error');
         await service.initScheduler();
         expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining('[Scheduler] Initialisation failed'), expect.anything());
    });

    describe('Maintenance Jobs', () => {
        beforeAll(() => {
            jest.useFakeTimers();
        });
        afterAll(() => {
            jest.useRealTimers();
        });

        it('should run stale check and refresh if stale', async () => {
             prayerTimeService.readCache.mockReturnValue({
                 meta: { lastFetched: '2000-01-01T00:00:00Z' } 
             });
             
             await service.initScheduler();
             
             const staleJobCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 3 * * 0');
             const callback = staleJobCall[1];
             await callback(); // Trigger Stale Check
             
             expect(prayerTimeService.forceRefresh).toHaveBeenCalled();
        });
        
        it('should run stale check and NOT refresh if fresh', async () => {
             const recently = DateTime.now().minus({ days: 1 }).toISO();
             prayerTimeService.readCache.mockReturnValue({
                 meta: { lastFetched: recently } 
             });
             
             await service.initScheduler();
             
             const staleJobCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 3 * * 0');
             const callback = staleJobCall[1];
             await callback(); 
             
             expect(prayerTimeService.forceRefresh).not.toHaveBeenCalled();
        });

        it('should run hourly health check', async () => {
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 * * * *');
            const callback = call[1];
            await callback();
            expect(healthCheck.refresh).toHaveBeenCalled();
        });

        it('should run audio asset maintenance', async () => {
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '30 3 * * *');
            const callback = call[1];
            await callback();
            expect(audioAssetService.syncAudioAssets).toHaveBeenCalledWith(false);
        });

        it('should run source health check', async () => {
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 2 * * *');
            const callback = call[1];
            await callback();
            expect(healthCheck.refresh).toHaveBeenCalledWith('primarySource', 'silent');
        });

        it('should check year boundary', async () => {
            const dec30 = new Date(2023, 11, 30, 23, 0, 0); 
            jest.setSystemTime(dec30);
            
            prayerTimeService.readCache.mockReturnValue({ data: {} }); 
            
            await service.initScheduler();
            const yearJobCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 4 * * *');
            const callback = yearJobCall[1];
            await callback();
            
            // Should call getPrayerTimes with next year date
            expect(prayerTimeService.getPrayerTimes).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ year: 2024, month: 1, day: 1 }));
        });
    });

    describe('Global Switches Granularity', () => {
        it('should skip specific events if disabled', async () => {
            const modConfig = JSON.parse(JSON.stringify(mockConfig));
            modConfig.automation.global.preAdhanEnabled = false;
            configService.get.mockReturnValue(modConfig);
            
            await service.initScheduler();
            expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Skipped fajr preAdhan'));
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle missing prayer data gracefully', async () => {
            prayerTimeService.getPrayerTimes.mockResolvedValue(null);
            await service.initScheduler();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch prayer times'));
        });
        
        it('should handle missing next invocation date in getJobs', async () => {
            schedule.scheduleJob.mockReturnValueOnce({
                name: 'broken-job',
                jobName: 'broken-job',
                category: 'automation',
                cancel: jest.fn(),
                nextInvocation: () => { throw new Error("Boom"); }
            });
            service.initScheduler();
            
            const jobs = service.getJobs();
            // Should log error but not crash
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error calculating next invocation'), expect.anything());
        });
    });
});
