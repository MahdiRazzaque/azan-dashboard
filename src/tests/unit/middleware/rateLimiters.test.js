const express = require("express");
const request = require("supertest");
const sseService = require("@services/system/sseService");

// Capture the handler by mocking express-rate-limit
let capturedHandler;
jest.mock("express-rate-limit", () => {
  const original = jest.requireActual("express-rate-limit");
  return jest.fn().mockImplementation((options) => {
    if (options.handler) {
      capturedHandler = options.handler;
    }
    return original(options);
  });
});

const {
  securityLimiter,
  operationsLimiter,
  globalReadLimiter,
  globalWriteLimiter,
  sseLimiter,
} = require("@middleware/rateLimiters");

jest.mock("@services/system/sseService");

describe("Rate Limiters Middleware", () => {
  let app;

  beforeAll(() => {
    process.env.FORCE_RATE_LIMIT = "true";
  });

  afterAll(() => {
    delete process.env.FORCE_RATE_LIMIT;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.get("/security", securityLimiter, (req, res) =>
      res.status(200).send("ok"),
    );
  });

  it("Security Limiter should block after 20 requests", async () => {
    for (let i = 0; i < 20; i++) {
      await request(app).get("/security").expect(200);
    }
    await request(app).get("/security").expect(429);
  });

  it("Global Read Limiter should be defined", () => {
    expect(globalReadLimiter).toBeDefined();
  });

  it("Global Write Limiter should be defined", () => {
    expect(globalWriteLimiter).toBeDefined();
  });

  describe("limitHandler", () => {
    it("should handle all IP fallbacks and retryAfter variations", () => {
      expect(capturedHandler).toBeDefined();

      const res = {
        getHeader: jest.fn().mockReturnValue("10"),
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      // Test 1: Full IP list fallback
      const req1 = {
        ip: "1.1.1.1",
        originalUrl: "/test",
      };
      capturedHandler(req1, res);
      expect(sseService.log).toHaveBeenCalledWith(
        expect.stringContaining("1.1.1.1"),
        "WARN",
      );

      // Test 2: x-forwarded-for fallback
      const req2 = {
        headers: { "x-forwarded-for": "2.2.2.2" },
        originalUrl: "/test",
      };
      capturedHandler(req2, res);
      expect(sseService.log).toHaveBeenCalledWith(
        expect.stringContaining("2.2.2.2"),
        "WARN",
      );

      // Test 3: socket.remoteAddress fallback
      const req3 = {
        headers: {},
        socket: { remoteAddress: "3.3.3.3" },
        originalUrl: "/test",
      };
      capturedHandler(req3, res);
      expect(sseService.log).toHaveBeenCalledWith(
        expect.stringContaining("3.3.3.3"),
        "WARN",
      );

      // Test 4: retryAfter is missing
      res.getHeader.mockReturnValue(null);
      const req4 = { ip: "4.4.4.4", originalUrl: "/test" };
      capturedHandler(req4, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.not.stringContaining("Please try again in"),
        }),
      );
    });
  });

  describe("skipTest logic", () => {
    it("should skip if FORCE_RATE_LIMIT is not set", async () => {
      delete process.env.FORCE_RATE_LIMIT;
      // Since we already loaded the module, we might need a fresh require or just test the logic
      // But skipTest is internal. We can trigger it by hitting the limiter.
      for (let i = 0; i < 25; i++) {
        await request(app).get("/security").expect(200);
      }
      process.env.FORCE_RATE_LIMIT = "true";
    });
  });
});
