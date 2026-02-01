const AladhanProvider = require('./AladhanProvider');
const MyMasjidProvider = require('./MyMasjidProvider');

/**
 * Factory for creating prayer data providers.
 * Supports dynamic registration of new provider types.
 */
class ProviderFactory {
    static registry = new Map();

    /**
     * Registers a new provider class.
     * @param {string} type - The unique type identifier for the provider.
     * @param {typeof import('./BaseProvider')} ProviderClass - The provider class.
     */
    static register(type, ProviderClass) {
        this.registry.set(type, ProviderClass);
    }

    /**
     * Creates a provider instance based on the source configuration.
     * 
     * @param {Object} sourceConfig - Configuration for the specific source.
     * @param {Object} globalConfig - Global application configuration.
     * @returns {import('./BaseProvider')} A provider instance.
     * @throws {Error} If the provider type is unknown.
     */
    static create(sourceConfig, globalConfig) {
        const Provider = this.registry.get(sourceConfig.type);
        if (!Provider) {
            throw new Error(`Unknown provider type: ${sourceConfig.type}`);
        }
        return new Provider(sourceConfig, globalConfig);
    }

    /**
     * Retrieves the provider class for a given type.
     * 
     * @param {string} type - The provider type (e.g., 'aladhan').
     * @returns {typeof import('./BaseProvider')} The provider class.
     * @throws {Error} If the provider type is unknown.
     */
    static getProviderClass(type) {
        const Provider = this.registry.get(type);
        if (!Provider) {
            throw new Error(`Unknown provider type: ${type}`);
        }
        return Provider;
    }

    /**
     * Retrieves the list of all registered prayer providers and their metadata.
     * 
     * @returns {Array<Object>} An array of provider metadata objects.
     */
    static getRegisteredProviders() {
        return Array.from(this.registry.values()).map(P => P.getMetadata());
    }
}

// Auto-register built-in providers
ProviderFactory.register('aladhan', AladhanProvider);
ProviderFactory.register('mymasjid', MyMasjidProvider);

module.exports = ProviderFactory;
