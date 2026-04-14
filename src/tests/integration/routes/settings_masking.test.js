const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock Config Service
const mockConfig = {
  automation: {
    outputs: {
      voicemonkey: {
        enabled: true,
        params: {
          token: "REAL_SECRET_TOKEN",
          device: "REAL_DEVICE_ID",
        },
      },
    },
    triggers: {},
  },
  sources: {
    primary: { type: "aladhan" },
  },
  location: { timezone: "UTC", coordinates: { lat: 0, long: 0 } },
  prayers: {},
  data: {},
  security: { tokenVersion: 1 },
};

const mockConfigService = {
  init: jest.fn(),
  reload: jest.fn(),
  get: jest.fn(() => mockConfig),
  update: jest.fn(),
  reset: jest.fn(),
  _localPath: "local.json",
};
jest.mock("@config", () => mockConfigService);

// Mock other services to avoid startup issues
jest.mock("@services/system/sseService", () => ({
  broadcast: jest.fn(),
  addClient: jest.fn(),
  log: jest.fn(),
}));
jest.mock("@services/core/schedulerService", () => ({
  initScheduler: jest.fn(),
}));
jest.mock("@services/system/healthCheck", () => ({
  getHealth: jest.fn(() => ({})),
  refresh: jest.fn(),
}));

jest.mock("../../../outputs", () => {
  const mockMetadata = {
    id: "voicemonkey",
    label: "VoiceMonkey",
    params: [
      { key: "token", sensitive: true },
      { key: "device", sensitive: true },
    ],
  };
  return {
    getStrategy: jest.fn(() => ({
      constructor: { getMetadata: () => mockMetadata },
      validateTrigger: () => [],
    })),
    getAllStrategies: jest.fn(() => [mockMetadata]),
    getAllStrategyInstances: jest.fn(() => []),
    getSecretRequirementKeys: jest.fn(() => [
      { strategyId: "voicemonkey", key: "token" },
      { strategyId: "voicemonkey", key: "device" },
    ]),
  };
});
const OutputFactory = require("../../../outputs");

const app = require("../../../server");

describe("Settings Masking Integration", () => {
  const JWT_SECRET = "integration-test-secret";
  let adminToken;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.ADMIN_PASSWORD = "hashed_password";
    adminToken = jwt.sign({ role: "admin", tokenVersion: 1 }, JWT_SECRET);
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("GET /api/settings - should return masked secrets for admin", async () => {
    const res = await request(app)
      .get("/api/settings")
      .set("Cookie", [`auth_token=${adminToken}`])
      .expect(200);

    expect(res.body.automation.outputs.voicemonkey.params.token).toBe(
      "********",
    );
    expect(res.body.automation.outputs.voicemonkey.params.device).toBe(
      "********",
    );
  });

  it("GET /api/settings/public - should NOT contain secrets at all", async () => {
    const res = await request(app).get("/api/settings/public").expect(200);

    // getPublicSettings currently deletes them
    expect(
      res.body.automation.outputs.voicemonkey.params.token,
    ).toBeUndefined();
  });

  it("POST /api/settings/update - should unmask secrets before saving", async () => {
    const updatePayload = {
      ...mockConfig,
      automation: {
        ...mockConfig.automation,
        outputs: {
          ...mockConfig.automation.outputs,
          voicemonkey: {
            params: {
              token: "********", // Masked
              device: "NEW_DEVICE_ID", // Changed
            },
          },
        },
      },
    };

    await request(app)
      .post("/api/settings/update")
      .set("Cookie", [`auth_token=${adminToken}`])
      .send(updatePayload)
      .expect(200);

    // Verify configService.update was called with the REAL token
    expect(mockConfigService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        automation: expect.objectContaining({
          outputs: expect.objectContaining({
            voicemonkey: expect.objectContaining({
              params: expect.objectContaining({
                token: "REAL_SECRET_TOKEN",
                device: "NEW_DEVICE_ID",
              }),
            }),
          }),
        }),
      }),
    );
  });
});
