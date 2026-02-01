const encryption = require('./encryption');

/**
 * Utility for unmasking configuration values by restoring them from a reference object.
 */
const configUnmasker = {
    /**
     * Unmasks a set of parameters for a specific output strategy.
     * @param {string} strategyId - The ID of the output strategy.
     * @param {Object} params - The parameters to unmask (mutates object).
     * @param {Object} currentConfig - The reference configuration to pull real secrets from.
     */
    unmaskParams: (strategyId, params, currentConfig) => {
        if (!params || typeof params !== 'object') return;

        // Lazy load OutputFactory to avoid circular dependencies if any strategy requires this util
        const OutputFactory = require('../outputs');

        try {
            const strategy = OutputFactory.getStrategy(strategyId);
            const metadata = strategy.constructor.getMetadata();
            const sensitiveKeys = metadata.params?.filter(p => p.sensitive).map(p => p.key) || [];

            for (const sKey of sensitiveKeys) {
                if (encryption.isMasked(params[sKey])) {
                    const currentVal = currentConfig.automation?.outputs?.[strategyId]?.params?.[sKey];
                    if (currentVal) {
                        params[sKey] = currentVal;
                    } else {
                        delete params[sKey];
                    }
                }
            }
        } catch (e) {
            // Strategy not found or metadata missing, skip unmasking
        }
    },

    /**
     * Unmasks an entire configuration object.
     * @param {Object} newConfig - The incoming configuration (mutates object).
     * @param {Object} currentConfig - The reference configuration.
     */
    unmaskSecrets: (newConfig, currentConfig) => {
        const OutputFactory = require('../outputs');
        const { ProviderFactory } = require('../providers');

        // 1. Unmask Outputs
        if (newConfig.automation?.outputs) {
            for (const [id, outputConfig] of Object.entries(newConfig.automation.outputs)) {
                configUnmasker.unmaskParams(id, outputConfig.params, currentConfig);
            }
        }

        // 2. Unmask Sources
        if (newConfig.sources) {
            for (const role of ['primary', 'backup']) {
                const source = newConfig.sources[role];
                if (source && source.type) {
                    try {
                        const providerClass = ProviderFactory.getProviderClass(source.type);
                        const metadata = providerClass.getMetadata();
                        const sensitiveKeys = metadata.parameters?.filter(p => p.sensitive).map(p => p.key) || [];
                        
                        for (const sKey of sensitiveKeys) {
                            if (encryption.isMasked(source[sKey])) {
                                const currentVal = currentConfig.sources?.[role]?.[sKey];
                                if (currentVal) {
                                    source[sKey] = currentVal;
                                } else {
                                    delete source[sKey];
                                }
                            }
                        }
                    } catch (e) {}
                }
            }
        }
    }
};

module.exports = configUnmasker;
