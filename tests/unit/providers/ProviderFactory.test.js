const ProviderFactory = require('../../../src/providers/ProviderFactory');
const AladhanProvider = require('../../../src/providers/AladhanProvider');
const MyMasjidProvider = require('../../../src/providers/MyMasjidProvider');

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
});
