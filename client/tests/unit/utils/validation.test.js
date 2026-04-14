import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateTrigger,
  validateSourceSettings,
} from "../../../src/utils/validation";

describe("validation.js", () => {
  describe("validateTrigger", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", vi.fn());
    });

    it("should return null if trigger is disabled", async () => {
      const trigger = { enabled: false };
      const result = await validateTrigger(trigger);
      expect(result).toBeNull();
    });

    it("should validate TTS triggers", async () => {
      expect(
        await validateTrigger({ enabled: true, type: "tts", template: "" }),
      ).toBe("TTS template is required");
      expect(
        await validateTrigger({ enabled: true, type: "tts", template: "  " }),
      ).toBe("TTS template is required");
      expect(
        await validateTrigger({
          enabled: true,
          type: "tts",
          template: "Hello",
        }),
      ).toBeNull();
    });

    it("should validate file triggers", async () => {
      expect(
        await validateTrigger({ enabled: true, type: "file", path: "" }),
      ).toBe("A file must be selected");
      expect(
        await validateTrigger({
          enabled: true,
          type: "file",
          path: "audio.mp3",
        }),
      ).toBeNull();
    });

    it("should validate URL triggers", async () => {
      expect(
        await validateTrigger({ enabled: true, type: "url", url: "" }),
      ).toBe("URL is required");
      expect(
        await validateTrigger({
          enabled: true,
          type: "url",
          url: "http://example.com/audio.wav",
        }),
      ).toBe("URL must point to an .mp3 file");

      // Mock successful fetch
      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ valid: true }),
      });
      expect(
        await validateTrigger({
          enabled: true,
          type: "url",
          url: "http://example.com/audio.mp3",
        }),
      ).toBeNull();

      // Mock invalid URL from server
      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ valid: false, error: "Not found" }),
      });
      expect(
        await validateTrigger({
          enabled: true,
          type: "url",
          url: "http://example.com/audio.mp3",
        }),
      ).toBe("URL unreachable: Not found");

      // Mock invalid URL from server without error message
      fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ valid: false }),
      });
      expect(
        await validateTrigger({
          enabled: true,
          type: "url",
          url: "http://example.com/audio.mp3",
        }),
      ).toBe("URL unreachable: Unknown error");

      // Mock fetch error
      fetch.mockRejectedValueOnce(new Error("Network error"));
      expect(
        await validateTrigger({
          enabled: true,
          type: "url",
          url: "http://example.com/audio.mp3",
        }),
      ).toBe("Validation check failed (Network error)");
    });

    it("should return null for unknown trigger types", async () => {
      const trigger = { enabled: true, type: "unknown" };
      const result = await validateTrigger(trigger);
      expect(result).toBeNull();
    });
  });

  describe("validateSourceSettings", () => {
    const providerMetadata = {
      parameters: [
        {
          key: "apiKey",
          label: "API Key",
          constraints: { required: true },
        },
        {
          key: "stationId",
          label: "Station ID",
          constraints: { pattern: "^[0-9]+$" },
        },
      ],
    };

    it("should return null if source or metadata is missing", () => {
      expect(validateSourceSettings(null, providerMetadata)).toBeNull();
      expect(validateSourceSettings({}, null)).toBeNull();
    });

    it("should return null if source is disabled", () => {
      const source = { enabled: false };
      expect(validateSourceSettings(source, providerMetadata)).toBeNull();
    });

    it("should validate required fields", () => {
      const source = { enabled: true, apiKey: "" };
      expect(validateSourceSettings(source, providerMetadata)).toBe(
        "API Key is required",
      );

      source.apiKey = "secret";
      expect(validateSourceSettings(source, providerMetadata)).toBeNull();
    });

    it("should validate pattern constraints", () => {
      const source = { enabled: true, apiKey: "secret", stationId: "abc" };
      expect(validateSourceSettings(source, providerMetadata)).toBe(
        "Invalid format for Station ID",
      );

      source.stationId = "123";
      expect(validateSourceSettings(source, providerMetadata)).toBeNull();
    });

    it("should handle optional fields with patterns", () => {
      const source = { enabled: true, apiKey: "secret" };
      // stationId is missing but has pattern. Since it's not required, it should be fine if it's undefined
      expect(validateSourceSettings(source, providerMetadata)).toBeNull();
    });
  });
});
