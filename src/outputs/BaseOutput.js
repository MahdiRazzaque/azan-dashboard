/**
 * Abstract base class defining the contract for automation output strategies.
 * All output integrations must inherit from this class.
 */
class BaseOutput {
    /**
     * Executes the output strategy.
     * @param {Object} payload - The event payload (prayer times, event type, etc).
     * @param {Object} metadata - Execution metadata (isTest, etc).
     * @param {AbortSignal} [signal] - Optional signal to abort the execution.
     * @returns {Promise<void>}
     */
    async execute(payload, metadata, signal) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Performs a health check on the output service.
     * @param {Object} requestedParams - Configuration parameters to test with.
     * @returns {Promise<Object>} Health status object.
     */
    async healthCheck(requestedParams) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Verifies the provided credentials are valid.
     * @param {Object} credentials - The credentials to verify.
     * @returns {Promise<Object>} Verification result.
     */
    async verifyCredentials(credentials) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Validates a trigger configuration for this output.
     * @param {Object} trigger - The trigger configuration.
     * @param {Object} context - Additional context (audioFiles, prayer, triggerType, niceName).
     * @returns {string[]} Array of warning messages.
     */
    validateTrigger(trigger, context) {
        return [];
    }

    /**
     * Augments audio metadata with strategy-specific properties (e.g. VoiceMonkey compatibility).
     * @param {Object} metadata - Basic audio metadata (format, bitrate, etc).
     * @returns {Object} Augmented properties.
     */
    augmentAudioMetadata(metadata) {
        return {};
    }

    /**
     * Returns keys of parameters marked as sensitive.
     * Used for environment variable mapping.
     * @returns {string[]} Array of sensitive parameter keys.
     */
    getSecretRequirementKeys() {
        const metadata = this.constructor.getMetadata();
        if (!metadata.params) return [];
        return metadata.params
            .filter(p => p.sensitive)
            .map(p => p.key);
    }

    /**
     * Returns metadata describing the strategy.
     * Must be implemented by subclasses.
     * @returns {Object} Strategy metadata { id, label, timeoutMs, defaultLeadTimeMs, params: [...] }
     */
    static getMetadata() { 
        throw new Error('Not implemented'); 
    }
}

module.exports = BaseOutput;
