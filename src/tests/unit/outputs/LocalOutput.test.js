const fs = require("fs");
const path = require("path");

jest.mock("play-sound", () => {
  const play = jest.fn((file, opts, cb) => cb(null));
  return () => ({ play });
});

jest.mock("@utils/normalizeSource", () => {
  const actualNormalizeSource = jest.requireActual("@utils/normalizeSource");
  return jest.fn((source) => actualNormalizeSource(source));
});

const LocalOutput = require("@outputs/LocalOutput");
const { execFile } = require("child_process");
const ConfigService = require("@config");

jest.mock("child_process");
jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    access: jest.fn().mockResolvedValue(undefined),
  },
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const AUDIO_ROOT = path.resolve(__dirname, "../../../../public/audio");

describe("LocalOutput", () => {
  let output;
  let mockPlay;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.promises.access.mockResolvedValue(undefined);
    output = new LocalOutput();
    mockPlay = require("play-sound")().play;
    ConfigService.get.mockReturnValue({
      automation: {
        outputs: {
          local: {
            params: { audioPlayer: "mpg123" },
          },
        },
      },
    });
  });

  describe("Metadata", () => {
    it("should return correct metadata", () => {
      const meta = LocalOutput.getMetadata();
      expect(meta.id).toBe("local");
      expect(meta.supportedSourceTypes).toEqual(["file", "url"]);
    });

    it("should have audioPlayer as a select type with options", () => {
      const meta = LocalOutput.getMetadata();
      const playerParam = meta.params.find((p) => p.key === "audioPlayer");
      expect(playerParam.type).toBe("select");
      expect(playerParam.options).toContain("mpg123");
    });
  });

  describe("_executeFromFile", () => {
    it("should play audio file using configured player", async () => {
      const testFile = path.join(AUDIO_ROOT, "custom/test.mp3");
      const payload = {
        source: {
          type: "file",
          filePath: testFile,
          url: "/public/audio/custom/test.mp3",
        },
        params: { audioPlayer: "mpg123" },
      };

      await output.execute(payload, {});
      expect(mockPlay).toHaveBeenCalledWith(
        testFile,
        { player: "mpg123" },
        expect.any(Function),
      );
    });

    it("should reject if audioPlayer is not in allowlist", async () => {
      const testFile = path.join(AUDIO_ROOT, "custom/test.mp3");
      const payload = {
        source: {
          type: "file",
          filePath: testFile,
          url: "/public/audio/custom/test.mp3",
        },
        params: { audioPlayer: "malicious_cmd; rm -rf /" },
      };

      await expect(output.execute(payload, {})).rejects.toThrow(
        "Invalid audio player",
      );
    });

    it("should default to mpg123 if player not specified", async () => {
      const testFile = path.join(AUDIO_ROOT, "custom/test.mp3");
      const payload = {
        source: {
          type: "file",
          filePath: testFile,
          url: "/public/audio/custom/test.mp3",
        },
      };

      await output.execute(payload, {});
      expect(mockPlay).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ player: "mpg123" }),
        expect.any(Function),
      );
    });

    it("should reject if playback fails", async () => {
      mockPlay.mockImplementationOnce((file, opts, cb) =>
        cb(new Error("Play error")),
      );

      const testFile = path.join(AUDIO_ROOT, "custom/test.mp3");
      const payload = {
        source: {
          type: "file",
          filePath: testFile,
          url: "/public/audio/custom/test.mp3",
        },
      };

      await expect(output.execute(payload, {})).rejects.toThrow("Play error");
    });
  });

  describe("_executeFromUrl", () => {
    it("should pass URL directly to player", async () => {
      const payload = {
        source: { type: "url", url: "https://example.com/audio.mp3" },
      };

      await output.execute(payload, {});
      expect(mockPlay).toHaveBeenCalledWith(
        "https://example.com/audio.mp3",
        expect.objectContaining({ player: "mpg123" }),
        expect.any(Function),
      );
    });

    it("should reject if playback of URL fails", async () => {
      mockPlay.mockImplementationOnce((file, opts, cb) =>
        cb(new Error("Network error")),
      );

      const payload = {
        source: { type: "url", url: "https://example.com/audio.mp3" },
      };

      await expect(output.execute(payload, {})).rejects.toThrow(
        "Network error",
      );
    });
  });

  describe("execute normalizes raw source", () => {
    it("should normalize path-only source from OutputStrategyCard", async () => {
      const payload = {
        source: { path: "custom/test.mp3" },
      };
      await output.execute(payload, {});
      expect(mockPlay).toHaveBeenCalledWith(
        expect.stringContaining("public/audio/custom/test.mp3"),
        expect.anything(),
        expect.any(Function),
      );
    });

    it("should block sibling-directory bypass attempts", async () => {
      const payload = {
        source: { path: "../audio-evil/pwn.mp3" },
      };

      await expect(output.execute(payload, {})).rejects.toThrow(
        "Path traversal detected",
      );
      expect(mockPlay).not.toHaveBeenCalled();
    });
  });

  describe("healthCheck", () => {
    it("should return healthy if mpg123 is found", async () => {
      execFile.mockImplementation((file, args, cb) => cb(null));
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      fs.promises.access.mockResolvedValue(undefined);

      const result = await output.healthCheck();
      expect(result.healthy).toBe(true);

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should return unhealthy if player is missing", async () => {
      execFile.mockImplementation((file, args, cb) => cb(new Error("ENOENT")));
      const result = await output.healthCheck();
      expect(result.healthy).toBe(false);
    });

    it("should detect Docker without audio hardware", async () => {
      execFile.mockImplementation((file, args, cb) => cb(null));
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      fs.promises.access
        .mockRejectedValueOnce(new Error("ENOENT"))
        .mockResolvedValueOnce(undefined);

      const result = await output.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.message).toContain("Docker: No Audio HW");

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should return unhealthy for invalid player", async () => {
      const result = await output.healthCheck({ audioPlayer: "invalid" });
      expect(result.healthy).toBe(false);
      expect(result.message).toBe("Invalid Audio Player");
    });

    it("should bypass /dev/snd check on WSL", async () => {
      execFile.mockImplementation((file, args, cb) => cb(null));
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });
      fs.promises.readFile.mockResolvedValue("microsoft");

      const result = await output.healthCheck();
      expect(result.healthy).toBe(true);
      expect(result.message).toBe("Ready");

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should detect Docker via cgroup", async () => {
      execFile.mockImplementation((file, args, cb) => cb(null));
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      fs.promises.access.mockRejectedValue(new Error("ENOENT"));
      fs.promises.readFile.mockResolvedValue("...docker...");

      const result = await output.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.message).toBe("Docker: No Audio HW");

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should return No Audio Device if not Docker and no /dev/snd", async () => {
      execFile.mockImplementation((file, args, cb) => cb(null));
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      fs.promises.access.mockRejectedValue(new Error("ENOENT"));
      fs.promises.readFile.mockResolvedValue("...normal...");

      const result = await output.healthCheck();
      expect(result.healthy).toBe(false);
      expect(result.message).toBe("No Audio Device");

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });

  describe("verifyCredentials", () => {
    it("should always return true", async () => {
      const result = await output.verifyCredentials({});
      expect(result.success).toBe(true);
    });
  });

  describe("_isWSL", () => {
    it("should return false if not linux", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "darwin" });
      expect(await output._isWSL()).toBe(false);
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should return true if /proc/version contains microsoft", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });
      fs.promises.readFile.mockResolvedValue(
        "Linux version 5.10.16.3-microsoft-standard-WSL2",
      );
      expect(await output._isWSL()).toBe(true);
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should return false if readFile fails", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });
      fs.promises.readFile.mockRejectedValue(new Error("Fail"));
      expect(await output._isWSL()).toBe(false);
      Object.defineProperty(process, "platform", { value: originalPlatform });
    });
  });

  describe("WSL and Abort", () => {
    it("should inject pulse output on WSL with mpg123", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });
      fs.promises.readFile.mockResolvedValue("microsoft");
      fs.promises.access.mockResolvedValue(undefined);

      const testFile = path.join(AUDIO_ROOT, "custom/test.mp3");
      const payload = {
        source: {
          type: "file",
          filePath: testFile,
          url: "/public/audio/custom/test.mp3",
        },
        params: { audioPlayer: "mpg123" },
      };

      await output.execute(payload, {});
      expect(mockPlay).toHaveBeenCalledWith(
        testFile,
        expect.objectContaining({ mpg123: ["-o", "pulse"] }),
        expect.any(Function),
      );

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should handle abort signal", async () => {
      const controller = new AbortController();
      const mockProcess = { kill: jest.fn() };
      mockPlay.mockReturnValue(mockProcess);
      fs.promises.access.mockResolvedValue(undefined);

      const testFile = path.join(AUDIO_ROOT, "custom/test.mp3");
      const payload = {
        source: {
          type: "file",
          filePath: testFile,
          url: "/public/audio/custom/test.mp3",
        },
      };

      const promise = output.execute(payload, {}, controller.signal);
      setImmediate(() => controller.abort());

      await expect(promise).rejects.toThrow("Playback aborted");
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it("should handle already aborted signal", async () => {
      const controller = new AbortController();
      controller.abort();
      const mockProcess = { kill: jest.fn() };
      mockPlay.mockReturnValue(mockProcess);
      fs.promises.access.mockResolvedValue(undefined);

      const testFile = path.join(AUDIO_ROOT, "custom/test.mp3");
      const payload = {
        source: {
          type: "file",
          filePath: testFile,
          url: "/public/audio/custom/test.mp3",
        },
      };

      await expect(
        output.execute(payload, {}, controller.signal),
      ).rejects.toThrow("Playback aborted");
      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it("should handle killed error", async () => {
      const err = new Error("Killed");
      err.killed = true;
      mockPlay.mockImplementationOnce((file, opts, cb) => cb(err));
      fs.promises.access.mockResolvedValue(undefined);

      const testFile = path.join(AUDIO_ROOT, "custom/test.mp3");
      const payload = {
        source: {
          type: "file",
          filePath: testFile,
          url: "/public/audio/custom/test.mp3",
        },
      };

      await expect(output.execute(payload, {})).rejects.toThrow("Killed");
    });
  });

  describe("validateAsset", () => {
    it("should return valid", async () => {
      const result = await output.validateAsset("test.mp3", {});
      expect(result.valid).toBe(true);
    });
  });
});
