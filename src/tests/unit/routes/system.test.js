const request = require("supertest");
const express = require("express");
const systemRouter = require("@routes/system");
const configService = require("@config");
const { ProviderFactory } = require("@providers");
const healthCheck = require("@services/system/healthCheck");
const errorHandler = require("@middleware/errorHandler");

// Mock middleware
jest.mock("@middleware/auth", () => (req, res, next) => next());

// Mock services
jest.mock("@config", () => ({
  get: jest.fn(),
  reload: jest.fn().mockResolvedValue(),
}));
jest.mock("@providers", () => ({
  ProviderFactory: {
    create: jest.fn((source) => {
      if (source.type === "aladhan" || source.type === "mymasjid") {
        return {
          getAnnualTimes: jest.fn().mockResolvedValue({ "2023-01-01": {} }),
        };
      }
      throw new Error(`Unknown provider type: ${source.type}`);
    }),
  },
}));
jest.mock("@services/system/healthCheck", () => ({
  refresh: jest.fn().mockResolvedValue(),
  toggle: jest.fn().mockResolvedValue(),
}));

const app = express();
app.use(express.json());
app.use("/system", systemRouter);
app.use(errorHandler);

describe("System Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("GET /system/constants", () => {
    it("should return system constants", async () => {
      const res = await request(app).get("/system/constants");
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("calculationMethods");
      expect(res.body).toHaveProperty("madhabs");
      expect(res.body).toHaveProperty("latitudeAdjustments");
      expect(res.body).toHaveProperty("midnightModes");

      // Verify structure of one array
      expect(Array.isArray(res.body.calculationMethods)).toBe(true);
      if (res.body.calculationMethods.length > 0) {
        expect(res.body.calculationMethods[0]).toHaveProperty("id");
        expect(res.body.calculationMethods[0]).toHaveProperty("label");
      }
    });
  });

  describe("Health Endpoints", () => {
    it("should toggle health check", async () => {
      const res = await request(app)
        .post("/system/health/toggle")
        .send({ serviceId: "api", enabled: false });

      expect(res.status).toBe(200);
      expect(healthCheck.toggle).toHaveBeenCalledWith("api", false);
    });

    it("should force refresh health", async () => {
      healthCheck.refresh.mockResolvedValue({ status: "ok" });
      const res = await request(app)
        .post("/system/health/refresh")
        .send({ target: "local" });

      expect(res.status).toBe(200);
      expect(healthCheck.refresh).toHaveBeenCalledWith("local", undefined, {
        force: true,
      });
    });
  });

  describe("POST /system/source/test", () => {
    it("should return 400 for invalid target", async () => {
      const res = await request(app)
        .post("/system/source/test")
        .send({ target: "invalid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Invalid target");
    });

    it("should return 400 if target source not configured", async () => {
      configService.get.mockReturnValue({ sources: {} });

      const res = await request(app)
        .post("/system/source/test")
        .send({ target: "primary" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("is not configured");
    });

    it("should return 400 if backup is disabled", async () => {
      configService.get.mockReturnValue({
        sources: { backup: { type: "mymasjid", enabled: false } },
      });

      const res = await request(app)
        .post("/system/source/test")
        .send({ target: "backup" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("currently disabled");
    });

    it("should test aladhan successfully", async () => {
      configService.get.mockReturnValue({
        sources: { primary: { type: "aladhan" } },
        location: {
          timezone: "Europe/London",
          coordinates: { lat: 0, long: 0 },
        },
      });
      healthCheck.refresh.mockResolvedValue({
        primarySource: { healthy: true },
      });

      const res = await request(app)
        .post("/system/source/test")
        .send({ target: "primary" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(healthCheck.refresh).toHaveBeenCalledWith("primarySource", null, {
        force: true,
      });
    });

    it("should test mymasjid successfully", async () => {
      configService.get.mockReturnValue({
        sources: { primary: { type: "mymasjid" } },
        location: { timezone: "Europe/London" },
      });
      healthCheck.refresh.mockResolvedValue({
        primarySource: { healthy: true },
      });

      const res = await request(app)
        .post("/system/source/test")
        .send({ target: "primary" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 400 for unsupported source type", async () => {
      configService.get.mockReturnValue({
        sources: { primary: { type: "unsupported" } },
      });
      healthCheck.refresh.mockResolvedValue({
        primarySource: { healthy: false, message: "Unknown provider type" },
      });

      const res = await request(app)
        .post("/system/source/test")
        .send({ target: "primary" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Unknown provider type");
    });

    it("should handle fetch errors and return 400", async () => {
      configService.get.mockReturnValue({
        sources: { primary: { type: "aladhan" } },
        location: { timezone: "Europe/London" },
      });

      healthCheck.refresh.mockResolvedValue({
        primarySource: { healthy: false, message: "API Failure" },
      });

      const res = await request(app)
        .post("/system/source/test")
        .send({ target: "primary" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("API Failure");
    });

    it("should handle fetch errors when healthCheck.refresh also fails", async () => {
      configService.get.mockReturnValue({
        sources: { primary: { type: "aladhan" } },
        location: { timezone: "Europe/London" },
      });

      ProviderFactory.create.mockReturnValueOnce({
        getAnnualTimes: jest.fn().mockRejectedValue(new Error("API Failure")),
      });
      healthCheck.refresh.mockRejectedValue(new Error("Health Failure"));

      const res = await request(app)
        .post("/system/source/test")
        .send({ target: "primary" });

      expect(res.status).toBe(500);
      expect(healthCheck.refresh).toHaveBeenCalled();
    });
  });
});
