const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");

// Mock asyncLock BEFORE requiring service
jest.mock("@utils/asyncLock", () => ({
  run: jest.fn((key, fn) => fn()),
}));

const service = require("@services/core/prayerTimeService");
const { ProviderFactory, ProviderValidationError } = require("@providers");
const { DateTime } = require("luxon");
const calculations = require("@utils/calculations");

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    utimes: jest.fn(),
  },
}));

jest.mock("@providers", () => {
  const original = jest.requireActual("@providers");
  return {
    ...original,
    ProviderFactory: {
      create: jest.fn(),
    },
    ProviderValidationError: original.ProviderValidationError,
  };
});

jest.mock("@utils/calculations", () => ({
  calculateIqamah: jest.fn(),
  calculateNextPrayer: jest.fn(),
}));

describe("PrayerTimeService Comprehensive", () => {
  const mockConfig = {
    location: { timezone: "UTC" },
    sources: {
      primary: { type: "aladhan" },
      backup: { enabled: true, type: "mymasjid" },
    },
    prayers: {
      fajr: { iqamahOffset: 10, iqamahOverride: true },
      dhuhr: { iqamahOffset: 10 },
      asr: { iqamahOffset: 10 },
      maghrib: { iqamahOffset: 10 },
      isha: { iqamahOffset: 10 },
    },
  };

  const createRawPrayerData = (dateKey) => ({
    meta: {
      date: dateKey,
      source: "test-source",
      cached: true,
    },
    prayers: {
      fajr: `${dateKey}T05:00:00.000Z`,
      sunrise: `${dateKey}T06:30:00.000Z`,
      dhuhr: `${dateKey}T12:00:00.000Z`,
      asr: `${dateKey}T15:30:00.000Z`,
      maghrib: `${dateKey}T18:00:00.000Z`,
      isha: `${dateKey}T19:30:00.000Z`,
      iqamah: {
        fajr: `${dateKey}T05:15:00.000Z`,
        dhuhr: `${dateKey}T12:15:00.000Z`,
        asr: `${dateKey}T15:45:00.000Z`,
        maghrib: `${dateKey}T18:10:00.000Z`,
        isha: `${dateKey}T19:45:00.000Z`,
      },
    },
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("should cover all branches", async () => {
    // --- 1. readCache branches ---
    fsp.access.mockResolvedValue();
    fsp.readFile.mockResolvedValueOnce("invalid"); // corrupted
    const spyWarn1 = jest.spyOn(console, "warn").mockImplementation();
    await service.readCache();
    expect(spyWarn1).toHaveBeenCalledWith(expect.stringContaining("corrupted"));

    fsp.readFile.mockRejectedValueOnce(new Error("ENOENT")); // not found
    await service.readCache();
    spyWarn1.mockRestore();

    // --- 2. getPrayerTimes: Remote fetch success ---
    const d1 = DateTime.fromISO("2080-01-01");
    const k1 = "2080-01-01";
    fsp.access.mockRejectedValue({ code: "ENOENT" }); // disk miss
    ProviderFactory.create.mockReturnValue({
      getAnnualTimes: jest.fn().mockResolvedValue({ [k1]: { fajr: "T" } }),
    });
    fsp.writeFile.mockResolvedValue();
    const res1 = await service.getPrayerTimes(mockConfig, d1);
    expect(res1.meta.cached).toBe(false);

    // --- 3. getPrayerTimes: Memory hit ---
    const res2 = await service.getPrayerTimes(mockConfig, d1);
    expect(res2.meta.cached).toBe(true);

    // --- 4. getPrayerTimes: Disk hit ---
    const d2 = DateTime.fromISO("2080-01-02");
    const k2 = "2080-01-02";
    fsp.access.mockResolvedValue();
    fsp.readFile.mockResolvedValue(
      JSON.stringify({
        meta: { source: "disk" },
        data: { [k2]: { fajr: "D" } },
      }),
    );
    const res3 = await service.getPrayerTimes(mockConfig, d2);
    expect(res3.meta.cached).toBe(true);

    // --- 5. Failover to Backup ---
    const d3 = DateTime.fromISO("2080-01-03");
    const k3 = "2080-01-03";
    fsp.access.mockRejectedValue({ code: "ENOENT" });
    ProviderFactory.create
      .mockReturnValueOnce({
        getAnnualTimes: jest.fn().mockRejectedValue(new Error("P")),
      })
      .mockReturnValueOnce({
        getAnnualTimes: jest.fn().mockResolvedValue({ [k3]: { fajr: "B" } }),
      });
    const spyErr1 = jest.spyOn(console, "error").mockImplementation();
    const res4 = await service.getPrayerTimes(mockConfig, d3);
    expect(res4.meta.source).toBe("mymasjid");
    spyErr1.mockRestore();

    // --- 6. ProviderValidationError ---
    const d4 = DateTime.fromISO("2080-01-04");
    ProviderFactory.create.mockReturnValueOnce({
      getAnnualTimes: jest
        .fn()
        .mockRejectedValue(new ProviderValidationError("V")),
    });
    const spyErr2 = jest.spyOn(console, "error").mockImplementation();
    await expect(service.getPrayerTimes(mockConfig, d4)).rejects.toThrow(
      ProviderValidationError,
    );
    spyErr2.mockRestore();

    // --- 7. Primary returns empty, and backup also fails ---
    const d5 = DateTime.fromISO("2080-01-05");
    const configNoBackup = {
      ...mockConfig,
      sources: { primary: { type: "aladhan" }, backup: { enabled: false } },
    };
    ProviderFactory.create.mockReturnValueOnce({
      getAnnualTimes: jest.fn().mockResolvedValue({}),
    });
    const spyErr3 = jest.spyOn(console, "error").mockImplementation();
    await expect(service.getPrayerTimes(configNoBackup, d5)).rejects.toThrow(
      "returned empty data",
    );
    spyErr3.mockRestore();

    // --- 8. Date missing in response ---
    const d6 = DateTime.fromISO("2080-01-06");
    ProviderFactory.create.mockReturnValueOnce({
      getAnnualTimes: jest.fn().mockResolvedValue({ other: {} }),
    });
    await expect(service.getPrayerTimes(mockConfig, d6)).rejects.toThrow(
      "not found in bulk response",
    );

    // --- 9. applyOverrides calc error ---
    const d7 = DateTime.fromISO("2080-01-07");
    fsp.access.mockResolvedValue();
    fsp.readFile.mockResolvedValue(
      JSON.stringify({
        meta: { source: "s" },
        data: { "2080-01-07": { fajr: "T" } },
      }),
    );
    calculations.calculateIqamah.mockImplementationOnce(() => {
      throw new Error("E");
    });
    const spyWarn2 = jest.spyOn(console, "warn").mockImplementation();
    await service.getPrayerTimes(mockConfig, d7);
    expect(spyWarn2).toHaveBeenCalled();
    spyWarn2.mockRestore();

    // --- 10. getPrayersWithNext: Missing prayer warning ---
    const d8 = DateTime.fromISO("2080-01-08");
    jest.useFakeTimers().setSystemTime(d8.toJSDate());
    fsp.access.mockResolvedValue();
    fsp.readFile.mockResolvedValue(
      JSON.stringify({
        meta: { source: "s" },
        data: { "2080-01-08": { fajr: "T" } },
      }),
    );
    const spyWarn3 = jest.spyOn(console, "warn").mockImplementation();
    await service.getPrayersWithNext(mockConfig, "UTC");
    expect(spyWarn3).toHaveBeenCalled();
    spyWarn3.mockRestore();

    // --- 11. Tomorrow Fajr Success ---
    const d9 = DateTime.fromISO("2080-01-09");
    const k9 = "2080-01-09";
    const k10 = "2080-01-10";
    jest.setSystemTime(d9.toJSDate());
    calculations.calculateNextPrayer.mockReturnValue(null);
    fsp.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          meta: { source: "s" },
          data: { [k9]: { fajr: "T1" } },
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          meta: { source: "s" },
          data: { [k10]: { fajr: "T2" } },
        }),
      );
    const res5 = await service.getPrayersWithNext(mockConfig, "UTC");
    expect(res5.nextPrayer.isTomorrow).toBe(true);
    jest.useRealTimers();

    // --- 12. Tomorrow Fajr Fail ---
    const d11 = DateTime.fromISO("2080-01-11");
    jest.useFakeTimers().setSystemTime(d11.toJSDate());
    fsp.readFile
      .mockResolvedValueOnce(
        JSON.stringify({
          meta: { source: "s" },
          data: { "2080-01-11": { fajr: "T1" } },
        }),
      )
      .mockRejectedValueOnce(new Error("Fail"));
    const spyErr4 = jest.spyOn(console, "error").mockImplementation();
    await service.getPrayersWithNext(mockConfig, "UTC");
    expect(spyErr4).toHaveBeenCalled();
    spyErr4.mockRestore();
    jest.useRealTimers();

    // --- 13. forceRefresh ---
    fsp.unlink.mockResolvedValue();
    ProviderFactory.create.mockReturnValue({
      getAnnualTimes: jest
        .fn()
        .mockResolvedValue({ [DateTime.now().toISODate()]: { fajr: "T" } }),
    });
    await service.forceRefresh(mockConfig);
    expect(fsp.unlink).toHaveBeenCalled();
  });

  describe("getPrayerCalendarWindow", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns a 15-day calendar window centered on today by default", async () => {
      const now = DateTime.fromISO("2080-01-08T12:00:00.000Z");
      jest.useFakeTimers().setSystemTime(now.toJSDate());

      const getPrayerTimesSpy = jest
        .spyOn(service, "getPrayerTimes")
        .mockImplementation(async (_config, date) => {
          return createRawPrayerData(date.toISODate());
        });

      const calendar = await service.getPrayerCalendarWindow(mockConfig, "UTC");
      const dates = Object.keys(calendar);

      expect(dates).toHaveLength(15);
      expect(dates[0]).toBe("2080-01-01");
      expect(dates[7]).toBe("2080-01-08");
      expect(dates[14]).toBe("2080-01-15");
      expect(calendar["2080-01-08"].dhuhr.start).toBe(
        "2080-01-08T12:00:00.000Z",
      );
      expect(getPrayerTimesSpy).toHaveBeenCalledTimes(15);
    });

    it("returns the next seven days after a future cursor", async () => {
      const getPrayerTimesSpy = jest
        .spyOn(service, "getPrayerTimes")
        .mockImplementation(async (_config, date) => {
          return createRawPrayerData(date.toISODate());
        });

      const calendar = await service.getPrayerCalendarWindow(
        mockConfig,
        "UTC",
        {
          cursorDate: "2080-01-15",
          direction: "future",
        },
      );

      expect(Object.keys(calendar)).toEqual([
        "2080-01-16",
        "2080-01-17",
        "2080-01-18",
        "2080-01-19",
        "2080-01-20",
        "2080-01-21",
        "2080-01-22",
      ]);
      expect(getPrayerTimesSpy).toHaveBeenCalledTimes(7);
    });

    it("returns the previous seven days before a past cursor", async () => {
      const getPrayerTimesSpy = jest
        .spyOn(service, "getPrayerTimes")
        .mockImplementation(async (_config, date) => {
          return createRawPrayerData(date.toISODate());
        });

      const calendar = await service.getPrayerCalendarWindow(
        mockConfig,
        "UTC",
        {
          cursorDate: "2080-01-15",
          direction: "past",
        },
      );

      expect(Object.keys(calendar)).toEqual([
        "2080-01-08",
        "2080-01-09",
        "2080-01-10",
        "2080-01-11",
        "2080-01-12",
        "2080-01-13",
        "2080-01-14",
      ]);
      expect(getPrayerTimesSpy).toHaveBeenCalledTimes(7);
    });

    it("returns the available consecutive previous days before stopping at the first missing day", async () => {
      const getPrayerTimesSpy = jest
        .spyOn(service, "getPrayerTimes")
        .mockImplementation(async (_config, date) => {
          const dateKey = date.toISODate();

          if (dateKey === "2080-01-01") {
            return createRawPrayerData(dateKey);
          }

          throw new Error("Year unavailable");
        });

      const calendar = await service.getPrayerCalendarWindow(
        mockConfig,
        "UTC",
        {
          cursorDate: "2080-01-02",
          direction: "past",
        },
      );

      expect(Object.keys(calendar)).toEqual(["2080-01-01"]);
      expect(calendar["2080-01-01"].fajr.start).toBe(
        "2080-01-01T05:00:00.000Z",
      );
      expect(getPrayerTimesSpy).toHaveBeenCalledTimes(2);
      expect(getPrayerTimesSpy.mock.calls[0][1].toISODate()).toBe("2080-01-01");
      expect(getPrayerTimesSpy.mock.calls[1][1].toISODate()).toBe("2079-12-31");
    });

    it("returns an empty calendar when a directional chunk cannot be fetched", async () => {
      jest
        .spyOn(service, "getPrayerTimes")
        .mockRejectedValue(new Error("Year unavailable"));

      const calendar = await service.getPrayerCalendarWindow(
        mockConfig,
        "UTC",
        {
          cursorDate: "2080-12-31",
          direction: "future",
        },
      );

      expect(calendar).toEqual({});
    });
  });
});
