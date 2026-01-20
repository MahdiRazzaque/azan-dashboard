describe('Request Queues (Bottleneck)', () => {
    let queues;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.isolateModules(() => {
            queues = require('@utils/requestQueue');
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate);

    it('Aladhan Queue should allow burst of 10 then 5 req/s', async () => {
        const { aladhanQueue } = queues;
        const spy = jest.fn().mockResolvedValue('ok');
        
        // Schedule 15 requests
        for (let i = 0; i < 15; i++) {
            aladhanQueue.schedule(spy);
        }
        
        // Initial burst of 10
        await jest.advanceTimersByTimeAsync(100);
        await flushPromises();
        expect(spy).toHaveBeenCalledTimes(10); 
        
        // After 1s, we get 5 more
        await jest.advanceTimersByTimeAsync(1000); // 1100ms
        await flushPromises();
        expect(spy).toHaveBeenCalledTimes(15); 
    });

    it('MyMasjid Queue should allow burst of 15 then 10 req/6s', async () => {
        const { myMasjidQueue } = queues;
        const spy = jest.fn().mockResolvedValue('ok');
        
        // Schedule 20 requests
        for (let i = 0; i < 20; i++) {
            myMasjidQueue.schedule(spy);
        }
        
        // Burst of 15
        await jest.advanceTimersByTimeAsync(100);
        await flushPromises();
        expect(spy).toHaveBeenCalledTimes(15); 
        
        // Next 5 come after 6 seconds (10 tokens refill)
        await jest.advanceTimersByTimeAsync(6000); 
        await flushPromises();
        expect(spy).toHaveBeenCalledTimes(20); 
    });

    it('VoiceMonkey Queue should allow burst of 5 then 10 req/min', async () => {
        const { voiceMonkeyQueue } = queues;
        const spy = jest.fn().mockResolvedValue('ok');
        
        // Schedule 10 requests
        for (let i = 0; i < 10; i++) {
            voiceMonkeyQueue.schedule(spy);
        }
        
        // Burst of 5
        await jest.advanceTimersByTimeAsync(100); 
        await flushPromises();
        expect(spy).toHaveBeenCalledTimes(5); 
        
        // Next 5 come after 60 seconds (10 tokens refill)
        await jest.advanceTimersByTimeAsync(60000); 
        await flushPromises();
        expect(spy).toHaveBeenCalledTimes(10); 
    });

    it('should log warning when Aladhan job fails', async () => {
        const { aladhanQueue } = queues;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const testError = new Error('Aladhan Test Error');

        const failureEvent = new Promise(resolve => {
            aladhanQueue.once('failed', () => resolve());
        });

        aladhanQueue.schedule(async () => {
            throw testError;
        }).catch(() => {});

        // Advance timers just enough to let the scheduler run
        await jest.advanceTimersByTimeAsync(100);
        await failureEvent;

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Queue:Aladhan]')
        );
        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('Aladhan Test Error')
        );

        consoleSpy.mockRestore();
    });

    it('should log warning when MyMasjid job fails', async () => {
        const { myMasjidQueue } = queues;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const testError = new Error('MyMasjid Test Error');

        const failureEvent = new Promise(resolve => {
            myMasjidQueue.once('failed', () => resolve());
        });

        myMasjidQueue.schedule(async () => {
            throw testError;
        }).catch(() => {});

        await jest.advanceTimersByTimeAsync(100);
        await failureEvent;

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Queue:MyMasjid]')
        );

        consoleSpy.mockRestore();
    });

    it('should log warning when VoiceMonkey job fails', async () => {
        const { voiceMonkeyQueue } = queues;
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const testError = new Error('VM Test Error');

        const failureEvent = new Promise(resolve => {
            voiceMonkeyQueue.once('failed', () => resolve());
        });

        voiceMonkeyQueue.schedule(async () => {
            throw testError;
        }).catch(() => {});

        await jest.advanceTimersByTimeAsync(100);
        await failureEvent;

        expect(consoleSpy).toHaveBeenCalledWith(
            expect.stringContaining('[Queue:VoiceMonkey]')
        );

        consoleSpy.mockRestore();
    });
});
