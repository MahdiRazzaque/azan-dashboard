const AladhanProvider = require('./AladhanProvider');
const MyMasjidProvider = require('./MyMasjidProvider');

/**
 * Factory for creating prayer data providers.
 */
class ProviderFactory {
    /**
     * Creates a provider instance based on the source configuration.
     * 
     * @param {Object} sourceConfig - Configuration for the specific source.
     * @param {Object} globalConfig - Global application configuration.
     * @returns {BaseProvider} A provider instance.
     * @throws {Error} If the provider type is unknown.
     */
    static create(sourceConfig, globalConfig) {
        switch (sourceConfig.type) {
            case 'aladhan':
                return new AladhanProvider(sourceConfig, globalConfig);
            case 'mymasjid':
                return new MyMasjidProvider(sourceConfig, globalConfig);
            default:
                throw new Error(`Unknown provider type: ${sourceConfig.type}`);
        }
    }
}

module.exports = ProviderFactory;
