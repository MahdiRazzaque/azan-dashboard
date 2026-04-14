const fs = require("fs");
const service = require("@services/system/diagnosticsService");
const prayerTimeService = require("@services/core/prayerTimeService");
const { DateTime } = require("luxon");
const path = require("path");

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    access: jest.fn(),
  },
}));
jest.mock("@services/core/prayerTimeService");
jest.mock("@utils/calculations", () => ({
  calculateIqamah: jest.fn(),
}));
const { calculateIqamah } = require("@utils/calculations");

describe("Diagnostics Service", () => {
  const mockConfig = {
    location: { timezone: "Europe/London" },
    automation: {
      triggers: {
        fajr: {
          adhan: {
            enabled: true,
            type: "file",
            path: "adhan.mp3",
            targets: ["local"],
          },
          preAdhan: {
            enabled: true,
            type: "tts",
            template: "Pre-adhan",
            offsetMinutes: 5,
            targets: ["browser"],
          },
          iqamah: {
            enabled: true,
            type: "url",
            url: "http://example.com/iqamah.mp3",
          },
          preIqamah: { enabled: false },
        },
        sunrise: {
          adhan: { enabled: true, type: "file", path: "sunrise.mp3" },
        },
        dhuhr: {
          adhan: { enabled: true, type: "file", path: "dhuhr.mp3" },
        },
      },
    },
    prayers: {
      fajr: { iqamahOverride: false },
      dhuhr: { iqamahOverride: true, iqamahFixed: "13:00" },
    },
  };

  const mockPrayerData = {
    prayers: {
      fajr: "2023-05-01T05:00:00.000Z",
      sunrise: "2023-05-01T06:00:00.000Z",
      dhuhr: "2023-05-01T13:00:00.000Z",
      asr: "2023-05-01T17:00:00.000Z",
      maghrib: "2023-05-01T20:00:00.000Z",
      isha: "2023-05-01T21:30:00.000Z",
      iqamah: {
        fajr: "2023-05-01T05:30:00.000Z",
      },
    },
  };

  describe("getAutomationStatus", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Set "now" to 2023-05-01T12:00:00.000Z (midday)
      jest.useFakeTimers().setSystemTime(new Date("2023-05-01T12:00:00.000Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return status for all prayers", async () => {
      prayerTimeService.getPrayerTimes.mockResolvedValue(mockPrayerData);
      calculateIqamah.mockReturnValue("2023-05-01T13:15:00.000Z");

      const result = await service.getAutomationStatus(mockConfig);

      expect(result.fajr).toBeDefined();
      expect(result.sunrise).toBeDefined();
      expect(result.dhuhr).toBeDefined();
      expect(result.asr).toBeDefined();
      expect(result.maghrib).toBeDefined();
      expect(result.isha).toBeDefined();
    });

    it("should handle prayerTimeService failure", async () => {
      prayerTimeService.getPrayerTimes.mockRejectedValue(
        new Error("Fetch failed"),
      );
      const result = await service.getAutomationStatus(mockConfig);
      expect(result).toEqual({});
    });

    it("should handle missing prayer time in data", async () => {
      const incompleteData = { prayers: { fajr: "2023-05-01T05:00:00.000Z" } };
      prayerTimeService.getPrayerTimes.mockResolvedValue(incompleteData);
      const result = await service.getAutomationStatus(mockConfig);
      expect(result.sunrise.error).toBe("No time data");
    });

    it("should correctly identify PASSED and UPCOMING events", async () => {
      prayerTimeService.getPrayerTimes.mockResolvedValue(mockPrayerData);
      const result = await service.getAutomationStatus(mockConfig);

      // Fajr (05:00) is before now (12:00)
      expect(result.fajr.adhan.status).toBe("PASSED");
      // Dhuhr (13:00) is after now (12:00)
      expect(result.dhuhr.adhan.status).toBe("UPCOMING");
    });

    it("should handle different trigger types and details", async () => {
      prayerTimeService.getPrayerTimes.mockResolvedValue(mockPrayerData);
      const result = await service.getAutomationStatus(mockConfig);

      expect(result.fajr.adhan.details.type).toBe("file");
      expect(result.fajr.adhan.details.source).toBe("adhan.mp3");
      expect(result.fajr.adhan.details.targets).toBe("local");

      expect(result.fajr.preAdhan.details.type).toBe("tts");
      expect(result.fajr.preAdhan.details.source).toContain("Pre-adhan");

      expect(result.fajr.iqamah.details.type).toBe("url");
      expect(result.fajr.iqamah.details.source).toBe(
        "http://example.com/iqamah.mp3",
      );
    });

    it("should handle disabled triggers", async () => {
      prayerTimeService.getPrayerTimes.mockResolvedValue(mockPrayerData);
      const result = await service.getAutomationStatus(mockConfig);
      expect(result.fajr.preIqamah.status).toBe("DISABLED");
    });

    it("should handle iqamah override", async () => {
      prayerTimeService.getPrayerTimes.mockResolvedValue(mockPrayerData);
      calculateIqamah.mockReturnValue("2023-05-01T13:15:00.000Z");

      const configWithOverride = {
        ...mockConfig,
        automation: {
          triggers: {
            dhuhr: { iqamah: { enabled: true, type: "file" } },
          },
        },
      };

      await service.getAutomationStatus(configWithOverride);
      expect(calculateIqamah).toHaveBeenCalledWith(
        mockPrayerData.prayers.dhuhr,
        configWithOverride.prayers.dhuhr,
        "Europe/London",
      );
    });

    it("should handle missing time for preIqamah", async () => {
      const dataNoIqamah = { prayers: { fajr: "2023-05-01T05:00:00.000Z" } };
      prayerTimeService.getPrayerTimes.mockResolvedValue(dataNoIqamah);
      const configWithPreIqamah = {
        ...mockConfig,
        automation: {
          triggers: {
            fajr: { preIqamah: { enabled: true } },
          },
        },
        prayers: {}, // No prayer config means no iqamah calculation possible
      };
      const result = await service.getAutomationStatus(configWithPreIqamah);
      expect(result.fajr.preIqamah.status).toBe("ERROR");
      expect(result.fajr.preIqamah.error).toBe("Time calculation failed");
    });

    it("should handle long TTS templates in source detail", async () => {
      prayerTimeService.getPrayerTimes.mockResolvedValue(mockPrayerData);
      const longTemplate =
        "A very long template that exceeds thirty characters for testing purposes";
      const configLongTTS = {
        ...mockConfig,
        automation: {
          triggers: {
            fajr: {
              adhan: { enabled: true, type: "tts", template: longTemplate },
            },
          },
        },
      };
      const result = await service.getAutomationStatus(configLongTTS);
      expect(result.fajr.adhan.details.source).toBe(
        '"' + longTemplate.substring(0, 30) + '..."',
      );
    });

    it("should handle empty triggers or trigger types", async () => {
      prayerTimeService.getPrayerTimes.mockResolvedValue(mockPrayerData);
      const configEmpty = {
        ...mockConfig,
        automation: { triggers: { fajr: { adhan: { enabled: true } } } },
      };
      const result = await service.getAutomationStatus(configEmpty);
      expect(result.fajr.adhan.details.type).toBe("file");
      expect(result.fajr.adhan.details.source).toBe("No File");
    });

    it("should handle url type with missing url", async () => {
      prayerTimeService.getPrayerTimes.mockResolvedValue(mockPrayerData);
      const configNoUrl = {
        ...mockConfig,
        automation: {
          triggers: { fajr: { adhan: { enabled: true, type: "url" } } },
        },
      };
      const result = await service.getAutomationStatus(configNoUrl);
      expect(result.fajr.adhan.details.source).toBe("No URL");
    });

    it("should handle tts type with missing template", async () => {
      prayerTimeService.getPrayerTimes.mockResolvedValue(mockPrayerData);
      const configNoTpl = {
        ...mockConfig,
        automation: {
          triggers: { fajr: { adhan: { enabled: true, type: "tts" } } },
        },
      };
      const result = await service.getAutomationStatus(configNoTpl);
      expect(result.fajr.adhan.details.source).toBe("No Template");
    });
  });

  describe("getTTSStatus", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should handle DISABLED triggers", async () => {
      const config = {
        automation: { triggers: { fajr: { adhan: { enabled: false } } } },
      };
      const result = await service.getTTSStatus(config);
      expect(result.fajr.adhan.status).toBe("DISABLED");
    });

    it("should handle URL type", async () => {
      const config = {
        automation: {
          triggers: {
            fajr: { adhan: { enabled: true, type: "url", url: "http://test" } },
          },
        },
      };
      const result = await service.getTTSStatus(config);
      expect(result.fajr.adhan.status).toBe("URL");
      expect(result.fajr.adhan.detail).toBe("http://test");
    });

    it("should handle FILE type", async () => {
      const config = {
        automation: {
          triggers: {
            fajr: { adhan: { enabled: true, type: "file", path: "test.mp3" } },
          },
        },
      };
      const result = await service.getTTSStatus(config);
      expect(result.fajr.adhan.status).toBe("CUSTOM_FILE");
      expect(result.fajr.adhan.detail).toBe("test.mp3");
    });

    it("should handle missing file path for FILE type", async () => {
      const config = {
        automation: {
          triggers: { fajr: { adhan: { enabled: true, type: "file" } } },
        },
      };
      const result = await service.getTTSStatus(config);
      expect(result.fajr.adhan.detail).toBe("Unknown");
    });

    it("should handle TTS GENERATED status", async () => {
      const config = {
        automation: {
          triggers: {
            fajr: { adhan: { enabled: true, type: "tts", template: "Test" } },
          },
        },
      };
      fs.promises.access.mockResolvedValue();
      fs.promises.readFile.mockResolvedValue(
        JSON.stringify({ text: "Test", generatedAt: "now" }),
      );

      const result = await service.getTTSStatus(config);
      expect(result.fajr.adhan.status).toBe("GENERATED");
      expect(result.fajr.adhan.detail).toBe("now");
    });

    it("should handle TTS MISMATCH status", async () => {
      const config = {
        automation: {
          triggers: {
            fajr: { adhan: { enabled: true, type: "tts", template: "New" } },
          },
        },
      };
      fs.promises.access.mockResolvedValue();
      fs.promises.readFile.mockResolvedValue(
        JSON.stringify({ text: "Old", generatedAt: "now" }),
      );

      const result = await service.getTTSStatus(config);
      expect(result.fajr.adhan.status).toBe("MISMATCH");
    });

    it("should handle TTS MISSING status (ENOENT)", async () => {
      const config = {
        automation: {
          triggers: {
            fajr: { adhan: { enabled: true, type: "tts", template: "Test" } },
          },
        },
      };
      fs.promises.access.mockRejectedValue({ code: "ENOENT" });

      const result = await service.getTTSStatus(config);
      expect(result.fajr.adhan.status).toBe("MISSING");
    });

    it("should handle TTS ERROR status (other errors)", async () => {
      const config = {
        automation: {
          triggers: {
            fajr: { adhan: { enabled: true, type: "tts", template: "Test" } },
          },
        },
      };
      fs.promises.access.mockRejectedValue(new Error("Access Denied"));

      const result = await service.getTTSStatus(config);
      expect(result.fajr.adhan.status).toBe("ERROR");
    });

    it("should handle UNKNOWN trigger type", async () => {
      const config = {
        automation: {
          triggers: { fajr: { adhan: { enabled: true, type: "ghost" } } },
        },
      };
      const result = await service.getTTSStatus(config);
      expect(result.fajr.adhan.status).toBe("UNKNOWN");
    });
  });
});
