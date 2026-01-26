/**
 * Abstract base class for all prayer data providers.
 * Provides common functionality like request deduplication.
 */
class BaseProvider {
    /**
     * Initialises the base provider with necessary configurations and state.
     * @param {Object} sourceConfig - Source-specific configuration.
     * @param {Object} globalConfig - Global application configuration.
     */
    constructor(sourceConfig, globalConfig) {
        this.sourceConfig = sourceConfig;
        this.globalConfig = globalConfig;
        /** @type {Map<string, Promise>} */
        this.activeFetches = new Map();
    }

    /**
     * Fetches annual prayer times for a given year.
     * Must be implemented by subclasses.
     * 
     * @param {number} year - The year to fetch prayer times for.
     * @returns {Promise<Object>} A map of ISO dates to prayer time data.
     * @throws {Error} If not implemented by subclass.
     */
    async getAnnualTimes(year) {
        throw new Error('Method getAnnualTimes() must be implemented');
    }

    /**
     * Returns the metadata schema for the provider.
     * Must be implemented by subclasses.
     * 
     * @returns {Object} The provider metadata.
     * @throws {Error} If not implemented by subclass.
     */
    static getMetadata() {
        throw new Error('Method getMetadata() must be implemented');
    }

    /**
     * Deduplicates concurrent requests to the same resource.
     * 
     * @param {string} key - Unique key for the request.
     * @param {Function} fetchFn - Async function that performs the actual fetch.
     * @returns {Promise} The promise for the request.
     */
    deduplicateRequest(key, fetchFn) {
        if (this.activeFetches.has(key)) {
            return this.activeFetches.get(key);
        }

        const promise = fetchFn().finally(() => {
            this.activeFetches.delete(key);
        });

        this.activeFetches.set(key, promise);
        return promise;
    }
}

module.exports = BaseProvider;
