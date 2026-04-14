const configUnmasker = require("@utils/configUnmasker");
const encryption = require("@utils/encryption");
const OutputFactory = require("@outputs");
const { ProviderFactory } = require("@providers");

jest.mock("@utils/encryption");
jest.mock("@outputs");
jest.mock("@providers");

describe("ConfigUnmasker Util", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("unmaskParams", () => {
    it("should return early if params is not an object", () => {
      configUnmasker.unmaskParams("test", null, {});
      expect(OutputFactory.getStrategy).not.toHaveBeenCalled();
    });

    it("should unmask sensitive parameters", () => {
      const params = { apiKey: "********", other: "value" };
      const currentConfig = {
        automation: {
          outputs: {
            test: { params: { apiKey: "real-key" } },
          },
        },
      };

      const mockStrategy = {
        constructor: {
          getMetadata: () => ({
            params: [{ key: "apiKey", sensitive: true }],
          }),
        },
      };
      OutputFactory.getStrategy.mockReturnValue(mockStrategy);
      encryption.isMasked.mockImplementation((val) => val === "********");

      configUnmasker.unmaskParams("test", params, currentConfig);

      expect(params.apiKey).toBe("real-key");
    });

    it("should delete parameter if masked but not found in current config", () => {
      const params = { apiKey: "********" };
      const currentConfig = { automation: { outputs: {} } };

      const mockStrategy = {
        constructor: {
          getMetadata: () => ({
            params: [{ key: "apiKey", sensitive: true }],
          }),
        },
      };
      OutputFactory.getStrategy.mockReturnValue(mockStrategy);
      encryption.isMasked.mockImplementation((val) => val === "********");

      configUnmasker.unmaskParams("test", params, currentConfig);

      expect(params.apiKey).toBeUndefined();
      expect(params).not.toHaveProperty("apiKey");
    });

    it("should handle strategy not found", () => {
      OutputFactory.getStrategy.mockImplementation(() => {
        throw new Error("Not found");
      });
      const params = { apiKey: "********" };

      configUnmasker.unmaskParams("unknown", params, {});

      expect(params.apiKey).toBe("********");
    });
  });

  describe("unmaskSecrets", () => {
    it("should unmask both outputs and sources", () => {
      const newConfig = {
        automation: {
          outputs: {
            out1: { params: { secret: "********" } },
          },
        },
        sources: {
          primary: { type: "src1", apiKey: "********" },
          backup: { type: "src2", token: "********" },
        },
      };

      const currentConfig = {
        automation: {
          outputs: {
            out1: { params: { secret: "real-secret" } },
          },
        },
        sources: {
          primary: { apiKey: "real-api-key" },
          backup: { token: "real-token" },
        },
      };

      const mockStrategy = {
        constructor: {
          getMetadata: () => ({
            params: [{ key: "secret", sensitive: true }],
          }),
        },
      };
      OutputFactory.getStrategy.mockReturnValue(mockStrategy);

      const mockProviderClass1 = {
        getMetadata: () => ({
          parameters: [{ key: "apiKey", sensitive: true }],
        }),
      };
      const mockProviderClass2 = {
        getMetadata: () => ({
          parameters: [{ key: "token", sensitive: true }],
        }),
      };

      ProviderFactory.getProviderClass.mockImplementation((type) => {
        if (type === "src1") return mockProviderClass1;
        if (type === "src2") return mockProviderClass2;
      });

      encryption.isMasked.mockImplementation((val) => val === "********");

      configUnmasker.unmaskSecrets(newConfig, currentConfig);

      expect(newConfig.automation.outputs.out1.params.secret).toBe(
        "real-secret",
      );
      expect(newConfig.sources.primary.apiKey).toBe("real-api-key");
      expect(newConfig.sources.backup.token).toBe("real-token");
    });

    it("should handle missing current values in sources", () => {
      const newConfig = {
        sources: {
          primary: { type: "src1", apiKey: "********" },
        },
      };
      const currentConfig = { sources: {} };

      const mockProviderClass = {
        getMetadata: () => ({
          parameters: [{ key: "apiKey", sensitive: true }],
        }),
      };
      ProviderFactory.getProviderClass.mockReturnValue(mockProviderClass);
      encryption.isMasked.mockReturnValue(true);

      configUnmasker.unmaskSecrets(newConfig, currentConfig);

      expect(newConfig.sources.primary).not.toHaveProperty("apiKey");
    });

    it("should handle missing metadata params", () => {
      const params = { apiKey: "********" };
      const mockStrategy = {
        constructor: {
          getMetadata: () => ({}), // missing params
        },
      };
      OutputFactory.getStrategy.mockReturnValue(mockStrategy);
      configUnmasker.unmaskParams("test", params, {});
      expect(params.apiKey).toBe("********");
    });

    it("should skip if value is not masked", () => {
      const params = { apiKey: "real-key" };
      const mockStrategy = {
        constructor: {
          getMetadata: () => ({
            params: [{ key: "apiKey", sensitive: true }],
          }),
        },
      };
      OutputFactory.getStrategy.mockReturnValue(mockStrategy);
      encryption.isMasked.mockReturnValue(false);

      configUnmasker.unmaskParams("test", params, {});

      expect(params.apiKey).toBe("real-key");
    });
  });

  describe("unmaskSecrets", () => {
    it("should skip if no outputs or sources", () => {
      const newConfig = {};
      configUnmasker.unmaskSecrets(newConfig, {});
      expect(newConfig).toEqual({});
    });

    it("should handle missing metadata parameters in sources", () => {
      const newConfig = {
        sources: { primary: { type: "src1", apiKey: "********" } },
      };
      const mockProviderClass = {
        getMetadata: () => ({}), // missing parameters
      };
      ProviderFactory.getProviderClass.mockReturnValue(mockProviderClass);
      configUnmasker.unmaskSecrets(newConfig, {});
      expect(newConfig.sources.primary.apiKey).toBe("********");
    });

    it("should skip source if value is not masked", () => {
      const newConfig = {
        sources: { primary: { type: "src1", apiKey: "real-key" } },
      };
      const mockProviderClass = {
        getMetadata: () => ({
          parameters: [{ key: "apiKey", sensitive: true }],
        }),
      };
      ProviderFactory.getProviderClass.mockReturnValue(mockProviderClass);
      encryption.isMasked.mockReturnValue(false);

      configUnmasker.unmaskSecrets(newConfig, {});

      expect(newConfig.sources.primary.apiKey).toBe("real-key");
    });
  });
});
