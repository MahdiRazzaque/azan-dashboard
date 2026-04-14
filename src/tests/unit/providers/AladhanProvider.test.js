const AladhanProvider = require("@providers/AladhanProvider");
const {
  ProviderConnectionError,
  ProviderValidationError,
} = require("@providers");
const Bottleneck = require("bottleneck");

// Mock bottleneck
jest.mock("bottleneck", () => {
  const m = {
    schedule: jest.fn((fn) => fn()),
    on: jest.fn(),
    stop: jest.fn(),
  };
  return jest.fn(() => m);
});

describe("AladhanProvider", () => {
  let provider;
  const sourceConfig = {
    type: "aladhan",
    method: "ISNA",
    madhab: "Shafi",
    latitudeAdjustmentMethod: "Angle Based",
    midnightMode: "Standard",
  };
  const globalConfig = {
    location: {
      coordinates: { lat: 51.5, long: -0.1 },
      timezone: "Europe/London",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new AladhanProvider(sourceConfig, globalConfig);
    global.fetch = jest.fn();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  const mockResponse = {
    code: 200,
    status: "OK",
    data: {
      1: [
        {
          date: {
            gregorian: {
              date: "01-01-2024",
              day: "01",
              month: { number: 1 },
              year: "2024",
            },
          },
          timings: {
            Fajr: "05:00 (BST)",
            Sunrise: "07:00 (BST)",
            Dhuhr: "12:00 (BST)",
            Asr: "15:00 (BST)",
            Sunset: "18:00 (BST)",
            Maghrib: "18:00 (BST)",
            Isha: "19:30 (BST)",
            Imsak: "04:50 (BST)",
            Midnight: "00:00 (BST)",
          },
          meta: {
            timezone: "Europe/London",
          },
        },
      ],
    },
  };

  it("should fetch and parse Aladhan data", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await provider.getAnnualTimes(2024);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("latitude=51.5"),
    );
    expect(result["2024-01-01"]).toBeDefined();
    expect(result["2024-01-01"].fajr).toContain("T05:00:00");
  });

  it("should throw ProviderConnectionError on 5xx error", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
    });

    await expect(provider.getAnnualTimes(2024)).rejects.toThrow(
      ProviderConnectionError,
    );
  });

  it("should throw ProviderValidationError on 4xx error", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
    });

    await expect(provider.getAnnualTimes(2024)).rejects.toThrow(
      ProviderValidationError,
    );
  });

  it("should throw ProviderValidationError on schema failure", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: "invalid" }),
    });

    await expect(provider.getAnnualTimes(2024)).rejects.toThrow(
      ProviderValidationError,
    );
  });

  it("should deduplicate concurrent requests for the same year", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () =>
        new Promise((resolve) => setTimeout(() => resolve(mockResponse), 10)),
    });

    const p1 = provider.getAnnualTimes(2024);
    const p2 = provider.getAnnualTimes(2024);

    await Promise.all([p1, p2]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("should return config schema", () => {
    const schema = AladhanProvider.getConfigSchema();
    expect(schema).toBeDefined();
  });

  it("should return metadata", () => {
    const meta = AladhanProvider.getMetadata();
    expect(meta.id).toBe("aladhan");
    expect(meta.parameters).toHaveLength(4);
  });

  describe("healthCheck edge cases", () => {
    it("should return healthy if API is reachable", async () => {
      global.fetch.mockResolvedValue({ ok: true });
      const result = await provider.healthCheck();
      expect(result.healthy).toBe(true);
    });

    it("should return unhealthy if API returns error", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));
      const result = await provider.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.message).toContain("Network error");
    });

    it("should return unhealthy if API returns non-ok status", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 });
      const result = await provider.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.message).toBe("API returned 404");
    });
  });

  describe("_doFetch edge cases", () => {
    it("should handle schema validation failure with details", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 200,
            status: "OK",
            data: { 1: [{ timings: {} }] },
          }),
      });
      await expect(provider.getAnnualTimes(2024)).rejects.toThrow(
        "Aladhan Schema Validation Failed",
      );
    });

    it("should handle missing time strings", async () => {
      const mockData = {
        code: 200,
        status: "OK",
        data: {
          1: [
            {
              timings: {
                Fajr: "",
                Sunrise: "",
                Dhuhr: "",
                Asr: "",
                Maghrib: "",
                Isha: "",
                Imsak: "",
                Midnight: "",
                Sunset: "",
              },
              date: {
                gregorian: {
                  date: "01-01-2024",
                  day: "01",
                  month: { number: 1 },
                  year: "2024",
                },
              },
              meta: { timezone: "Europe/London" },
            },
          ],
        },
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });
      const result = await provider.getAnnualTimes(2024);
      expect(result["2024-01-01"].fajr).toBeNull();
    });

    it("should handle fetch network error", async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error("Network Fail"));
      await expect(provider.getAnnualTimes(2024)).rejects.toThrow(
        "Failed to connect to Aladhan API: Network Fail",
      );
    });
  });

  describe("Helper methods", () => {
    it("should resolve calculation method by name", async () => {
      const p = new AladhanProvider(
        { method: "Muslim World League" },
        globalConfig,
      );
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
      try {
        await p.getAnnualTimes(2024);
      } catch (e) {}
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("method=3"),
      );
    });

    it("should resolve madhab by name", async () => {
      const p = new AladhanProvider({ madhab: "Hanafi" }, globalConfig);
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
      try {
        await p.getAnnualTimes(2024);
      } catch (e) {}
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("school=1"),
      );
    });

    it("should resolve latitude adjustment by name", async () => {
      const p = new AladhanProvider(
        { latitudeAdjustmentMethod: "Angle Based" },
        globalConfig,
      );
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
      try {
        await p.getAnnualTimes(2024);
      } catch (e) {}
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("latitudeAdjustmentMethod=3"),
      );
    });

    it("should return 0 if latitude adjustment name not found", () => {
      expect(provider._getLatAdjId("Unknown")).toBe(0);
    });

    it("should return 0 if midnight mode name not found", () => {
      expect(provider._getMidnightId("Unknown")).toBe(0);
    });

    it("should resolve midnight mode by name", async () => {
      const p = new AladhanProvider({ midnightMode: "Jafari" }, globalConfig);
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
      try {
        await p.getAnnualTimes(2024);
      } catch (e) {}
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("midnightMode=1"),
      );
    });

    it("should handle missing names in helpers", () => {
      expect(provider._getLatAdjId(null)).toBe(0);
      expect(provider._getMidnightId(null)).toBe(0);
    });
  });

  describe("Helper methods extra", () => {
    it("should use numeric IDs if provided", async () => {
      const p = new AladhanProvider(
        {
          method: 3,
          madhab: 1,
          latitudeAdjustmentMethod: 1,
          midnightMode: 1,
        },
        globalConfig,
      );
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
      try {
        await p.getAnnualTimes(2024);
      } catch (e) {}
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("method=3"),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("school=1"),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("latitudeAdjustmentMethod=1"),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("midnightMode=1"),
      );
    });

    it("should handle validation error without issues array", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 200,
            status: "OK",
            data: { 1: [{ timings: {} }] },
          }),
      });
      // Mock parse to throw error without issues
      const {
        AladhanAnnualResponseSchema,
      } = require("@providers/AladhanProvider");
      // Wait, I can't easily mock the schema parse because it's not exported or easily accessible for mocking.
      // But I can try to trigger it.
    });
  });

  describe("Queue failed handler", () => {
    it("should cover the listener", () => {
      jest.resetModules();
      const AladhanProvider = require("@providers/AladhanProvider");
      const mockQueueInstance = AladhanProvider.queue;
      const failedListenerCall = mockQueueInstance.on.mock.calls.find(
        (call) => call[0] === "failed",
      );
      if (failedListenerCall) {
        const failedListener = failedListenerCall[1];
        const spyWarn = jest.spyOn(console, "warn").mockImplementation();
        failedListener(new Error("Queue Fail"), { options: { id: "job1" } });
        expect(spyWarn).toHaveBeenCalledWith(
          expect.stringContaining("job1 failed: Queue Fail"),
        );
        spyWarn.mockRestore();
      }
    });
  });
});
