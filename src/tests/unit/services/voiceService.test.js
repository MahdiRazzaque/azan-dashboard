const fs = require("fs");
const axios = require("axios");
const configService = require("@config");

jest.mock("fs", () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
  },
}));

describe("VoiceService (Async Refactor)", () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.isolateModules(() => {
      service = require("@services/system/voiceService");
    });
    configService.get.mockReturnValue({
      automation: { pythonServiceUrl: "http://python:8000" },
    });
  });

  it("should load from disk cache using fs.promises", async () => {
    const mockData = {
      timestamp: new Date().toISOString(),
      voices: [{ id: "v1", name: "Voice 1" }],
    };

    fs.promises.access.mockResolvedValue();
    fs.promises.readFile.mockResolvedValue(JSON.stringify(mockData));

    const voices = await service.refreshVoices();

    expect(fs.promises.readFile).toHaveBeenCalled();
    expect(voices).toHaveLength(1);
    expect(voices[0].id).toBe("v1");
  });

  it("should save to disk cache using fs.promises", async () => {
    const mockVoices = [{ id: "v2", name: "Voice 2" }];
    axios.get.mockResolvedValue({ data: mockVoices });

    // Mock disk cache miss
    fs.promises.access.mockRejectedValue(new Error("no cache"));
    fs.promises.mkdir.mockResolvedValue();
    fs.promises.writeFile.mockResolvedValue();

    const voices = await service.refreshVoices();

    expect(axios.get).toHaveBeenCalled();
    expect(fs.promises.writeFile).toHaveBeenCalled();
    expect(voices).toHaveLength(1);
    expect(voices[0].id).toBe("v2");
  });

  it("should handle stale disk cache", async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 2); // 48 hours ago
    const mockData = {
      timestamp: oldDate.toISOString(),
      voices: [{ id: "v1", name: "Voice 1" }],
    };

    fs.promises.access.mockResolvedValue();
    fs.promises.readFile.mockResolvedValue(JSON.stringify(mockData));
    axios.get.mockResolvedValue({ data: [{ id: "v2" }] });
    fs.promises.writeFile.mockResolvedValue();

    const voices = await service.refreshVoices();
    expect(voices[0].id).toBe("v2"); // Should have refreshed
  });

  it("should handle disk cache read error", async () => {
    fs.promises.access.mockResolvedValue();
    fs.promises.readFile.mockRejectedValue(new Error("Read Fail"));
    axios.get.mockResolvedValue({ data: [{ id: "v2" }] });
    fs.promises.writeFile.mockResolvedValue();

    const voices = await service.refreshVoices();
    expect(voices[0].id).toBe("v2");
  });

  it("should handle disk cache save error", async () => {
    axios.get.mockResolvedValue({ data: [{ id: "v2" }] });
    fs.promises.access.mockRejectedValue(new Error("no cache"));
    fs.promises.mkdir.mockRejectedValue(new Error("Mkdir Fail"));

    const voices = await service.refreshVoices();
    expect(voices[0].id).toBe("v2");
  });

  it("should use memory cache if valid", async () => {
    axios.get.mockResolvedValue({ data: [{ id: "v1" }] });
    fs.promises.access.mockRejectedValue(new Error("no cache"));
    fs.promises.mkdir.mockResolvedValue();
    fs.promises.writeFile.mockResolvedValue();

    await service.refreshVoices(); // First call

    axios.get.mockClear();
    const voices = await service.refreshVoices(); // Second call
    expect(axios.get).not.toHaveBeenCalled();
    expect(voices[0].id).toBe("v1");
  });

  it("should handle fetch error and return existing voices", async () => {
    jest.useFakeTimers();
    axios.get.mockResolvedValue({ data: [{ id: "v1" }] });
    fs.promises.access.mockRejectedValue(new Error("no cache"));
    fs.promises.mkdir.mockResolvedValue();
    fs.promises.writeFile.mockResolvedValue();

    await service.refreshVoices(); // Populate memory cache

    // Advance time by 25 hours to invalidate memory cache
    jest.advanceTimersByTime(25 * 60 * 60 * 1000);

    axios.get.mockRejectedValue(new Error("Fetch Fail"));
    const voices = await service.refreshVoices();
    expect(voices[0].id).toBe("v1");
    jest.useRealTimers();
  });

  it("should handle non-array response from Python service", async () => {
    axios.get.mockResolvedValue({ data: { not: "an array" } });
    fs.promises.access.mockRejectedValue(new Error("no cache"));
    fs.promises.mkdir.mockResolvedValue();
    fs.promises.writeFile.mockResolvedValue();

    const voices = await service.refreshVoices();
    expect(voices).toEqual([]);
  });

  it("should use custom python service URL", async () => {
    configService.get.mockReturnValue({
      automation: { pythonServiceUrl: "http://custom:9000" },
    });
    axios.get.mockResolvedValue({ data: [] });
    fs.promises.access.mockRejectedValue(new Error("no cache"));
    fs.promises.mkdir.mockResolvedValue();
    fs.promises.writeFile.mockResolvedValue();

    await service.refreshVoices();
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("http://custom:9000"),
      expect.anything(),
    );
  });

  it("should handle concurrent fetches", async () => {
    let resolveFn;
    const promise = new Promise((resolve) => {
      resolveFn = resolve;
    });
    axios.get.mockReturnValue(promise);

    // Mock disk cache miss
    fs.promises.access.mockRejectedValue(new Error("no cache"));

    const call1 = service.refreshVoices();

    // We need to wait a bit for call1 to reach the fetch part
    await new Promise((resolve) => setImmediate(resolve));

    const call2 = service.refreshVoices();

    resolveFn({ data: [{ id: "v1" }] });
    const [v1, v2] = await Promise.all([call1, call2]);

    expect(axios.get).toHaveBeenCalledTimes(1);
    // v2 will return the current voices (empty array) because isFetching is true
    expect(v1[0].id).toBe("v1");
    expect(Array.isArray(v2)).toBe(true);
  });

  it("should use default python service URL if not configured", async () => {
    configService.get.mockReturnValue({
      automation: {},
    });
    axios.get.mockResolvedValue({ data: [] });
    fs.promises.access.mockRejectedValue(new Error("no cache"));
    fs.promises.mkdir.mockResolvedValue();
    fs.promises.writeFile.mockResolvedValue();

    await service.refreshVoices();
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringContaining("http://localhost:8000"),
      expect.anything(),
    );
  });

  it("should initialise and get voices", async () => {
    axios.get.mockResolvedValue({ data: [{ id: "v1" }] });
    fs.promises.access.mockRejectedValue(new Error("no cache"));
    fs.promises.mkdir.mockResolvedValue();
    fs.promises.writeFile.mockResolvedValue();

    await service.init();
    const voices = service.getVoices();
    expect(voices[0].id).toBe("v1");
  });
});
