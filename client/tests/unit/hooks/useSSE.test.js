import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSSE } from "../../../src/hooks/useSSE";

describe("useSSE", () => {
  let mockEventSource;

  beforeEach(() => {
    mockEventSource = {
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onerror: null,
    };
    vi.stubGlobal(
      "EventSource",
      vi.fn().mockImplementation(function () {
        return mockEventSource;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useSSE());
    expect(result.current.logs).toEqual([]);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.processStatus).toBeNull();
  });

  it("should set isConnected to true when connection opens", () => {
    const { result } = renderHook(() => useSSE());

    act(() => {
      mockEventSource.onopen();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("should handle LOG messages", () => {
    const { result } = renderHook(() => useSSE());
    const logPayload = { message: "Test log", type: "info" };

    act(() => {
      mockEventSource.onmessage({
        data: JSON.stringify({ type: "LOG", payload: logPayload }),
      });
    });

    expect(result.current.logs[0]).toEqual(logPayload);
  });

  it("should handle AUDIO_PLAY messages and call onAudioPlay", () => {
    const onAudioPlay = vi.fn();
    const { result } = renderHook(() => useSSE(onAudioPlay));
    const audioPayload = { prayer: "Fajr", event: "azan", url: "fajr.mp3" };

    act(() => {
      mockEventSource.onmessage({
        data: JSON.stringify({ type: "AUDIO_PLAY", payload: audioPayload }),
      });
    });

    expect(onAudioPlay).toHaveBeenCalledWith("Fajr", "azan", "fajr.mp3");
    expect(result.current.logs[0].message).toContain(
      "Playing Audio: Fajr azan",
    );
  });

  it("should handle AUDIO_PLAY messages without onAudioPlay callback", () => {
    const { result } = renderHook(() => useSSE());
    const audioPayload = { prayer: "Fajr", event: "azan", url: "fajr.mp3" };

    act(() => {
      mockEventSource.onmessage({
        data: JSON.stringify({ type: "AUDIO_PLAY", payload: audioPayload }),
      });
    });

    expect(result.current.logs[0].message).toContain(
      "Playing Audio: Fajr azan",
    );
  });

  it("should handle PROCESS_UPDATE messages", () => {
    const { result } = renderHook(() => useSSE());
    const processPayload = { label: "Saving Settings..." };

    act(() => {
      mockEventSource.onmessage({
        data: JSON.stringify({
          type: "PROCESS_UPDATE",
          payload: processPayload,
        }),
      });
    });

    expect(result.current.processStatus).toBe("Saving Settings...");
  });

  it("should handle parse errors", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderHook(() => useSSE());

    act(() => {
      mockEventSource.onmessage({ data: "invalid json" });
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      "SSE Parse Error",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("should set isConnected to false on error", () => {
    const { result } = renderHook(() => useSSE());

    act(() => {
      mockEventSource.onopen();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      mockEventSource.onerror();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it("should close EventSource on unmount", () => {
    const { unmount } = renderHook(() => useSSE());
    unmount();
    expect(mockEventSource.close).toHaveBeenCalled();
  });
});
