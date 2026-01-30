const service = require('@services/core/automationService');
const configService = require('@config');
const sseService = require('@services/system/sseService');
const audioAssetService = require('@services/system/audioAssetService');
const OutputFactory = require('../../../src/outputs/OutputFactory');

jest.mock('@config');
jest.mock('@services/system/sseService');
jest.mock('@services/system/audioAssetService');
jest.mock('../../../src/outputs/OutputFactory');
jest.mock('fs');

describe('AutomationService', () => {
    let mockStrategy;

    beforeEach(() => {
        jest.clearAllMocks();

        audioAssetService.ensureTTSFile.mockResolvedValue({ success: true });
        
        mockStrategy = {
            execute: jest.fn().mockResolvedValue(),
            constructor: {
                getMetadata: jest.fn().mockReturnValue({ timeoutMs: 1000 })
            },
            // Fallback for direct calls if any logic uses instance methods
            getMetadata: jest.fn().mockReturnValue({ timeoutMs: 1000 }),
            healthCheck: jest.fn().mockResolvedValue({ healthy: true })
        };
        
        // Consolidate mock implementation to be consistent across all tests
        OutputFactory.getStrategy.mockImplementation((id) => {
            if (id === 'browser') {
                return {
                    execute: jest.fn().mockResolvedValue(),
                    constructor: { getMetadata: () => ({ timeoutMs: 5000 }) },
                    healthCheck: jest.fn().mockResolvedValue({ healthy: true })
                };
            }
            // Return mockStrategy for mockTarget or any other
            return mockStrategy;
        });
        
        configService.get.mockReturnValue({
            automation: {
                outputs: {
                    mockTarget: { enabled: true },
                    browser: { enabled: true }
                },
                triggers: {
                    fajr: {
                        preAdhan: {
                            enabled: true,
                            type: 'tts',
                            targets: ['mockTarget'],
                            // source related
                            template: 'template' 
                        }
                    }
                }
            }
        });
    });

    describe('triggerEvent', () => {
        it('should broadcast LOG event', async () => {
            await service.triggerEvent('fajr', 'preAdhan');
            expect(sseService.broadcast).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'LOG' })
            );
        });

        it('should execute configured targets using OutputFactory', async () => {
            await service.triggerEvent('fajr', 'preAdhan');
            
            expect(OutputFactory.getStrategy).toHaveBeenCalledWith('mockTarget');
            expect(mockStrategy.execute).toHaveBeenCalled();
        });

        it('should implicitly execute browser strategy', async () => {
             await service.triggerEvent('fajr', 'preAdhan');
             
             expect(OutputFactory.getStrategy).toHaveBeenCalledWith('browser');
        });

        it('should resolve audio source and pass to strategy', async () => {
            await service.triggerEvent('fajr', 'preAdhan');
            
            const expectedPayload = expect.objectContaining({
                source: expect.objectContaining({ url: expect.stringContaining('tts_fajr_preAdhan.mp3') }),
                prayer: 'fajr',
                event: 'preAdhan'
            });
            
            expect(mockStrategy.execute).toHaveBeenCalledWith(expectedPayload, expect.anything(), expect.anything());
        });

        it('should handle execution errors gracefully', async () => {
            mockStrategy.execute.mockRejectedValue(new Error('Exec Fail'));
            await service.triggerEvent('fajr', 'preAdhan');
            // Should not throw, just log
        });

        it('should enforce timeout on strategy execution and pass AbortSignal', async () => {
             // Mock strategy that hangs but respects signal
             const mockHangingExecute = jest.fn().mockImplementation((payload, meta, signal) => {
                 return new Promise((resolve, reject) => {
                     const timer = setTimeout(resolve, 5000);
                     signal.addEventListener('abort', () => {
                         clearTimeout(timer);
                         reject(new Error('Aborted'));
                     });
                 });
             });

             // Force mockTarget to hang
             OutputFactory.getStrategy.mockImplementation((id) => {
                 if (id === 'mockTarget') {
                     return {
                         execute: mockHangingExecute,
                         constructor: { getMetadata: () => ({ timeoutMs: 10 }) },
                         healthCheck: jest.fn().mockResolvedValue({ healthy: true })
                     };
                 }
                 // Return standard non-hanging mock for others (e.g. browser)
                 return {
                     execute: jest.fn().mockResolvedValue(),
                     constructor: { getMetadata: () => ({ timeoutMs: 5000 }) },
                     healthCheck: jest.fn().mockResolvedValue({ healthy: true })
                 };
             });
             
             const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
             
             jest.useFakeTimers();
             
             // We don't await here because it will hang until timers are advanced
             const triggerPromise = service.triggerEvent('fajr', 'preAdhan');
             
             // Advance timers to trigger the withTimeout timeout
             // We need to advance enough to cover waitDelay (0 here) + timeoutMs (10)
             await jest.advanceTimersByTimeAsync(100);
             
             await triggerPromise; 
             
             expect(consoleSpy).toHaveBeenCalledWith(
                 expect.stringContaining(`Error executing target 'mockTarget'`),
                 expect.stringContaining('Aborted')
             );
             
             consoleSpy.mockRestore();
             jest.useRealTimers();
        });
        
        it('should skip if trigger disabled', async () => {
            configService.get.mockReturnValue({
                automation: {
                    triggers: {
                        fajr: { preAdhan: { enabled: false } }
                    }
                }
            });
            
            await service.triggerEvent('fajr', 'preAdhan');
            expect(OutputFactory.getStrategy).not.toHaveBeenCalled();
        });

        it('should implement staggered launch using wait delays', async () => {
            jest.useFakeTimers();
            
            // Strategy A (mockTarget): lead 0ms
            // Strategy B (secondTarget): lead 2000ms
            // Master Lead Time: 2000ms
            // Wait Delay for A: 2000 - 0 = 2000ms
            // Wait Delay for B: 2000 - 2000 = 0ms
            
            const strategyA = {
                execute: jest.fn().mockResolvedValue(),
                constructor: { getMetadata: () => ({ timeoutMs: 5000 }) },
                healthCheck: jest.fn().mockResolvedValue({ healthy: true })
            };
            const strategyB = {
                execute: jest.fn().mockResolvedValue(),
                constructor: { getMetadata: () => ({ timeoutMs: 5000 }) },
                healthCheck: jest.fn().mockResolvedValue({ healthy: true })
            };
            const strategyBrowser = {
                execute: jest.fn().mockResolvedValue(),
                constructor: { getMetadata: () => ({ timeoutMs: 5000 }) },
                healthCheck: jest.fn().mockResolvedValue({ healthy: true })
            };

            OutputFactory.getStrategy.mockImplementation((id) => {
                if (id === 'mockTarget') return strategyA;
                if (id === 'secondTarget') return strategyB;
                if (id === 'browser') return strategyBrowser;
            });

            configService.get.mockReturnValue({
                automation: {
                    outputs: {
                        mockTarget: { enabled: true, leadTimeMs: 0 },
                        secondTarget: { enabled: true, leadTimeMs: 2000 },
                        browser: { enabled: true, leadTimeMs: 0 }
                    },
                    triggers: {
                        fajr: {
                            preAdhan: {
                                enabled: true,
                                type: 'tts',
                                targets: ['mockTarget', 'secondTarget']
                            }
                        }
                    }
                }
            });

            const triggerPromise = service.triggerEvent('fajr', 'preAdhan');

            // Wait for initial microtasks to allow _executeTarget to reach delay()
            await Promise.resolve();
            await Promise.resolve();
            await Promise.resolve();

            // At T=0:
            // strategyB (lead 2000ms) should be called immediately (waitDelay = 0)
            expect(strategyB.execute).toHaveBeenCalled();
            expect(strategyA.execute).not.toHaveBeenCalled();
            expect(strategyBrowser.execute).not.toHaveBeenCalled();

            // Advance by 1000ms
            await jest.advanceTimersByTimeAsync(1000);
            expect(strategyA.execute).not.toHaveBeenCalled();
            expect(strategyBrowser.execute).not.toHaveBeenCalled();

            // Advance by another 1000ms (Total 2000ms)
            await jest.advanceTimersByTimeAsync(1000);
            expect(strategyA.execute).toHaveBeenCalled();
            expect(strategyBrowser.execute).toHaveBeenCalled();

            await triggerPromise;
            jest.useRealTimers();
        });
    });
});