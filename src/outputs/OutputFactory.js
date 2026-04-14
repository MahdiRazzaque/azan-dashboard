/**
 * Registry managing output strategy lifecycle.
 */
class OutputFactory {
  /**
   * Initialises the OutputFactory with an empty mapping of strategies.
   */
  constructor() {
    this.strategies = new Map();
  }

  /**
   * Registers a strategy class and initialises it as a singleton.
   * @param {Class} StrategyClass - The strategy class to register (must extend BaseOutput).
   */
  register(StrategyClass) {
    const metadata = StrategyClass.getMetadata();
    if (!metadata || !metadata.id) {
      throw new Error("Strategy must have valid metadata with an ID");
    }
    // Instantiate and store the strategy as a singleton.
    this.strategies.set(metadata.id, new StrategyClass());
  }

  /**
   * Returns a singleton instance of the requested strategy.
   * @param {string} id - The strategy ID.
   * @returns {Object} The strategy instance.
   * @throws {Error} If strategy is not found in the registry.
   */
  getStrategy(id) {
    if (!this.strategies.has(id)) {
      throw new Error(`Strategy '${id}' not found`);
    }
    return this.strategies.get(id);
  }

  /**
   * Returns all registered strategy instances.
   * @returns {BaseOutput[]} An array containing all registered strategy singleton instances.
   */
  getAllStrategyInstances() {
    return Array.from(this.strategies.values());
  }

  /**
   * Returns metadata for all registered strategies.
   * @returns {Object[]} An array of metadata objects for each registered strategy.
   */
  getAllStrategies() {
    return Array.from(this.strategies.values()).map((instance) =>
      instance.constructor.getMetadata(),
    );
  }

  /**
   * Aggregates secrets across all outputs.
   * @returns {Array<{strategyId: string, key: string}>} An array of objects representing secret requirements.
   */
  getSecretRequirementKeys() {
    const requirements = [];
    for (const [id, instance] of this.strategies) {
      const keys = instance.getSecretRequirementKeys();
      keys.forEach((key) => {
        requirements.push({ strategyId: id, key });
      });
    }
    return requirements;
  }

  /**
   * Resets the factory by clearing all currently registered strategies. This is intended for testing purposes only.
   */
  _reset() {
    this.strategies.clear();
  }
}

// Export as singleton
module.exports = new OutputFactory();
