const { ConfigService } = require('./ConfigService');

const configService = new ConfigService();

// Export the service instance as the default export
// Consumers will need to call .init() on server start, 
// and can use .get() to access the config.
module.exports = configService;
