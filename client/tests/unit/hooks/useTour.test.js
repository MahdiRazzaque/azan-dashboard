import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useTour } from "../../../src/hooks/useTour";
import { driver as driverMock } from "driver.js";

vi.mock("driver.js", () => ({
  driver: vi.fn(),
}));

describe("useTour", () => {
  beforeEach(() => {
    driverMock.mockReset();
    driverMock.mockReturnValue({
      drive: vi.fn(),
      destroy: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
      moveNext: vi.fn(),
    });
    vi.spyOn(document, "addEventListener");
    vi.spyOn(document, "removeEventListener");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("initializes with inactive state", () => {
    const { result } = renderHook(() => useTour());
    expect(result.current.isActive).toBe(false);
    expect(result.current.currentTour).toBeNull();
  });

  it("filters steps with missing elements before driving", async () => {
    document.body.innerHTML = '<div id="existing"></div>';
    const steps = [
      { element: "#existing", popover: { title: "One" } },
      { element: "#missing", popover: { title: "Two" } },
    ];
    const { result } = renderHook(() => useTour());

    await act(async () => {
      await result.current.startTour("dashboard", steps);
    });

    const driverInstance = driverMock.mock.results[0].value;
    expect(driverMock).toHaveBeenCalledWith(
      expect.objectContaining({ steps: [steps[0]] }),
    );
    expect(driverInstance.drive).toHaveBeenCalledWith();
    expect(result.current.isActive).toBe(true);
    expect(result.current.currentTour).toBe("dashboard");
  });

  it("calls destroy only when driver is active", async () => {
    const activeInstance = {
      drive: vi.fn(),
      destroy: vi.fn(),
      isActive: vi.fn().mockReturnValue(true),
      moveNext: vi.fn(),
    };
    const inactiveInstance = {
      drive: vi.fn(),
      destroy: vi.fn(),
      isActive: vi.fn().mockReturnValue(false),
      moveNext: vi.fn(),
    };
    driverMock.mockReset();
    driverMock
      .mockReturnValueOnce(activeInstance)
      .mockReturnValueOnce(inactiveInstance);

    document.body.innerHTML = '<div id="existing"></div>';
    const steps = [{ element: "#existing" }];
    const { result } = renderHook(() => useTour());

    await act(async () => {
      await result.current.startTour("dashboard", steps);
    });
    act(() => {
      result.current.stopTour();
    });
    expect(activeInstance.destroy).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.startTour("dashboard", steps);
    });
    act(() => {
      result.current.stopTour();
    });
    expect(inactiveInstance.destroy).not.toHaveBeenCalled();
  });

  it("does not throw when driver is null or destroy throws", async () => {
    const { result } = renderHook(() => useTour());
    act(() => {
      expect(() => result.current.stopTour()).not.toThrow();
    });

    document.body.innerHTML = '<div id="existing"></div>';
    const driverInstance = {
      drive: vi.fn(),
      destroy: vi.fn(() => {
        throw new DOMException("fail");
      }),
      isActive: vi.fn().mockReturnValue(true),
      moveNext: vi.fn(),
    };
    driverMock.mockReset();
    driverMock.mockReturnValue(driverInstance);

    await act(async () => {
      await result.current.startTour("dashboard", [{ element: "#existing" }]);
    });
    act(() => {
      expect(() => result.current.stopTour()).not.toThrow();
    });
  });

  it("mounts and unmounts the spacebar listener", async () => {
    document.body.innerHTML = '<div id="existing"></div>';
    const { result } = renderHook(() => useTour());

    await act(async () => {
      await result.current.startTour("dashboard", [{ element: "#existing" }]);
    });

    const addCall = document.addEventListener.mock.calls.find(
      (call) => call[0] === "keydown",
    );
    const handler = addCall?.[1];
    expect(handler).toBeTruthy();

    act(() => {
      result.current.stopTour();
    });

    expect(document.removeEventListener).toHaveBeenCalledWith(
      "keydown",
      handler,
      { capture: true },
    );
  });

  it("spacebar handler prevents scroll and advances the tour", async () => {
    const driverInstance = {
      drive: vi.fn(),
      destroy: vi.fn(),
      isActive: vi.fn().mockReturnValue(true),
      moveNext: vi.fn(),
    };
    driverMock.mockReset();
    driverMock.mockReturnValue(driverInstance);

    document.body.innerHTML = '<div id="existing"></div>';
    const { result } = renderHook(() => useTour());

    await act(async () => {
      await result.current.startTour("dashboard", [{ element: "#existing" }]);
    });

    const addCall = document.addEventListener.mock.calls.find(
      (call) => call[0] === "keydown",
    );
    const handler = addCall?.[1];
    const event = {
      code: "Space",
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    handler(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(driverInstance.moveNext).toHaveBeenCalledTimes(1);
  });

  it("fires onDestroyStarted callback when tour completes", async () => {
    document.body.innerHTML = '<div id="existing"></div>';
    const onComplete = vi.fn();
    const { result } = renderHook(() => useTour());

    await act(async () => {
      await result.current.startTour(
        "dashboard",
        [{ element: "#existing" }],
        onComplete,
      );
    });

    const config = driverMock.mock.calls[0][0];
    act(() => {
      config.onDestroyStarted();
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("cleans up driver and listeners on unmount", async () => {
    const driverInstance = {
      drive: vi.fn(),
      destroy: vi.fn(),
      isActive: vi.fn().mockReturnValue(true),
      moveNext: vi.fn(),
    };
    driverMock.mockReset();
    driverMock.mockReturnValue(driverInstance);

    document.body.innerHTML = '<div id="existing"></div>';
    const { result, unmount } = renderHook(() => useTour());

    await act(async () => {
      await result.current.startTour("dashboard", [{ element: "#existing" }]);
    });

    unmount();
    expect(driverInstance.destroy).toHaveBeenCalledTimes(1);
    expect(document.removeEventListener).toHaveBeenCalled();
  });
});
