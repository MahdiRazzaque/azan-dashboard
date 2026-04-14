const { DateTime } = require("luxon");
const { ProviderFactory } = require("@providers");

/**
 * Validates configuration sources by testing API connectivity.
 * Used during settings updates to ensure new configuration is functional.
 *
 * @param {object} newConfig - The proposed configuration object
 * @throws {Error} If validation fails or sources are unreachable
 */
async function validateConfigSource(newConfig) {
  if (!newConfig.sources || !newConfig.sources.primary) {
    return;
  }

  const now = DateTime.now();
  const roles = ["primary", "backup"];

  for (const role of roles) {
    const source = newConfig.sources[role];

    // Skip if source is missing or is a disabled backup
    if (!source || (role === "backup" && source.enabled === false)) {
      continue;
    }

    const providerClass = ProviderFactory.getProviderClass(source.type);
    const metadata = providerClass.getMetadata();

    // 1. Structural/Parameter Validation
    try {
      providerClass.getConfigSchema().parse(source);
    } catch (e) {
      if (e.name === "ZodError") {
        const issues = e.issues || e.errors || [];
        const formattedErrors = issues
          .map((err) => {
            const path = err.path.join(".");
            return path ? `${path}: ${err.message}` : err.message;
          })
          .join(", ");
        throw new Error(
          `${role.toUpperCase()} Source (${metadata.label}) Validation Failed: ${formattedErrors}`,
        );
      }
      throw new Error(
        `${role.toUpperCase()} Source (${metadata.label}) Validation Failed: ${e.message}`,
      );
    }

    // 2. Logical Requirements Check (e.g. Coordinates)
    if (metadata.requiresCoordinates) {
      const coords = newConfig.location?.coordinates;
      if (!coords || coords.lat === undefined || coords.long === undefined) {
        throw new Error(
          `Coordinates (Latitude/Longitude) are required for ${metadata.label} (${role}) source`,
        );
      }
    }

    // 3. Functional/Connectivity Validation
    console.log(`[Validation] Testing ${role} source: ${source.type}`);
    try {
      const provider = ProviderFactory.create(source, newConfig);
      await provider.getAnnualTimes(now.year);
    } catch (e) {
      if (e.name === "ProviderValidationError") {
        // Preserving userFriendly flag while adding role context if not already present
        const { ProviderValidationError } = require("@providers/errors");
        throw new ProviderValidationError(
          e.message,
          e.validationDetails,
          e.userFriendly,
        );
      }
      // Rethrow with role context
      throw new Error(
        `${role.toUpperCase()} Source (${metadata.label}) Connection Failed: ${e.message}`,
      );
    }
  }
}

module.exports = {
  validateConfigSource,
};
