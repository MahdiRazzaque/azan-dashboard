const envManager = require("@utils/envManager");
const fs = require("fs/promises");

jest.mock("fs/promises");

describe("EnvManager", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("isConfigured", () => {
    it("should return true if ADMIN_PASSWORD is set", () => {
      process.env.ADMIN_PASSWORD = "hashed";
      expect(envManager.isConfigured()).toBe(true);
    });

    it("should return false if ADMIN_PASSWORD is unset", () => {
      delete process.env.ADMIN_PASSWORD;
      expect(envManager.isConfigured()).toBe(false);
    });
  });

  describe("getEnv", () => {
    it("should parse .env file", async () => {
      const mockEnvContent = "KEY=VALUE\nANOTHER=TEST";
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue(mockEnvContent);

      const result = await envManager.getEnv();
      expect(result.KEY).toBe("VALUE");
      expect(result.ANOTHER).toBe("TEST");
    });

    it("should return empty if file missing", async () => {
      fs.access.mockRejectedValue(new Error("ENOENT"));
      const result = await envManager.getEnv();
      expect(result).toEqual({});
    });
  });

  describe("setEnvValue", () => {
    it("should append new value if key not exists", async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue("FOO=BAR");

      await envManager.setEnvValue("NEW_KEY", "NEW_VAL");

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(".env"),
        expect.stringContaining("NEW_KEY=NEW_VAL"),
      );
      expect(process.env.NEW_KEY).toBe("NEW_VAL");
    });

    it("should update existing value", async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue("FOO=BAR\nTARGET=OLD");

      await envManager.setEnvValue("TARGET", "NEW");

      expect(fs.writeFile).toHaveBeenCalled();
      const calledContent = fs.writeFile.mock.calls[0][1];
      expect(calledContent).toContain("TARGET=NEW");
      expect(calledContent).not.toContain("TARGET=OLD");

      expect(process.env.TARGET).toBe("NEW");
    });

    it("should handle creating new file if missing", async () => {
      fs.access.mockRejectedValue(new Error("ENOENT"));

      await envManager.setEnvValue("KEY", "VAL");

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("KEY=VAL"),
      );
    });
  });

  describe("generateSecret", () => {
    it("should return a random string", () => {
      const secret1 = envManager.generateSecret();
      const secret2 = envManager.generateSecret();
      expect(secret1).not.toBe(secret2);
      expect(secret1.length).toBeGreaterThan(10);
    });

    it("should support custom length", () => {
      const secret = envManager.generateSecret(64);
      expect(secret.length).toBe(128); // 64 bytes = 128 chars hex
    });
  });

  describe("deleteEnvValue", () => {
    it("should remove value if key exists", async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue("KEEP=YES\nDELETE=ME\nALSO=KEEP");

      await envManager.deleteEnvValue("DELETE");

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("KEEP=YES\nALSO=KEEP"),
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.not.stringContaining("DELETE=ME"),
      );
    });

    it("should do nothing if key does not exist", async () => {
      fs.access.mockResolvedValue(undefined);
      fs.readFile.mockResolvedValue("KEEP=YES");

      await envManager.deleteEnvValue("MISSING");

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should do nothing if file missing", async () => {
      fs.access.mockRejectedValue(new Error("ENOENT"));
      await envManager.deleteEnvValue("KEY");
      expect(fs.writeFile).not.toHaveBeenCalled();
    });
  });
});
