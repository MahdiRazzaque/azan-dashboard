/**
 * Registry managing output strategy lifecycle.
 */
class OutputFactory {
    constructor() {
        this.strategies = new Map();
    }

    /**
     * Registers a strategy class.
     * @param {Class} StrategyClass - The strategy class to register (must extend BaseOutput).
     */
    register(StrategyClass) {
        const metadata = StrategyClass.getMetadata();
        if (!metadata || !metadata.id) {
            throw new Error('Strategy must have valid metadata with an ID');
        }
        // Instantiate and store
        this.strategies.set(metadata.id, new StrategyClass());
    }

    /**
     * Returns a singleton instance of the requested strategy.
     * @param {string} id - The strategy ID.
     * @returns {Object} The strategy instance.
     * @throws {Error} If strategy not found.
     */
    getStrategy(id) {
        if (!this.strategies.has(id)) {
            throw new Error(`Strategy '${id}' not found`);
        }
        return this.strategies.get(id);
    }

    /**
     * Returns all registered strategy instances.
     * @returns {BaseOutput[]}
     */
    getAllStrategyInstances() {
        return Array.from(this.strategies.values());
    }

    /**
     * Returns metadata for all registered strategies.
     * @returns {Object[]} Array of strategy metadata.
     */
    getAllStrategies() {
        return Array.from(this.strategies.values()).map(instance => instance.constructor.getMetadata());
    }

    /**
     * Aggregates secrets across all outputs.
     * @returns {Array<{strategyId: string, key: string}>}
     */
    getSecretRequirementKeys() {
        const requirements = [];
        for (const [id, instance] of this.strategies) {
            const keys = instance.getSecretRequirementKeys();
            keys.forEach(key => {
                requirements.push({ strategyId: id, key });
            });
        }
        return requirements;
    }

    // For testing purposes
    _reset() {
        this.strategies.clear();
    }
}

// Export as singleton
module.exports = new OutputFactory();
