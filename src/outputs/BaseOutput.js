/**
 * Abstract base class defining the contract for automation output strategies.
 * All output integrations must inherit from this class.
 */
class BaseOutput {
    /**
     * Executes the output strategy.
     * @param {Object} _payload - The event payload (prayer times, event type, etc).
     * @param {Object} _metadata - Execution metadata (isTest, etc).
     * @param {AbortSignal} [_signal] - Optional signal to abort the execution.
     * @returns {Promise<void>}
     */
    async execute(_payload, _metadata, _signal) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Performs a health check on the output service.
     * @param {Object} _requestedParams - Configuration parameters to test with.
     * @returns {Promise<Object>} Health status object.
     */
    async healthCheck(_requestedParams) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Verifies the provided credentials are valid.
     * @param {Object} _credentials - The credentials to verify.
     * @returns {Promise<Object>} Verification result.
     */
    async verifyCredentials(_credentials) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Validates a trigger configuration for this output.
     * @param {Object} _trigger - The trigger configuration.
     * @param {Object} _context - Additional context (audioFiles, prayer, triggerType, niceName).
     * @returns {string[]} Array of warning messages.
     */
    validateTrigger(_trigger, _context) {
        return [];
    }

    /**
     * Validates an audio asset for compatibility with this output strategy.
     * @param {string} _filePath - Path to the audio file.
     * @param {Object} _metadata - Audio metadata (format, bitrate, duration, etc).
     * @returns {Promise<{valid: boolean, lastChecked: string, issues: string[]}>} Validation result.
     */
    async validateAsset(_filePath, _metadata) {
        return {
            valid: true,
            lastChecked: new Date().toISOString(),
            issues: []
        };
    }

    /**
     * Augments audio metadata with strategy-specific properties (e.g. VoiceMonkey compatibility).
     * @param {Object} _metadata - Basic audio metadata (format, bitrate, etc).
     * @returns {Object} Augmented properties.
     */
    augmentAudioMetadata(_metadata) {
        return {};
    }

    /**
     * Performs a health check on the output service.
     * @param {Object} _requestedParams - Configuration parameters to test with.
     * @returns {Promise<Object>} Health status object.
     */
    async healthCheck(_requestedParams) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Verifies the provided credentials are valid.
     * @param {Object} _credentials - The credentials to verify.
     * @returns {Promise<Object>} Verification result.
     */
    async verifyCredentials(_credentials) { 
        throw new Error('Not implemented'); 
    }

    /**
     * Validates a trigger configuration for this output.
     * @param {Object} _trigger - The trigger configuration.
     * @param {Object} _context - Additional context (audioFiles, prayer, triggerType, niceName).
     * @returns {string[]} Array of warning messages.
     */
    validateTrigger(_trigger, _context) {
        return [];
    }

    /**
     * Validates an audio asset for compatibility with this output strategy.
     * @param {string} _filePath - Path to the audio file.
     * @param {Object} _metadata - Audio metadata (format, bitrate, duration, etc).
     * @returns {Promise<{valid: boolean, lastChecked: string, issues: string[]}>} Validation result.
     */
    async validateAsset(_filePath, _metadata) {
        return {
            valid: true,
            lastChecked: new Date().toISOString(),
            issues: []
        };
    }

    /**
     * Augments audio metadata with strategy-specific properties (e.g. VoiceMonkey compatibility).
     * @param {Object} _metadata - Basic audio metadata (format, bitrate, etc).
     * @returns {Object} Augmented properties.
     */
    augmentAudioMetadata(_metadata) {
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