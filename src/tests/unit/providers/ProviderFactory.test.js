const ProviderFactory = require('../../../providers/ProviderFactory');
const AladhanProvider = require('../../../providers/AladhanProvider');
const MyMasjidProvider = require('../../../providers/MyMasjidProvider');

describe('ProviderFactory', () => {
    const config = { global: 'config' };

    it('should create an AladhanProvider for type "aladhan"', () => {
        const sourceConfig = { type: 'aladhan' };
        const provider = ProviderFactory.create(sourceConfig, config);
        expect(provider).toBeInstanceOf(AladhanProvider);
    });

    it('should create a MyMasjidProvider for type "mymasjid"', () => {
        const sourceConfig = { type: 'mymasjid', masjidId: '123' };
        const provider = ProviderFactory.create(sourceConfig, config);
        expect(provider).toBeInstanceOf(MyMasjidProvider);
    });

    it('should throw error for unknown provider type', () => {
        const sourceConfig = { type: 'unknown' };
        expect(() => ProviderFactory.create(sourceConfig, config)).toThrow('Unknown provider type: unknown');
    });

    it('should allow registering new providers', () => {
        class MockProvider {
            constructor(sourceConfig, globalConfig) {
                this.sourceConfig = sourceConfig;
                this.globalConfig = globalConfig;
            }
            static getMetadata() { return { id: 'mock' }; }
        }
        ProviderFactory.register('mock', MockProvider);
        const provider = ProviderFactory.create({ type: 'mock' }, config);
        expect(provider).toBeInstanceOf(MockProvider);
        expect(ProviderFactory.getProviderClass('mock')).toBe(MockProvider);
        expect(ProviderFactory.getRegisteredProviders().some(m => m.id === 'mock')).toBe(true);
    });
});


