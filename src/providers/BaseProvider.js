/**
 * Base abstract class for all prayer time providers.
 * Provides shared logic for configuration handling and request deduplication.
 */
class BaseProvider {
    /**
     * Initialises the provider with specific and global configurations.
     * 
     * @param {Object} sourceConfig - Strategy-specific configuration for this source.
     * @param {Object} globalConfig - The full application configuration.
     */
    constructor(sourceConfig, globalConfig) {
        this.sourceConfig = sourceConfig;
        this.globalConfig = globalConfig;
        this.activeRequests = new Map();
    }

    /**
     * Retrieves annual prayer times for a given year.
     * Must be implemented by subclasses.
     * @param {number} year - The year to fetch times for.
     * @returns {Promise<Object>} The prayer times for the year.
     * @throws {Error} If not implemented by subclass.
     */
    async getAnnualTimes(year) {
        throw new Error('Method getAnnualTimes() must be implemented');
    }

    /**
     * Performs a health check on the provider.
     * Must be implemented by subclasses.
     * @returns {Promise<{healthy: boolean, message: string}>} A status object indicating health state and details.
     * @throws {Error} If not implemented by subclass.
     */
    async healthCheck() {
        throw new Error('Method healthCheck() must be implemented');
    }

    /**
     * Helper to deduplicate concurrent requests for the same key.
     * @param {string} key - A unique key for the request (e.g., source-year).
     * @param {Function} fetchFn - The actual function that performs the fetch.
     * @returns {Promise<Object>} The result of the fetch.
     */
    async deduplicateRequest(key, fetchFn) {
        if (this.activeRequests.has(key)) {
            return this.activeRequests.get(key);
        }

        const requestPromise = fetchFn();
        this.activeRequests.set(key, requestPromise);

        try {
            return await requestPromise;
        } finally {
            this.activeRequests.delete(key);
        }
    }
}

module.exports = BaseProvider;