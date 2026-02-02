const BaseProvider = require('../../../providers/BaseProvider');

class TestProvider extends BaseProvider {
    async getAnnualTimes(year) {
        return { year };
    }
}

describe('BaseProvider', () => {
    let provider;
    const config = { some: 'config' };
    const globalConfig = { global: 'config' };

    beforeEach(() => {
        provider = new TestProvider(config, globalConfig);
    });

    it('should store config and globalConfig', () => {
        expect(provider.sourceConfig).toBe(config);
        expect(provider.globalConfig).toBe(globalConfig);
    });

    it('should throw error if getAnnualTimes is not implemented', async () => {
        const base = new BaseProvider();
        await expect(base.getAnnualTimes(2024)).rejects.toThrow('Method getAnnualTimes() must be implemented');
    });

    it('should throw error if healthCheck is not implemented', async () => {
        const base = new BaseProvider();
        await expect(base.healthCheck()).rejects.toThrow('Method healthCheck() must be implemented');
    });

    it('should deduplicate concurrent requests', async () => {
        let callCount = 0;
        const fetchFn = jest.fn(async () => {
            callCount++;
            await new Promise(resolve => setTimeout(resolve, 10));
            return 'result';
        });

        const p1 = provider.deduplicateRequest('key', fetchFn);
        const p2 = provider.deduplicateRequest('key', fetchFn);

        const [r1, r2] = await Promise.all([p1, p2]);

        expect(r1).toBe('result');
        expect(r2).toBe('result');
        expect(callCount).toBe(1);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should allow subsequent requests after completion', async () => {
        const fetchFn = jest.fn().mockResolvedValue('done');
        
        await provider.deduplicateRequest('key', fetchFn);
        await provider.deduplicateRequest('key', fetchFn);

        expect(fetchFn).toHaveBeenCalledTimes(2);
    });
});