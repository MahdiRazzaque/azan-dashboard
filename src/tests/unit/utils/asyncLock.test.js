const asyncLock = require('@utils/asyncLock');

describe('AsyncLock Util', () => {
    it('should execute function and return result', async () => {
        const fn = jest.fn().mockResolvedValue('result');
        const result = await asyncLock.run('key1', fn);
        expect(result).toBe('result');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent calls with same key', async () => {
        let resolveFn;
        const promise = new Promise(resolve => { resolveFn = resolve; });
        const fn = jest.fn().mockReturnValue(promise);

        const call1 = asyncLock.run('key2', fn);
        const call2 = asyncLock.run('key2', fn);

        expect(fn).toHaveBeenCalledTimes(1);

        resolveFn('done');
        const [result1, result2] = await Promise.all([call1, call2]);

        expect(result1).toBe('done');
        expect(result2).toBe('done');
    });

    it('should allow subsequent calls after first one completes', async () => {
        const fn1 = jest.fn().mockResolvedValue('first');
        await asyncLock.run('key3', fn1);

        const fn2 = jest.fn().mockResolvedValue('second');
        const result = await asyncLock.run('key3', fn2);

        expect(result).toBe('second');
        expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('should handle errors and still clear the lock', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('fail'));
        
        await expect(asyncLock.run('key4', fn)).rejects.toThrow('fail');
        
        const fn2 = jest.fn().mockResolvedValue('recovered');
        const result = await asyncLock.run('key4', fn2);
        expect(result).toBe('recovered');
    });
});
