const fs = require("fs");
const path = require("path");
const assetMigrationService = require("@services/system/assetMigrationService");
const audioValidator = require("@utils/audioValidator");
const OutputFactory = require("@outputs");

jest.mock("fs", () => ({
  promises: {
    readdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
  },
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock("@utils/audioValidator");
jest.mock("@outputs");

describe("AssetMigrationService", () => {
  let mockStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStrategy = {
      constructor: {
        getMetadata: () => ({ id: "voicemonkey" }),
      },
      validateAsset: jest.fn().mockResolvedValue({ valid: true }),
    };
    OutputFactory.getAllStrategyInstances.mockReturnValue([mockStrategy]);
  });

  describe("migrateAll", () => {
    it("should scan custom and cache directories", async () => {
      fs.promises.access.mockResolvedValue(undefined); // Directory exists
      fs.promises.readdir.mockResolvedValue([]); // No files

      await assetMigrationService.migrateAll();

      expect(fs.promises.readdir).toHaveBeenCalledTimes(2);
    });

    it("should process files and update metadata if compatibility block is missing", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir
        .mockResolvedValueOnce(["test.mp3"])
        .mockResolvedValueOnce([]);

      const existingMeta = { format: "mp3", bitrate: 128 };
      fs.promises.readFile.mockResolvedValue(JSON.stringify(existingMeta));

      await assetMigrationService.migrateAll();

      expect(mockStrategy.validateAsset).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it("should re-analyse file if basic metadata is missing", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir
        .mockResolvedValueOnce(["test.mp3"])
        .mockResolvedValueOnce([]);

      const existingMeta = {}; // Missing format/bitrate
      fs.promises.readFile.mockResolvedValue(JSON.stringify(existingMeta));
      audioValidator.analyseAudioFile.mockResolvedValue({
        format: "mp3",
        bitrate: 128,
      });

      await assetMigrationService.migrateAll();

      expect(audioValidator.analyseAudioFile).toHaveBeenCalled();
      expect(mockStrategy.validateAsset).toHaveBeenCalled();
      expect(fs.promises.writeFile).toHaveBeenCalled();
    });

    it("should not update if compatibility block for all strategies already exists", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readdir
        .mockResolvedValueOnce(["test.mp3"])
        .mockResolvedValueOnce([]);

      const existingMeta = {
        format: "mp3",
        bitrate: 128,
        compatibility: { voicemonkey: { valid: true } },
      };
      fs.promises.readFile.mockResolvedValue(JSON.stringify(existingMeta));

      await assetMigrationService.migrateAll();

      expect(mockStrategy.validateAsset).not.toHaveBeenCalled();
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });

    it("should handle batch processing", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      // Create 60 files to trigger 2 batches (batch size is 50)
      const manyFiles = Array.from({ length: 60 }, (_, i) => `test${i}.mp3`);
      fs.promises.readdir
        .mockResolvedValueOnce(manyFiles)
        .mockResolvedValueOnce([]);

      fs.promises.readFile.mockResolvedValue(JSON.stringify({ format: "mp3" }));

      await assetMigrationService.migrateAll();

      expect(fs.promises.writeFile).toHaveBeenCalledTimes(60);
    });
  });
});
