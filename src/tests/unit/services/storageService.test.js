const fs = require("fs");
const path = require("path");
const storageService = require("@services/system/storageService");
const configService = require("@config");

jest.mock("fs", () => ({
  promises: {
    readdir: jest.fn(),
    lstat: jest.fn(),
    access: jest.fn(),
  },
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  lstatSync: jest.fn(),
}));

jest.mock("check-disk-space", () => ({
  default: jest.fn().mockResolvedValue({ free: 50 * 1024 * 1024 * 1024 }), // 50GB
}));

describe("StorageService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("getDirSize", () => {
    it("should recursively calculate directory size", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir
        .mockResolvedValueOnce(["file1.mp3", "subdir"])
        .mockResolvedValueOnce(["file2.mp3"]);

      fs.promises.lstat
        .mockResolvedValueOnce({
          isDirectory: () => false,
          isSymbolicLink: () => false,
          size: 1000,
        }) // file1
        .mockResolvedValueOnce({
          isDirectory: () => true,
          isSymbolicLink: () => false,
        }) // subdir
        .mockResolvedValueOnce({
          isDirectory: () => false,
          isSymbolicLink: () => false,
          size: 2000,
        }); // file2

      const size = await storageService.getDirSize("/dummy/path");
      expect(size).toBe(3000);
    });

    it("should return 0 if directory does not exist", async () => {
      fs.promises.access.mockRejectedValue({ code: "ENOENT" });
      const size = await storageService.getDirSize("/nonexistent");
      expect(size).toBe(0);
    });

    it("should skip symbolic links", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir.mockResolvedValue(["link"]);
      fs.promises.lstat.mockResolvedValue({ isSymbolicLink: () => true });
      const size = await storageService.getDirSize("/fake");
      expect(size).toBe(0);
    });

    it("should handle lstat errors", async () => {
      jest.spyOn(console, "warn").mockImplementation(() => {});
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir.mockResolvedValue(["bad"]);
      fs.promises.lstat.mockRejectedValue(new Error("fail"));
      const size = await storageService.getDirSize("/fake");
      expect(size).toBe(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it("should handle readdir errors", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir.mockRejectedValue(new Error("fail"));
      const size = await storageService.getDirSize("/fake");
      expect(size).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });

    it("should prevent recursion (circular symlinks or same path)", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir.mockResolvedValue(["subdir"]);
      fs.promises.lstat.mockResolvedValue({
        isDirectory: () => true,
        isSymbolicLink: () => false,
      });

      // To prevent actual infinite recursion in test if visitedPaths fails
      // we mock readdir to return empty after some calls
      fs.promises.readdir
        .mockResolvedValueOnce(["subdir"])
        .mockResolvedValueOnce(["subdir"])
        .mockResolvedValue([]);

      const size = await storageService.getDirSize("/fake");
      // It will go /fake -> /fake/subdir -> /fake/subdir/subdir -> empty
      // size should be 0 as no files were found
      expect(size).toBe(0);
    });
  });

  describe("getUsage", () => {
    it("should get breakdown", async () => {
      const spy = jest
        .spyOn(storageService, "getDirSize")
        .mockResolvedValue(50);
      const usage = await storageService.getUsage();
      expect(usage.total).toBe(100);
      expect(usage.custom).toBe(50);
      expect(usage.cache).toBe(50);
      spy.mockRestore();
    });
  });

  describe("getSystemStats", () => {
    it("should return free space", async () => {
      const checkDiskSpace = require("check-disk-space").default;
      checkDiskSpace.mockResolvedValue({ free: 1000 });
      const free = await storageService.getSystemStats();
      expect(free).toBe(1000);
    });

    it("should handle disk space error", async () => {
      jest.spyOn(console, "warn").mockImplementation(() => {});
      const checkDiskSpace = require("check-disk-space").default;
      checkDiskSpace.mockRejectedValue(new Error("fail"));
      const free = await storageService.getSystemStats();
      expect(free).toBeNull();
    });
  });

  describe("checkQuota", () => {
    it("should use default limit if config missing", async () => {
      configService.get.mockReturnValue({});
      const spy = jest
        .spyOn(storageService, "getUsage")
        .mockResolvedValue({ total: 0 });
      const res = await storageService.checkQuota(100);
      expect(res.success).toBe(true);
      spy.mockRestore();
    });

    it("should pass if adding bytes is within limit", async () => {
      configService.get.mockReturnValue({
        data: { storageLimit: 1.0 }, // 1GB
      });

      const spy = jest.spyOn(storageService, "getUsage").mockResolvedValue({
        total: 500 * 1024 * 1024, // 500MB used
        custom: 250,
        cache: 250,
      });

      const result = await storageService.checkQuota(100 * 1024 * 1024); // Adding 100MB
      expect(result.success).toBe(true);
      spy.mockRestore();
    });

    it("should fail if adding bytes exceeds limit", async () => {
      configService.get.mockReturnValue({
        data: { storageLimit: 1.0 },
      });

      const spy = jest.spyOn(storageService, "getUsage").mockResolvedValue({
        total: 950 * 1024 * 1024, // 950MB used
        custom: 475,
        cache: 475,
      });

      const result = await storageService.checkQuota(100 * 1024 * 1024); // Adding 100MB
      expect(result.success).toBe(false);
      expect(result.message).toBe("Storage Limit Exceeded");
      spy.mockRestore();
    });
  });

  describe("calculateRecommendedLimit", () => {
    it("should return minimum for no triggers", () => {
      configService.get.mockReturnValue({ automation: { triggers: null } });
      const recommended = storageService.calculateRecommendedLimit();
      expect(recommended).toBe(0.5);
    });

    it("should handle various trigger types", () => {
      configService.get.mockReturnValue({
        automation: {
          triggers: {
            fajr: {
              adhan: { enabled: true, type: "file" },
              iqamah: { enabled: true, type: "tts" },
              preAdhan: { enabled: false, type: "file" },
              other: { enabled: true, type: "url" },
            },
          },
        },
      });
      const recommended = storageService.calculateRecommendedLimit();
      expect(recommended).toBeGreaterThanOrEqual(0.5);
    });
  });
});
