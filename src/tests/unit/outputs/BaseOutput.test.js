const path = require("path");

jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    access: jest.fn(),
  },
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

const fs = require("fs");
const BaseOutput = require("../../../outputs/BaseOutput");

const PROJECT_PUBLIC_ROOT = path.resolve(__dirname, "../../../../public/audio");

describe("BaseOutput", () => {
  class TestOutput extends BaseOutput {
    static getMetadata() {
      return {
        id: "test",
        label: "Test Output",
        supportedSourceTypes: ["file", "url"],
        params: [
          { key: "token", sensitive: true },
          { key: "url", sensitive: false },
        ],
      };
    }

    async _executeFromFile(payload, metadata, signal) {
      this.lastCall = { hook: "file", payload, metadata, signal };
    }

    async _executeFromUrl(payload, metadata, signal) {
      this.lastCall = { hook: "url", payload, metadata, signal };
    }
  }

  class FileOnlyOutput extends BaseOutput {
    static getMetadata() {
      return {
        id: "fileOnly",
        label: "File Only",
        supportedSourceTypes: ["file"],
        params: [],
      };
    }

    async _executeFromFile(payload, _metadata, _signal) {
      this.lastCall = { hook: "file", source: payload.source };
    }
  }

  class IncompleteOutput extends BaseOutput {
    // Missing getMetadata
  }

  let output;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.promises.access.mockResolvedValue(undefined);
    output = new TestOutput();
  });

  describe("execute — Template Method", () => {
    it("should dispatch file source to _executeFromFile", async () => {
      const fileSource = {
        type: "file",
        filePath: path.join(PROJECT_PUBLIC_ROOT, "test.mp3"),
        url: "/public/audio/test.mp3",
      };
      const payload = {
        source: fileSource,
      };
      await output.execute(payload, { isTest: true });
      expect(output.lastCall.hook).toBe("file");
      expect(output.lastCall.payload.source).toEqual(fileSource);
    });

    it("should dispatch url source to _executeFromUrl", async () => {
      const payload = {
        source: { type: "url", url: "https://example.com/audio.mp3" },
      };
      await output.execute(payload, {});
      expect(output.lastCall.hook).toBe("url");
      expect(output.lastCall.payload.source).toEqual(payload.source);
    });

    it("should pass metadata and signal through to hooks", async () => {
      const payload = {
        source: { type: "url", url: "https://example.com/audio.mp3" },
      };
      const metadata = { isTest: true };
      const signal = new AbortController().signal;
      await output.execute(payload, metadata, signal);
      expect(output.lastCall.metadata).toBe(metadata);
      expect(output.lastCall.signal).toBe(signal);
    });

    it("should normalize raw source before dispatching", async () => {
      const payload = {
        source: { path: "custom/test.mp3" },
      };
      await output.execute(payload, {});
      expect(output.lastCall.hook).toBe("file");
      expect(output.lastCall.payload.source.type).toBe("file");
      expect(output.lastCall.payload.source.filePath).toContain(
        "custom/test.mp3",
      );
      expect(output.lastCall.payload.source.url).toBe(
        "/public/audio/custom/test.mp3",
      );
    });

    it("should reject source type not in supportedSourceTypes", async () => {
      const fileOnly = new FileOnlyOutput();
      const payload = {
        source: { type: "url", url: "https://example.com/audio.mp3" },
      };
      await expect(fileOnly.execute(payload, {})).rejects.toThrow(
        'Source type "url" is not supported by File Only',
      );
    });

    it("should throw if payload has no source", async () => {
      await expect(output.execute({}, {})).rejects.toThrow("source");
    });

    it("should throw if source is null", async () => {
      await expect(output.execute({ source: null }, {})).rejects.toThrow();
    });

    it("should preserve other payload properties when dispatching", async () => {
      const payload = {
        prayer: "fajr",
        event: "adhan",
        baseUrl: "https://example.com",
        source: { type: "url", url: "https://example.com/audio.mp3" },
      };
      await output.execute(payload, {});
      expect(output.lastCall.payload.prayer).toBe("fajr");
      expect(output.lastCall.payload.event).toBe("adhan");
      expect(output.lastCall.payload.baseUrl).toBe("https://example.com");
    });

    it("should not check sidecar for URL sources", async () => {
      const payload = {
        source: { type: "url", url: "https://example.com/audio.mp3" },
      };
      await output.execute(payload, {});
      expect(fs.promises.access).not.toHaveBeenCalled();
    });

    it("should reject typed file sources with traversal before dispatching", async () => {
      const payload = {
        source: {
          type: "file",
          filePath: path.resolve(PROJECT_PUBLIC_ROOT, "../outside.mp3"),
          url: "/public/audio/custom/test.mp3",
        },
      };

      await expect(output.execute(payload, {})).rejects.toThrow(
        "Path traversal detected",
      );
      expect(output.lastCall).toBeUndefined();
    });

    it("should reject typed file sources from sibling prefix directories before dispatching", async () => {
      const payload = {
        source: {
          type: "file",
          filePath: path.resolve(PROJECT_PUBLIC_ROOT, "../audio-evil/test.mp3"),
          url: "/public/audio/custom/test.mp3",
        },
      };

      await expect(output.execute(payload, {})).rejects.toThrow(
        "Path traversal detected",
      );
      expect(output.lastCall).toBeUndefined();
      expect(fs.promises.access).not.toHaveBeenCalled();
    });

    it("should reject typed url sources with forbidden protocols before dispatching", async () => {
      const payload = {
        source: { type: "url", url: "file:///etc/passwd" },
      };

      await expect(output.execute(payload, {})).rejects.toThrow(
        "Only http and https URLs are allowed",
      );
      expect(output.lastCall).toBeUndefined();
    });

    it("should throw if audio file does not exist on disk", async () => {
      fs.promises.access.mockRejectedValue(new Error("ENOENT"));
      const payload = {
        source: {
          type: "file",
          filePath: path.join(PROJECT_PUBLIC_ROOT, "nonexistent.mp3"),
          url: "/public/audio/nonexistent.mp3",
        },
      };
      await expect(output.execute(payload, {})).rejects.toThrow(
        "Audio file not found: nonexistent.mp3",
      );
      expect(output.lastCall).toBeUndefined();
    });
  });

  describe("execute — sidecar compatibility", () => {
    const filePath = path.join(PROJECT_PUBLIC_ROOT, "custom/test.mp3");
    const filePayload = {
      source: { type: "file", filePath, url: "/public/audio/custom/test.mp3" },
    };

    it("should skip execution if sidecar marks output as incompatible", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(
        JSON.stringify({
          compatibility: { test: { valid: false, issues: ["Too long"] } },
        }),
      );
      await output.execute(filePayload, {});
      expect(output.lastCall).toBeUndefined();
    });

    it("should proceed if sidecar marks output as compatible", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(
        JSON.stringify({
          compatibility: { test: { valid: true, issues: [] } },
        }),
      );
      await output.execute(filePayload, {});
      expect(output.lastCall.hook).toBe("file");
    });

    it("should proceed if sidecar is missing (ENOENT)", async () => {
      fs.promises.access
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("ENOENT"));
      await output.execute(filePayload, {});
      expect(output.lastCall.hook).toBe("file");
    });

    it("should proceed if sidecar JSON is corrupted", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue("not json");
      await output.execute(filePayload, {});
      expect(output.lastCall.hook).toBe("file");
    });

    it("should proceed if sidecar has no compatibility section", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(JSON.stringify({ format: "mp3" }));
      await output.execute(filePayload, {});
      expect(output.lastCall.hook).toBe("file");
    });

    it("should proceed if sidecar compatibility has no entry for this output", async () => {
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(
        JSON.stringify({
          compatibility: { other: { valid: false } },
        }),
      );
      await output.execute(filePayload, {});
      expect(output.lastCall.hook).toBe("file");
    });

    it("should use output metadata id to look up compatibility", async () => {
      class AlexaOutput extends BaseOutput {
        static getMetadata() {
          return {
            id: "alexa",
            label: "Alexa",
            supportedSourceTypes: ["file"],
            params: [],
          };
        }
        async _executeFromFile(payload) {
          this.lastCall = { hook: "file", payload };
        }
      }
      const alexa = new AlexaOutput();
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(
        JSON.stringify({
          compatibility: { alexa: { valid: false }, test: { valid: true } },
        }),
      );
      await alexa.execute(filePayload, {});
      expect(alexa.lastCall).toBeUndefined();
    });

    it("should derive filePath from typed file URLs before checking sidecar compatibility", async () => {
      const payload = {
        source: { type: "file", filePath: null, url: "/public/audio/test.mp3" },
      };
      await output.execute(payload, {});
      expect(output.lastCall.hook).toBe("file");
      expect(output.lastCall.payload.source.filePath).toBe(
        path.join(PROJECT_PUBLIC_ROOT, "test.mp3"),
      );
      expect(fs.promises.access).toHaveBeenCalled();
    });

    it("should reject path traversal attempts before sidecar resolution", async () => {
      const traversalPath = path.join(PROJECT_PUBLIC_ROOT, "../../etc/passwd");
      const payload = {
        source: {
          type: "file",
          filePath: traversalPath,
          url: "/public/audio/test.mp3",
        },
      };
      await expect(output.execute(payload, {})).rejects.toThrow(
        "Path traversal detected",
      );
      expect(output.lastCall).toBeUndefined();
      expect(fs.promises.access).not.toHaveBeenCalled();
    });

    it("should ignore sidecar lookup for sibling prefix metadata paths", async () => {
      const result = await output._checkSidecarCompatibility(
        path.resolve(PROJECT_PUBLIC_ROOT, "../audio-evil/test.mp3"),
      );

      expect(result).toBeUndefined();
      expect(fs.promises.access).not.toHaveBeenCalled();
      expect(fs.promises.readFile).not.toHaveBeenCalled();
    });

    it("should log warning when skipping incompatible file", async () => {
      const spy = jest.spyOn(console, "warn").mockImplementation();
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue(
        JSON.stringify({
          compatibility: { test: { valid: false } },
        }),
      );
      await output.execute(filePayload, {});
      expect(spy).toHaveBeenCalledWith(
        "[Output: Test Output] Skipped: Audio incompatible with Test Output",
      );
      spy.mockRestore();
    });
  });

  describe("execute — default hook behaviour", () => {
    class NoHooksOutput extends BaseOutput {
      static getMetadata() {
        return {
          id: "nohooks",
          label: "No Hooks",
          supportedSourceTypes: ["file", "url"],
          params: [],
        };
      }
    }

    it('should throw "Not supported" from default _executeFromFile', async () => {
      const noHooks = new NoHooksOutput();
      const payload = {
        source: {
          type: "file",
          filePath: path.join(PROJECT_PUBLIC_ROOT, "test.mp3"),
          url: "/public/audio/test.mp3",
        },
      };
      await expect(noHooks.execute(payload, {})).rejects.toThrow(
        "No Hooks does not support file sources",
      );
    });

    it('should throw "Not supported" from default _executeFromUrl', async () => {
      const noHooks = new NoHooksOutput();
      const payload = {
        source: { type: "url", url: "https://example.com/audio.mp3" },
      };
      await expect(noHooks.execute(payload, {})).rejects.toThrow(
        "No Hooks does not support url sources",
      );
    });
  });

  describe("healthCheck", () => {
    it('should throw "Not implemented" by default', async () => {
      await expect(output.healthCheck({})).rejects.toThrow("Not implemented");
    });
  });

  describe("verifyCredentials", () => {
    it('should throw "Not implemented" by default', async () => {
      await expect(output.verifyCredentials({})).rejects.toThrow(
        "Not implemented",
      );
    });
  });

  describe("validateAsset", () => {
    it("should return valid by default", async () => {
      const result = await output.validateAsset("path/to/file.mp3", {});
      expect(result).toEqual({
        valid: true,
        lastChecked: expect.any(String),
        issues: [],
      });
      expect(new Date(result.lastChecked).getTime()).not.toBeNaN();
    });
  });

  describe("augmentAudioMetadata", () => {
    it("should return empty object by default", () => {
      expect(output.augmentAudioMetadata({})).toEqual({});
    });
  });

  describe("getSecretRequirementKeys", () => {
    it("should return keys marked as sensitive in metadata", () => {
      const keys = output.getSecretRequirementKeys();
      expect(keys).toEqual(["token"]);
    });

    it("should return empty array if no params in metadata", () => {
      class NoParamsOutput extends BaseOutput {
        static getMetadata() {
          return { id: "noparams" };
        }
      }
      const noParams = new NoParamsOutput();
      expect(noParams.getSecretRequirementKeys()).toEqual([]);
    });

    it("should throw if getMetadata is not implemented in subclass", () => {
      const incomplete = new IncompleteOutput();
      expect(() => incomplete.getSecretRequirementKeys()).toThrow();
    });
  });

  describe("validateTrigger", () => {
    it("should return empty array by default", () => {
      expect(output.validateTrigger({}, {})).toEqual([]);
    });
  });

  describe("static getMetadata", () => {
    it('should throw "Not implemented" by default', () => {
      expect(() => BaseOutput.getMetadata()).toThrow("Not implemented");
    });
  });
});
