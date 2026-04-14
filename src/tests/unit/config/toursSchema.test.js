const { configSchema, systemSchema } = require("@config/schemas");

describe("Tours Schema", () => {
  describe("systemSchema with tours", () => {
    it("should return default tours when parsing empty object", () => {
      const result = systemSchema.parse({});
      expect(result).toEqual({
        healthChecks: { api: true, tts: true },
        tours: { dashboardSeen: false, adminSeen: false },
      });
    });

    it("should merge partial tours with defaults", () => {
      const result = systemSchema.parse({ tours: { dashboardSeen: true } });
      expect(result.tours).toEqual({
        dashboardSeen: true,
        adminSeen: false,
      });
    });

    it("should reject invalid tours type", () => {
      const result = systemSchema.safeParse({ tours: "invalid" });
      expect(result.success).toBe(false);
    });

    it("should reject non-boolean dashboardSeen value", () => {
      const result = systemSchema.safeParse({ tours: { dashboardSeen: 42 } });
      expect(result.success).toBe(false);
    });

    it("should be accessible via configSchema integration", () => {
      const validConfig = {
        location: {
          timezone: "Europe/London",
          coordinates: { lat: 51.5, long: -0.1 },
        },
        prayers: {
          fajr: { iqamahOffset: 20, roundTo: 15, fixedTime: null },
          dhuhr: { iqamahOffset: 15, roundTo: 15, fixedTime: null },
          asr: { iqamahOffset: 15, roundTo: 15, fixedTime: null },
          maghrib: { iqamahOffset: 10, roundTo: 5, fixedTime: null },
          isha: { iqamahOffset: 15, roundTo: 15, fixedTime: null },
        },
        sources: {
          primary: { type: "aladhan" },
        },
        data: { staleCheckDays: 7 },
        automation: {
          baseUrl: "http://localhost",
          pythonServiceUrl: "http://localhost",
          triggers: {
            fajr: {
              preAdhan: { enabled: false, type: "tts", targets: [] },
              adhan: { enabled: false, type: "tts", targets: [] },
              preIqamah: { enabled: false, type: "tts", targets: [] },
              iqamah: { enabled: false, type: "tts", targets: [] },
            },
            sunrise: {
              preAdhan: { enabled: false, type: "tts", targets: [] },
              adhan: { enabled: false, type: "tts", targets: [] },
            },
            dhuhr: {
              preAdhan: { enabled: false, type: "tts", targets: [] },
              adhan: { enabled: false, type: "tts", targets: [] },
              preIqamah: { enabled: false, type: "tts", targets: [] },
              iqamah: { enabled: false, type: "tts", targets: [] },
            },
            asr: {
              preAdhan: { enabled: false, type: "tts", targets: [] },
              adhan: { enabled: false, type: "tts", targets: [] },
              preIqamah: { enabled: false, type: "tts", targets: [] },
              iqamah: { enabled: false, type: "tts", targets: [] },
            },
            maghrib: {
              preAdhan: { enabled: false, type: "tts", targets: [] },
              adhan: { enabled: false, type: "tts", targets: [] },
              preIqamah: { enabled: false, type: "tts", targets: [] },
              iqamah: { enabled: false, type: "tts", targets: [] },
            },
            isha: {
              preAdhan: { enabled: false, type: "tts", targets: [] },
              adhan: { enabled: false, type: "tts", targets: [] },
              preIqamah: { enabled: false, type: "tts", targets: [] },
              iqamah: { enabled: false, type: "tts", targets: [] },
            },
          },
        },
      };

      const result = configSchema.parse(validConfig);
      expect(result.system.tours).toBeDefined();
      expect(result.system.tours).toEqual({
        dashboardSeen: false,
        adminSeen: false,
      });
    });
  });
});
