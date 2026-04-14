const { envUpdateSchema } = require("../../config/schemas");

describe("envUpdateSchema", () => {
  it("should allow whitelisted keys", () => {
    const validKeys = [
      "BASE_URL",
      "PYTHON_SERVICE_URL",
      "PORT",
      "TZ",
      "LOG_LEVEL",
      "AZAN_CUSTOM_KEY",
      "SOME_API_KEY",
      "APP_TOKEN",
      "DB_SECRET",
      "EXTERNAL_URL",
      "CLIENT_ID",
    ];

    validKeys.forEach((key) => {
      expect(() => envUpdateSchema.parse({ key, value: "test" })).not.toThrow();
    });
  });

  it("should block dangerous system variables", () => {
    const dangerousKeys = ["PATH", "NODE_OPTIONS", "SHELL", "USER", "HOME"];

    dangerousKeys.forEach((key) => {
      expect(() => envUpdateSchema.parse({ key, value: "test" })).toThrow();
    });
  });

  it("should block non-whitelisted keys", () => {
    const invalidKeys = ["MY_VAR", "STUFF", "RANDOM"];

    invalidKeys.forEach((key) => {
      expect(() => envUpdateSchema.parse({ key, value: "test" })).toThrow();
    });
  });
});
