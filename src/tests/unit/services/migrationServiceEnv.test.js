const migrationService = require("../../../services/system/migrationService");
const OutputFactory = require("../../../outputs");

describe("migrationService Env Migration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.VOICEMONKEY_TOKEN;
    delete process.env.VOICEMONKEY_DEVICE;
    migrationService.setOutputSecretKeysResolver(() =>
      OutputFactory.getSecretRequirementKeys(),
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should migrate VoiceMonkey secrets from env", () => {
    process.env.VOICEMONKEY_TOKEN = "envToken";
    process.env.VOICEMONKEY_DEVICE = "envDevice";

    const config = { automation: { outputs: {} } };
    const {
      config: result,
      changed,
      migratedKeys,
    } = migrationService.migrateEnvSecrets(config);

    expect(changed).toBe(true);
    expect(result.automation.outputs.voicemonkey.params.token).toBe("envToken");
    expect(result.automation.outputs.voicemonkey.params.device).toBe(
      "envDevice",
    );
    expect(migratedKeys).toContain("VOICEMONKEY_TOKEN");
    expect(migratedKeys).toContain("VOICEMONKEY_DEVICE");
  });

  it("should NOT overwrite existing secrets in config", () => {
    process.env.VOICEMONKEY_TOKEN = "envToken";

    const config = {
      automation: {
        outputs: {
          voicemonkey: { params: { token: "existingToken" } },
        },
      },
    };
    const {
      config: result,
      changed,
      migratedKeys,
    } = migrationService.migrateEnvSecrets(config);

    expect(changed).toBe(false);
    expect(result.automation.outputs.voicemonkey.params.token).toBe(
      "existingToken",
    );
    expect(migratedKeys).not.toContain("VOICEMONKEY_TOKEN");
  });
});
