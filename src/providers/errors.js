/**
 * Error thrown when a provider fails to connect to its remote API.
 * Triggers failover to backup source.
 */
class ProviderConnectionError extends Error {
    /**
     * Initialises a new ProviderConnectionError instance.
     * @param {string} message - Error message.
     * @param {number} [statusCode=500] - HTTP status code from the provider.
     * @param {string} [source] - Name of the provider source.
     */
    constructor(message, statusCode = 500, source) {
        super(message);
        this.name = 'ProviderConnectionError';
        this.statusCode = statusCode;
        this.source = source;
    }
}

/**
 * Error thrown when a provider receives a validation error (e.g. 400 Bad Request).
 * Does NOT trigger failover as the issue is likely with the configuration.
 */
class ProviderValidationError extends Error {
    /**
     * Initialises a new ProviderValidationError instance.
     * @param {string} message - Error message.
     * @param {Object} [validationDetails] - Details of the validation failure.
     */
    constructor(message, validationDetails) {
        super(message);
        this.name = 'ProviderValidationError';
        this.validationDetails = validationDetails;
    }
}

module.exports = {
    ProviderConnectionError,
    ProviderValidationError
};
