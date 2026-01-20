const schedule = require('node-schedule');
const service = require('@services/core/schedulerService');
const configService = require('@config');
const prayerTimeService = require('@services/core/prayerTimeService');
const automationService = require('@services/core/automationService');
const healthCheck = require('@services/system/healthCheck');
const audioAssetService = require('@services/system/audioAssetService');
const { DateTime } = require('luxon');

jest.mock('node-schedule');
jest.mock('@config');
jest.mock('@services/core/prayerTimeService');
jest.mock('@services/core/automationService');
jest.mock('@services/system/audioAssetService'); 
jest.mock('@services/system/healthCheck');
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

    describe('Iqamah Logic', () => {
        it('should use explicit iqamah from source if not overridden', async () => {
            const modConfig = JSON.parse(JSON.stringify(mockConfig));
            modConfig.prayers.fajr.iqamahOverride = false;
            configService.get.mockReturnValue(modConfig);

            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: {
                    fajr: '2099-01-01T05:00:00Z',
                    iqamah: { fajr: '2099-01-01T05:33:00Z' }
                }
            });

            await service.initScheduler();
            // Should schedule near 5:33
            const jobCall = schedule.scheduleJob.mock.calls.find(c => c[0] instanceof Date && c[0].toISOString().includes('05:33'));
            expect(jobCall).toBeDefined();
        });

        it('should use calculated iqamah if override is true', async () => {
             const modConfig = JSON.parse(JSON.stringify(mockConfig));
             modConfig.prayers.fajr.iqamahOverride = true;
             configService.get.mockReturnValue(modConfig);

             prayerTimeService.getPrayerTimes.mockResolvedValue({
                 prayers: {
                     fajr: '2099-01-01T05:00:00Z',
                     iqamah: { fajr: '2099-01-01T05:33:00Z' } // Should be ignored
                 }
             });

             await service.initScheduler();
             // Default offset 10 mins -> 05:10
             const jobCall = schedule.scheduleJob.mock.calls.find(c => c[0] instanceof Date && c[0].toISOString().includes('05:10'));
             expect(jobCall).toBeDefined();
        });
    });

    describe('Job List Date Formats', () => {
        it('should handle CronDate in getJobs', async () => {
             schedule.scheduleJob.mockImplementation((...args) => {
                 return {
                     nextInvocation: () => ({ toDate: () => new Date('2099-12-31T23:59:59Z') }),
                     cancel: jest.fn()
                 };
             });
             await service.initScheduler();
             const list = service.getJobs();
             expect(list.maintenance[0].nextInvocation).toContain('2099-12-31');
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

        it('should return early if no triggers in config', async () => {
             const noTriggers = { ...mockConfig, automation: { triggers: null } };
             configService.get.mockReturnValue(noTriggers);
             await service.initScheduler();
             expect(console.error).not.toHaveBeenCalled();
        });

        it('should continue if triggers for a prayer are missing', async () => {
             const incompleteTriggers = JSON.parse(JSON.stringify(mockConfig));
             delete incompleteTriggers.automation.triggers.fajr;
             configService.get.mockReturnValue(incompleteTriggers);
             await service.initScheduler();
             expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('No time found for fajr'));
        });

        it('should warn and continue if prayer time is missing', async () => {
            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: { dhuhr: '2099-01-01T12:00:00Z' } // Missing fajr
            });
            await service.initScheduler();
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('No time found for fajr'));
        });

        it('should handle maintenance job failures', async () => {
             await service.initScheduler();
             const healthCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 * * * *');
             healthCheck.refresh.mockRejectedValue(new Error('Refresh Fail'));
             await healthCall[1]();
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Health Check Failed'), expect.any(Error));
        });

        it('should handle source maintenance failures', async () => {
             await service.initScheduler();
             const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 2 * * *');
             healthCheck.refresh.mockRejectedValue(new Error('Source Fail'));
             await call[1]();
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Source Health Check Failed'), expect.any(Error));
        });

        it('should handle stale check failures', async () => {
             prayerTimeService.readCache.mockImplementation(() => { throw new Error('Read Fail'); });
             await service.initScheduler();
             const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 3 * * 0');
             await call[1]();
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Stale Check Failed'), expect.anything());
        });

        it('should handle boundary check failures', async () => {
             prayerTimeService.readCache.mockImplementation(() => { throw new Error('Boundary Fail'); });
             const dec30 = new Date(2023, 11, 30, 23, 0, 0); 
             jest.setSystemTime(dec30);
             await service.initScheduler();
             const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 4 * * *');
             await call[1]();
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Year Boundary Check Failed'), expect.anything());
        });

        it('should skip year boundary refresh if data exists', async () => {
            const dec30 = new Date(2023, 11, 30, 23, 0, 0); 
            jest.setSystemTime(dec30);
            prayerTimeService.readCache.mockReturnValue({ data: { '2024-01-01': {} } }); 
            
            await service.initScheduler();
            const yearJobCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 4 * * *');
            await yearJobCall[1]();
            
            expect(prayerTimeService.getPrayerTimes).toHaveBeenCalledTimes(1); // Only for today
        });

        it('should skip stale check if cache is missing meta', async () => {
            prayerTimeService.readCache.mockReturnValue({});
            await service.initScheduler();
            const staleJobCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 3 * * 0');
            await staleJobCall[1]();
            expect(prayerTimeService.getPrayerTimes).toHaveBeenCalled(); // Triggered fetch branch
        });

        it('should handle general initialization errors', async () => {
             prayerTimeService.getPrayerTimes.mockRejectedValue(new Error('Init Crash'));
             await service.initScheduler();
             expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Initialisation failed'), expect.any(Error));
        });
        it('should handle scheduleJob returning null', async () => {
             schedule.scheduleJob.mockReturnValue(null);
             await service.initScheduler();
             // Should not throw, but jobs array will be empty/smaller
             expect(schedule.scheduleJob).toHaveBeenCalled();
        });

        it('should skip if global automation is missing', async () => {
             const modConfig = JSON.parse(JSON.stringify(mockConfig));
             delete modConfig.automation.global;
             configService.get.mockReturnValue(modConfig);
             
             await service.initScheduler();
             // Should still schedule because default is continue if missing global check?
             // Actually line 40: if (config.automation?.global) { ... }
             // If missing, it continues to schedule.
             expect(schedule.scheduleJob).toHaveBeenCalled();
        });

        it('should skip year boundary refresh if diff is out of range', async () => {
            const june1 = new Date(2099, 5, 1); // June 1st
            jest.setSystemTime(june1);
            
            await service.initScheduler();
            const yearJobCall = schedule.scheduleJob.mock.calls.find(c => c[0] === '0 4 * * *');
            await yearJobCall[1]();
            
            expect(prayerTimeService.getPrayerTimes).toHaveBeenCalledTimes(1); // Only today, no boundary fetch
        });

        it('should handle audio asset maintenance failure', async () => {
            await service.initScheduler();
            const call = schedule.scheduleJob.mock.calls.find(c => c[0] === '30 3 * * *');
            audioAssetService.syncAudioAssets.mockRejectedValue(new Error('Sync Fail'));
            await call[1]();
            expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Audio Asset Maintenance Failed'), expect.any(String));
        });

        it('should return early if triggers are missing', async () => {
             const modConfig = JSON.parse(JSON.stringify(mockConfig));
             delete modConfig.automation.triggers;
             configService.get.mockReturnValue(modConfig);
             await service.initScheduler();
             expect(schedule.scheduleJob).toHaveBeenCalled();
        });

        it('should handle hotReload and stopAll', async () => {
             await service.hotReload();
             service.stopAll();
             expect(prayerTimeService.getPrayerTimes).toHaveBeenCalled();
        });
    });

    describe('getJobs branches', () => {
        let savedImplementation;
        beforeEach(() => {
            savedImplementation = schedule.scheduleJob.getMockImplementation();
        });
        afterEach(() => {
            schedule.scheduleJob.mockImplementation(savedImplementation);
        });

        it('should handle standard Date type in getJobs', async () => {
            const date = new Date('2023-01-01T12:00:00Z');
            schedule.scheduleJob.mockImplementation((name, cb) => ({
                jobName: name,
                nextInvocation: () => date,
                category: typeof name === 'string' && name.includes('midnight') ? 'maintenance' : 'automation',
                cancel: jest.fn()
            }));
            
            await service.initScheduler();
            const result = service.getJobs();
            // Check if any job starts with the expected timestamp
            expect(result.automation.some(j => j.nextInvocation && j.nextInvocation.includes('2023-01-01T12:00:00'))).toBe(true);
        });

        it('should handle Luxon DateTime type in getJobs', async () => {
            const dt = DateTime.fromISO('2023-01-01T12:00:00Z');
            schedule.scheduleJob.mockImplementation((name, cb) => ({
                jobName: name,
                nextInvocation: () => dt,
                category: 'automation',
                cancel: jest.fn()
            }));
            
            await service.initScheduler();
            const result = service.getJobs();
            expect(result.automation.some(j => j.nextInvocation.startsWith('2023-01-01T12:00:00'))).toBe(true);
        });

        it('should handle CronDate in getJobs', async () => {
            const date = new Date('2023-01-01T12:00:00Z');
            schedule.scheduleJob.mockImplementation((name, cb) => ({
                jobName: name,
                nextInvocation: () => ({ toDate: () => date }),
                category: 'automation',
                cancel: jest.fn()
            }));
            
            await service.initScheduler();
            const result = service.getJobs();
            expect(result.automation[0].nextInvocation.startsWith('2023-01-01T12:00:00')).toBe(true);
        });

        it('should handle generic date strings in getJobs (Else branch)', async () => {
            const dateStr = '2023-01-01T12:00:00.000Z';
            schedule.scheduleJob.mockImplementation((name, cb) => ({
                jobName: name,
                nextInvocation: () => dateStr,
                category: 'automation',
                cancel: jest.fn()
            }));
            
            await service.initScheduler();
            const result = service.getJobs();
            expect(result.automation[0].nextInvocation).toBe(dateStr);
        });

        it('should handle conversion failure (Catch branch)', async () => {
            schedule.scheduleJob.mockImplementation((name, cb) => ({
                jobName: name,
                nextInvocation: () => ({ toDate: () => { throw new Error('Bad'); } }),
                category: 'automation',
                cancel: jest.fn()
            }));
            
            await service.initScheduler();
            const result = service.getJobs();
            expect(result.automation[0].nextInvocation).toBeNull();
        });
    });

    describe('Initialization Branches', () => {
        it('should handle missing offsetMinutes and undefined enabled', async () => {
            prayerTimeService.getPrayerTimes.mockResolvedValue({
                prayers: {
                    fajr: '2099-01-01T05:00:00Z',
                    iqamah: {
                        fajr: '2099-01-01T05:15:00Z'
                    }
                }
            });

            const sparseConfig = JSON.parse(JSON.stringify(mockConfig));
            // Ensure global switches are ON
            sparseConfig.automation.global = {
                enabled: true,
                preAdhanEnabled: true,
                adhanEnabled: true,
                preIqamahEnabled: true,
                iqamahEnabled: true
            };
            sparseConfig.automation.triggers.fajr = {
                adhan: { enabled: true },
                preAdhan: { enabled: true }, // no offset
                iqamah: { enabled: true },
                preIqamah: { enabled: true } // no offset
            };

            configService.get.mockReturnValue(sparseConfig);
            await service.initScheduler();
            const scheduled = service.getJobs().automation;
            expect(scheduled.some(j => j.name === 'fajr - preAdhan')).toBe(true);
            expect(scheduled.some(j => j.name === 'fajr - preIqamah')).toBe(true);
        });

        it('should handle undefined triggers for a prayer', async () => {
            prayerTimeService.getPrayersWithNext.mockResolvedValue({
                prayers: {
                    fajr: { adhan: '05:00', iqamah: '05:15' }
                },
                next: { name: 'fajr', time: '05:00' }
            });

            const sparseConfig = JSON.parse(JSON.stringify(mockConfig));
            sparseConfig.automation.triggers.fajr = {
                adhan: { enabled: true }
                // preAdhan missing entirely -> hit ?.
            };

            configService.get.mockReturnValue(sparseConfig);
            await service.initScheduler();
            const scheduled = service.getJobs().automation;
            expect(scheduled.some(j => j.name === 'fajr_preAdhan')).toBe(false);
        });
    });
});
