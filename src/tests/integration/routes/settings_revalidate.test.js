const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock Config
jest.mock("@config", () => ({
  get: jest.fn().mockReturnValue({
    security: { tokenVersion: 1 },
  }),
  reload: jest.fn(),
  init: jest.fn().mockResolvedValue(),
}));

// Mock HealthCheck
jest.mock("@services/system/healthCheck", () => ({
  init: jest.fn(),
  runStartupChecks: jest.fn(),
  getHealth: jest.fn().mockReturnValue({}),
}));

// Mock scheduler
jest.mock("@services/core/schedulerService", () => ({
  initScheduler: jest.fn().mockResolvedValue(),
  stopAll: jest.fn().mockResolvedValue(),
}));

// Mock settingsController.revalidateFile
const settingsController = require("@controllers/settingsController");
jest.mock("@controllers/settingsController", () => ({
  revalidateFile: jest.fn((req, res) =>
    res.status(200).json({ success: true }),
  ),
  getPublicSettings: jest.fn(),
  getSettings: jest.fn(),
  updateSettings: jest.fn(),
  resetSettings: jest.fn(),
  refreshCache: jest.fn(),
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
}));

// Mock rateLimiters to skip globalWriteLimiter so we can test operationsLimiter specifically
jest.mock("@middleware/rateLimiters", () => {
  const original = jest.requireActual("@middleware/rateLimiters");
  return {
    ...original,
    globalWriteLimiter: (req, res, next) => next(),
  };
});

const app = require("../../../server");

describe("Settings Revalidate Rate Limiting", () => {
  const JWT_SECRET = "test-secret";
  let adminToken;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.FORCE_RATE_LIMIT = "true";
    adminToken = jwt.sign({ role: "admin", tokenVersion: 1 }, JWT_SECRET);
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    delete process.env.FORCE_RATE_LIMIT;
  });

  it("should apply rate limiting to /api/settings/files/revalidate", async () => {
    // operationsLimiter allows 10 requests per 10 seconds
    for (let i = 0; i < 10; i++) {
      await request(app)
        .post("/api/settings/files/revalidate")
        .set("Cookie", [`auth_token=${adminToken}`])
        .send({ filename: "test.mp3", type: "custom" })
        .expect(200);
    }

    const res = await request(app)
      .post("/api/settings/files/revalidate")
      .set("Cookie", [`auth_token=${adminToken}`])
      .send({ filename: "test.mp3", type: "custom" })
      .expect(429);

    expect(res.body.error).toBe("Too many requests");
    expect(res.body.message).toContain("Too many operation requests");
  });
});
