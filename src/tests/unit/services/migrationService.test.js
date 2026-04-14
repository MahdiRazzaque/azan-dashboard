const migrationService = require("../../../services/system/migrationService");
const OutputFactory = require("../../../outputs");
const { ProviderFactory } = require("@providers");

jest.mock("../../../outputs");
jest.mock("@providers");

describe("migrationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    migrationService.setOutputSecretKeysResolver(() =>
      OutputFactory.getSecretRequirementKeys(),
    );
  });

  describe("migrateConfig", () => {
    it("should migrate V1 config with VoiceMonkey to V5", () => {
      const v1Config = {
        automation: {
          voiceMonkey: {
            enabled: true,
            token: "myToken",
            device: "myDevice",
          },
        },
      };

      const result = migrationService.migrateConfig(v1Config);

      expect(result.version).toBe(5);
      expect(result.automation.voiceMonkey).toBeUndefined();
      expect(result.automation.outputs.voicemonkey).toEqual({
        enabled: true,
        leadTimeMs: 0, // Default
        params: {
          token: "myToken",
          device: "myDevice",
        },
      });
      expect(result.system.healthChecks).toBeDefined();
      expect(result.security.tokenVersion).toBe(1);
    });

    it("should handle V1 config without VoiceMonkey", () => {
      const v1Config = {
        automation: {
          // No voiceMonkey
        },
      };

      const result = migrationService.migrateConfig(v1Config);

      expect(result.version).toBe(5);
      expect(result.automation.outputs).toEqual({});
      expect(result.security.tokenVersion).toBe(1);
    });

    it("should handle V1 config with missing automation block", () => {
      const v1Config = {
        // No automation
      };

      const result = migrationService.migrateConfig(v1Config);

      expect(result.version).toBe(5);
      expect(result.automation).toBeDefined();
      expect(result.automation.outputs).toEqual({});
    });

    it("should handle V1 config with existing outputs block", () => {
      const v1Config = {
        automation: { outputs: { existing: {} } },
      };
      const result = migrationService.migrateConfig(v1Config);
      expect(result.automation.outputs.existing).toBeDefined();
    });

    it("should migrate V2 config (global calculation) to V5", () => {
      const v2Config = {
        version: 2,
        calculation: {
          method: 2,
          madhab: 1,
          latitudeAdjustmentMethod: 3,
          midnightMode: 1,
        },
        sources: {
          primary: { type: "aladhan" },
        },
      };

      const result = migrationService.migrateConfig(v2Config);

      expect(result.version).toBe(5);
      expect(result.calculation).toBeUndefined();
      expect(result.sources.primary.method).toBe(2);
      expect(result.system.healthChecks).toBeDefined();
      expect(result.security.tokenVersion).toBe(1);
    });

    it("should handle V2 config with non-aladhan primary source", () => {
      const v2Config = {
        version: 2,
        calculation: { method: 2 },
        sources: { primary: { type: "other" } },
      };
      const result = migrationService.migrateConfig(v2Config);
      expect(result.calculation).toBeUndefined();
      expect(result.sources.primary.method).toBeUndefined();
    });

    it("should migrate V3 config to V5 by adding system.healthChecks and security", () => {
      const v3Config = {
        version: 3,
        automation: { outputs: {} },
      };

      const result = migrationService.migrateConfig(v3Config);

      expect(result.version).toBe(5);
      expect(result.system.healthChecks).toEqual({
        api: true,
        tts: true,
      });
      expect(result.security.tokenVersion).toBe(1);
    });

    it("should handle V3 config with existing system block but missing healthChecks", () => {
      const v3Config = {
        version: 3,
        system: { other: "value" },
      };
      const result = migrationService.migrateConfig(v3Config);
      expect(result.system.healthChecks).toBeDefined();
      expect(result.system.other).toBe("value");
    });

    it("should handle V3 config already having healthChecks", () => {
      const v3Config = {
        version: 3,
        system: { healthChecks: { api: false } },
      };
      const result = migrationService.migrateConfig(v3Config);
      expect(result.system.healthChecks.api).toBe(false);
    });

    it("should handle V4 config with existing security block but missing tokenVersion", () => {
      const v4Config = {
        version: 4,
        security: { other: "value" },
      };
      const result = migrationService.migrateConfig(v4Config);
      expect(result.security.tokenVersion).toBe(1);
      expect(result.security.other).toBe("value");
    });

    it("should handle V4 config already having tokenVersion", () => {
      const v4Config = {
        version: 4,
        security: { tokenVersion: 2 },
      };
      const result = migrationService.migrateConfig(v4Config);
      expect(result.security.tokenVersion).toBe(2);
    });

    it("should return as-is if already V5", () => {
      const v5Config = { version: 5, other: "value" };
      const result = migrationService.migrateConfig(v5Config);
      expect(result).toEqual(v5Config);
    });

    it("should not mutate original object", () => {
      const v1Config = { automation: { voiceMonkey: {} } };
      const copy = JSON.parse(JSON.stringify(v1Config));

      migrationService.migrateConfig(v1Config);
      expect(v1Config).toEqual(copy);
    });
  });

  describe("migrateEnvSecrets", () => {
    it("should migrate output secrets from env", () => {
      const config = {
        automation: { outputs: { voicemonkey: { params: {} } } },
      };
      process.env.VOICEMONKEY_TOKEN = "env-token";

      OutputFactory.getSecretRequirementKeys.mockReturnValue([
        { strategyId: "voicemonkey", key: "token" },
      ]);
      ProviderFactory.getRegisteredProviders.mockReturnValue([]);

      const result = migrationService.migrateEnvSecrets(config);

      expect(result.changed).toBe(true);
      expect(result.config.automation.outputs.voicemonkey.params.token).toBe(
        "env-token",
      );
      expect(result.migratedKeys).toContain("VOICEMONKEY_TOKEN");

      delete process.env.VOICEMONKEY_TOKEN;
    });

    it("should create missing blocks during output migration", () => {
      const config = {};
      process.env.VOICEMONKEY_TOKEN = "env-token";

      OutputFactory.getSecretRequirementKeys.mockReturnValue([
        { strategyId: "voicemonkey", key: "token" },
      ]);
      ProviderFactory.getRegisteredProviders.mockReturnValue([]);

      const result = migrationService.migrateEnvSecrets(config);

      expect(result.changed).toBe(true);
      expect(result.config.automation.outputs.voicemonkey.params.token).toBe(
        "env-token",
      );

      delete process.env.VOICEMONKEY_TOKEN;
    });

    it("should create missing params block during output migration", () => {
      const config = {
        automation: { outputs: { voicemonkey: { enabled: true } } },
      };
      process.env.VOICEMONKEY_TOKEN = "env-token";

      OutputFactory.getSecretRequirementKeys.mockReturnValue([
        { strategyId: "voicemonkey", key: "token" },
      ]);
      ProviderFactory.getRegisteredProviders.mockReturnValue([]);

      const result = migrationService.migrateEnvSecrets(config);

      expect(result.changed).toBe(true);
      expect(result.config.automation.outputs.voicemonkey.params.token).toBe(
        "env-token",
      );

      delete process.env.VOICEMONKEY_TOKEN;
    });

    it("should migrate provider secrets from env", () => {
      const config = { sources: { primary: { type: "aladhan" } } };
      process.env.APIKEY = "env-api-key";

      OutputFactory.getSecretRequirementKeys.mockReturnValue([]);
      ProviderFactory.getRegisteredProviders.mockReturnValue([
        {
          id: "aladhan",
          parameters: [{ key: "apiKey", sensitive: true }],
        },
      ]);

      const result = migrationService.migrateEnvSecrets(config);

      expect(result.changed).toBe(true);
      expect(result.config.sources.primary.apiKey).toBe("env-api-key");
      expect(result.migratedKeys).toContain("APIKEY");

      delete process.env.APIKEY;
    });

    it("should handle missing metadata parameters in providers", () => {
      const config = { sources: { primary: { type: "aladhan" } } };
      process.env.APIKEY = "env-api-key";

      OutputFactory.getSecretRequirementKeys.mockReturnValue([]);
      ProviderFactory.getRegisteredProviders.mockReturnValue([
        {
          id: "aladhan",
          // missing parameters
        },
      ]);

      const result = migrationService.migrateEnvSecrets(config);
      expect(result.changed).toBe(false);
      delete process.env.APIKEY;
    });

    it("should handle missing env values", () => {
      const config = {
        automation: { outputs: { voicemonkey: { params: {} } } },
      };
      // No env set
      OutputFactory.getSecretRequirementKeys.mockReturnValue([
        { strategyId: "voicemonkey", key: "token" },
      ]);
      ProviderFactory.getRegisteredProviders.mockReturnValue([
        {
          id: "aladhan",
          parameters: [{ key: "apiKey", sensitive: true }],
        },
      ]);

      const result = migrationService.migrateEnvSecrets(config);
      expect(result.changed).toBe(false);
    });

    it("should not duplicate migrated keys", () => {
      const config = {
        sources: {
          primary: { type: "aladhan" },
          backup: { type: "aladhan" },
        },
      };
      process.env.APIKEY = "env-api-key";

      OutputFactory.getSecretRequirementKeys.mockReturnValue([]);
      ProviderFactory.getRegisteredProviders.mockReturnValue([
        {
          id: "aladhan",
          parameters: [{ key: "apiKey", sensitive: true }],
        },
      ]);

      const result = migrationService.migrateEnvSecrets(config);

      expect(result.migratedKeys.filter((k) => k === "APIKEY").length).toBe(1);

      delete process.env.APIKEY;
    });

    it("should not overwrite existing secrets", () => {
      const config = {
        automation: {
          outputs: { voicemonkey: { params: { token: "existing" } } },
        },
      };
      process.env.VOICEMONKEY_TOKEN = "env-token";

      OutputFactory.getSecretRequirementKeys.mockReturnValue([
        { strategyId: "voicemonkey", key: "token" },
      ]);
      ProviderFactory.getRegisteredProviders.mockReturnValue([]);

      const result = migrationService.migrateEnvSecrets(config);

      expect(result.changed).toBe(false);
      expect(result.config.automation.outputs.voicemonkey.params.token).toBe(
        "existing",
      );

      delete process.env.VOICEMONKEY_TOKEN;
    });
  });
});
