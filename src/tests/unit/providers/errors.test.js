const {
  ProviderConnectionError,
  ProviderValidationError,
} = require("../../../providers/errors");

describe("Provider Errors", () => {
  describe("ProviderConnectionError", () => {
    it("should create an error with status code and source", () => {
      const error = new ProviderConnectionError(
        "Connection failed",
        503,
        "Aladhan",
      );
      expect(error.message).toBe("Connection failed");
      expect(error.statusCode).toBe(503);
      expect(error.source).toBe("Aladhan");
      expect(error.name).toBe("ProviderConnectionError");
    });

    it("should have default status code 500", () => {
      const error = new ProviderConnectionError("Oops");
      expect(error.statusCode).toBe(500);
    });
  });

  describe("ProviderValidationError", () => {
    it("should create an error with validation details", () => {
      const details = { field: "masjidId", message: "Required" };
      const error = new ProviderValidationError("Validation failed", details);
      expect(error.message).toBe("Validation failed");
      expect(error.validationDetails).toEqual(details);
      expect(error.name).toBe("ProviderValidationError");
    });
  });
});
