const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const axios = require("axios");
const audioValidator = require("@utils/audioValidator");

// Mock dependencies BEFORE requiring the service
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    copyFile: jest.fn(),
    rename: jest.fn(),
    utimes: jest.fn(),
  },
}));

jest.mock("@utils/audioValidator", () => ({
  analyseAudioFile: jest
    .fn()
    .mockResolvedValue({ format: "mp3", duration: 10 }),
}));

const mockHealth = { tts: { healthy: true } };
jest.mock("@services/system/healthCheck", () => ({
  refresh: jest.fn().mockImplementation(() => Promise.resolve(mockHealth)),
}));

const mockStorageService = {
  checkQuota: jest.fn().mockResolvedValue({ success: true }),
};
jest.mock("@services/system/storageService", () => mockStorageService);

jest.mock("@outputs", () => ({
  getAllStrategyInstances: jest.fn().mockReturnValue([
    {
      constructor: { getMetadata: () => ({ id: "local" }) },
      validateAsset: jest.fn().mockResolvedValue(true),
      augmentAudioMetadata: jest
        .fn()
        .mockReturnValue({ localCompatible: true }),
    },
  ]),
}));

const service = require("@services/system/audioAssetService");
const configService = require("@config");

describe("AudioAssetService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHealth.tts.healthy = true;
    mockStorageService.checkQuota.mockResolvedValue({ success: true });
    configService.get.mockReturnValue({
      location: { timezone: "UTC" },
      automation: {
        pythonServiceUrl: "http://localhost:8000",
        triggers: {
          fajr: {
            azan: {
              enabled: true,
              type: "tts",
              template: "Fajr Azan",
              offsetMinutes: 0,
            },
          },
        },
      },
    });
  });

  describe("ensureDirs", () => {
    it("should create directories if they do not exist", async () => {
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      fsp.mkdir.mockResolvedValue();
      await service.syncAudioAssets();
      expect(fsp.mkdir).toHaveBeenCalled();
    });
  });

  describe("enrichMetadata", () => {
    it("should return enriched metadata with compatibility block", async () => {
      const basic = { format: "mp3", duration: 10 };
      const result = await service.enrichMetadata("path/to/audio", basic);
      expect(result.compatibility.local).toBe(true);
      // expect(result.localCompatible).toBe(true); // REQ-015: Legacy removed
    });
  });

  describe("cleanupCache", () => {
    it("should delete old files and their metadata", async () => {
      const now = Date.now();
      fsp.readdir.mockResolvedValue(["old.mp3", "new.mp3"]);
      fsp.stat.mockImplementation((file) => {
        if (file.includes("old.mp3"))
          return Promise.resolve({ mtimeMs: now - 31 * 24 * 60 * 60 * 1000 });
        return Promise.resolve({ mtimeMs: now });
      });
      fsp.access.mockResolvedValue();
      fsp.unlink.mockResolvedValue();

      await service.cleanupCache();
      expect(fsp.unlink).toHaveBeenCalledWith(
        expect.stringContaining("old.mp3"),
      );
      expect(fsp.unlink).toHaveBeenCalledWith(
        expect.stringContaining("old.mp3.json"),
      );
    });

    it("should handle missing metadata during cleanup", async () => {
      const now = Date.now();
      fsp.readdir.mockResolvedValue(["old.mp3"]);
      fsp.stat.mockResolvedValue({ mtimeMs: now - 31 * 24 * 60 * 60 * 1000 });
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      fsp.unlink.mockResolvedValue();
      await service.cleanupCache();
      expect(fsp.unlink).toHaveBeenCalledWith(
        expect.stringContaining("old.mp3"),
      );
    });

    it("should log error on failure", async () => {
      fsp.readdir.mockRejectedValue(new Error("Read error"));
      const spy = jest.spyOn(console, "error").mockImplementation();
      await service.cleanupCache();
      expect(spy).toHaveBeenCalledWith(
        "[AudioService] Cache cleanup failed:",
        "Read error",
      );
      spy.mockRestore();
    });
  });

  describe("cleanupTempAudio", () => {
    it("should return if temp dir is missing", async () => {
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      await service.cleanupTempAudio();
      expect(fsp.readdir).not.toHaveBeenCalled();
    });

    it("should delete files when forced", async () => {
      fsp.access.mockResolvedValue();
      fsp.readdir.mockResolvedValue(["temp1.mp3", "not_audio.txt"]);
      fsp.stat.mockResolvedValue({ mtimeMs: Date.now() });
      fsp.unlink.mockResolvedValue();
      await service.cleanupTempAudio(true);
      expect(fsp.unlink).toHaveBeenCalledWith(
        expect.stringContaining("temp1.mp3"),
      );
    });

    it("should only delete old files when not forced", async () => {
      fsp.access.mockResolvedValue();
      fsp.readdir.mockResolvedValue(["old.mp3", "new.mp3"]);
      fsp.stat.mockImplementation((file) => {
        if (file.includes("old.mp3"))
          return Promise.resolve({ mtimeMs: Date.now() - 2 * 60 * 60 * 1000 });
        return Promise.resolve({ mtimeMs: Date.now() });
      });
      fsp.unlink.mockResolvedValue();
      await service.cleanupTempAudio(false);
      expect(fsp.unlink).toHaveBeenCalledTimes(1);
      expect(fsp.unlink).toHaveBeenCalledWith(
        expect.stringContaining("old.mp3"),
      );
    });

    it("should log error on readdir failure", async () => {
      fsp.access.mockResolvedValue();
      fsp.readdir.mockRejectedValue(new Error("Readdir failed"));
      const spy = jest.spyOn(console, "error").mockImplementation();
      await service.cleanupTempAudio();
      expect(spy).toHaveBeenCalledWith(
        "[AudioService] Temp cleanup failed:",
        "Readdir failed",
      );
      spy.mockRestore();
    });
  });

  describe("resolveTemplate", () => {
    it("should resolve all placeholders", () => {
      const template =
        "It is {prayerEnglish} time ({prayerArabic}). {minutes} minutes.";
      const result = service.resolveTemplate(template, "fajr", 5);
      expect(result).toBe("It is Fajr time (فجر). five minutes.");
    });

    it("should handle unknown prayer for Arabic name", () => {
      const result = service.resolveTemplate("{prayerArabic}", "ghost");
      expect(result).toBe("ghost");
    });
  });

  describe("ensureTTSFile", () => {
    const settings = {
      template: "Test {prayerEnglish}",
      offsetMinutes: 0,
      voice: "custom-voice",
    };
    const config = { automation: { pythonServiceUrl: "http://test" } };

    it("should skip generation if valid file exists", async () => {
      fsp.access.mockResolvedValue();
      fsp.readFile.mockResolvedValue(
        JSON.stringify({ text: "Test Fajr", voice: "custom-voice" }),
      );
      fsp.utimes.mockResolvedValue();
      const result = await service.ensureTTSFile(
        "fajr",
        "azan",
        settings,
        config,
      );
      expect(result.generated).toBe(false);
    });

    it("should return error if TTS service is offline", async () => {
      mockHealth.tts.healthy = false;
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      const result = await service.ensureTTSFile(
        "fajr",
        "azan",
        settings,
        config,
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("TTS Service Offline");
    });

    it("should throw error if quota exceeded", async () => {
      mockStorageService.checkQuota.mockResolvedValue({
        success: false,
        message: "Full",
      });
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      await expect(
        service.ensureTTSFile("fajr", "azan", settings, config),
      ).rejects.toThrow("Storage Limit Exceeded: Full");
    });

    it("should handle generation failure", async () => {
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      axios.post.mockRejectedValue(new Error("Network error"));
      const result = await service.ensureTTSFile(
        "fajr",
        "azan",
        settings,
        config,
      );
      expect(result.success).toBe(false);
      expect(result.message).toBe("Network error");
    });

    it("should successfully generate and write metadata", async () => {
      fsp.access.mockImplementation((p) => {
        if (p.includes("cache")) return Promise.reject({ code: "ENOENT" });
        return Promise.resolve();
      });
      axios.post.mockResolvedValue({ data: {} });
      fsp.writeFile.mockResolvedValue();
      const result = await service.ensureTTSFile(
        "fajr",
        "azan",
        settings,
        config,
      );
      expect(result.success).toBe(true);
      expect(fsp.writeFile).toHaveBeenCalled();
    });
  });

  describe("syncAudioAssets", () => {
    it("should handle forceClean", async () => {
      fsp.access.mockResolvedValue();
      fsp.readdir.mockResolvedValue(["cache1.mp3"]);
      fsp.unlink.mockResolvedValue();
      await service.syncAudioAssets(true);
      expect(fsp.unlink).toHaveBeenCalledWith(
        expect.stringContaining("cache1.mp3"),
      );
    });

    it("should return empty warnings if triggers missing", async () => {
      configService.get.mockReturnValue({});
      const result = await service.syncAudioAssets();
      expect(result.warnings).toEqual([]);
    });

    it("should collect warnings on individual failures", async () => {
      configService.get.mockReturnValue({
        automation: {
          triggers: {
            fajr: { adhan: { enabled: true, type: "tts", template: "T" } },
          },
        },
      });
      mockHealth.tts.healthy = false;
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      const result = await service.syncAudioAssets();
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should collect warnings on unexpected errors (REQ-003)", async () => {
      configService.get.mockReturnValue({
        automation: {
          triggers: {
            fajr: { adhan: { enabled: true, type: "tts", template: "T" } },
          },
        },
      });
      mockStorageService.checkQuota.mockRejectedValue(new Error("Fatal"));
      fsp.access.mockRejectedValue({ code: "ENOENT" });

      const result = await service.syncAudioAssets();
      expect(result.warnings).toContain("Fajr Adhan: Fatal");
    });
  });

  describe("ensureTestAudio", () => {
    it("should return if test audio already exists", async () => {
      fsp.access.mockResolvedValue();
      await service.ensureTestAudio();
      expect(axios.post).not.toHaveBeenCalled();
    });

    it("should generate and move test audio if missing", async () => {
      fsp.access.mockImplementation((p) => {
        if (
          p.includes("custom") &&
          (p.includes("test.mp3") || p.includes("test.mp3.json"))
        )
          return Promise.reject({ code: "ENOENT" });
        if (p.includes("cache")) return Promise.resolve();
        return Promise.resolve();
      });
      axios.post.mockResolvedValue({});
      fsp.copyFile.mockResolvedValue();
      fsp.unlink.mockResolvedValue();
      fsp.writeFile.mockResolvedValue();

      await service.ensureTestAudio();
      expect(axios.post).toHaveBeenCalled();
      expect(fsp.copyFile).toHaveBeenCalled();
    });

    it("should use rename fallback if copyFile fails", async () => {
      fsp.access.mockImplementation((p) => {
        if (
          p.includes("custom") &&
          (p.includes("test.mp3") || p.includes("test.mp3.json"))
        )
          return Promise.reject({ code: "ENOENT" });
        if (p.includes("cache")) return Promise.resolve();
        return Promise.resolve();
      });
      axios.post.mockResolvedValue({});
      fsp.copyFile.mockRejectedValue(new Error("Cross-device link"));
      fsp.rename.mockResolvedValue();
      fsp.writeFile.mockResolvedValue();
      await service.ensureTestAudio();
      expect(fsp.rename).toHaveBeenCalled();
    });

    it("should handle cache file missing after generation", async () => {
      fsp.access.mockImplementation((p) => {
        if (
          p.includes("custom") &&
          (p.includes("test.mp3") || p.includes("test.mp3.json"))
        )
          return Promise.reject({ code: "ENOENT" });
        if (p.includes("cache")) return Promise.reject({ code: "ENOENT" });
        return Promise.resolve();
      });
      axios.post.mockResolvedValue({});
      const spy = jest.spyOn(console, "error").mockImplementation();
      await service.ensureTestAudio();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Cache file missing after generation"),
      );
      spy.mockRestore();
    });

    it("should handle generation failure in ensureTestAudio", async () => {
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      axios.post.mockRejectedValue(new Error("TTS Failed"));
      const spy = jest.spyOn(console, "error").mockImplementation();
      await service.ensureTestAudio();
      expect(spy).toHaveBeenCalledWith(
        "[AudioService] Failed to generate test audio:",
        "TTS Failed",
      );
      spy.mockRestore();
    });
  });

  describe("previewTTS", () => {
    it("should return existing preview if not expired", async () => {
      fsp.access.mockResolvedValue();
      fsp.stat.mockResolvedValue({ mtimeMs: Date.now() });
      fsp.utimes.mockResolvedValue();
      const result = await service.previewTTS("Tpl", "fajr", 0, "voice");
      expect(result.url).toBeDefined();
    });

    it("should generate new preview if missing", async () => {
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      axios.post.mockResolvedValue({ data: { url: "new_url" } });
      const result = await service.previewTTS("Tpl", "fajr", 0, "voice");
      expect(result.url).toBe("new_url");
    });

    it("should handle preview generation failure", async () => {
      fsp.access.mockRejectedValue({ code: "ENOENT" });
      axios.post.mockRejectedValue(new Error("Preview failed"));
      const spy = jest.spyOn(console, "error").mockImplementation();
      await expect(service.previewTTS("T", "fajr", 0, "v")).rejects.toThrow(
        "Preview failed",
      );
      expect(spy).toHaveBeenCalledWith(
        "[AudioService] Preview generation failed:",
        "Preview failed",
      );
      spy.mockRestore();
    });
  });

  describe("generateMetadataForExistingFiles", () => {
    it("should generate metadata for files lacking it", async () => {
      fsp.access.mockImplementation((p) => {
        if (p.includes("custom") && p.endsWith(".json"))
          return Promise.reject({ code: "ENOENT" });
        if (p.includes("cache") && p.endsWith(".json"))
          return Promise.resolve();
        return Promise.resolve();
      });
      fsp.readdir.mockResolvedValue(["file1.mp3"]);
      fsp.readFile.mockResolvedValue(JSON.stringify({ some: "data" }));
      fsp.writeFile.mockResolvedValue();
      await service.generateMetadataForExistingFiles();
      expect(fsp.writeFile).toHaveBeenCalled();
    });

    it("should handle existing legacy metadata correctly", async () => {
      fsp.access.mockImplementation((p) => {
        if (p.includes("custom") && p.endsWith(".json"))
          return Promise.reject({ code: "ENOENT" });
        if (p.includes("azan.mp3.json")) return Promise.resolve();
        return Promise.resolve();
      });
      fsp.readdir.mockResolvedValue(["azan.mp3"]);
      fsp.readFile.mockResolvedValue(JSON.stringify({ legacy: true }));
      fsp.writeFile.mockResolvedValue();
      fsp.unlink.mockResolvedValue();
      await service.generateMetadataForExistingFiles();
      expect(fsp.writeFile).toHaveBeenCalled();
      expect(fsp.unlink).toHaveBeenCalled();
    });

    it("should handle metadata generation errors for individual files", async () => {
      fsp.access.mockImplementation((p) => {
        if (p.endsWith(".json")) return Promise.reject({ code: "ENOENT" });
        return Promise.resolve();
      });
      fsp.readdir.mockResolvedValue(["error.mp3"]);
      audioValidator.analyseAudioFile.mockRejectedValue(
        new Error("Analyse fail"),
      );
      const spy = jest.spyOn(console, "error").mockImplementation();
      await service.generateMetadataForExistingFiles();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("Metadata generation failed for error.mp3"),
        "Analyse fail",
      );
      spy.mockRestore();
    });

    it("should skip directory if inaccessible", async () => {
      fsp.access.mockRejectedValue(new Error("No access"));
      await service.generateMetadataForExistingFiles();
      expect(fsp.readdir).not.toHaveBeenCalled();
    });
  });
});
