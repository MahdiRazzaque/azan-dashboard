import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PrayerCard from "../../../../src/components/dashboard/PrayerCard";
import { useClientPreferences } from "../../../../src/hooks/useClientPreferences";

vi.mock("../../../../src/hooks/useClientPreferences");

describe("PrayerCard", () => {
  const onNavigate = vi.fn();
  const onResetToday = vi.fn();
  const mockPrayers = {
    fajr: {
      start: "2026-01-30T05:00:00.000Z",
      iqamah: "2026-01-30T05:30:00.000Z",
    },
    sunrise: { start: "2026-01-30T07:00:00.000Z" },
    dhuhr: {
      start: "2026-01-30T14:00:00.000Z",
      iqamah: "2026-01-30T14:30:00.000Z",
    },
    asr: {
      start: "2026-01-30T15:00:00.000Z",
      iqamah: "2026-01-30T15:30:00.000Z",
    },
    maghrib: {
      start: "2026-01-30T17:00:00.000Z",
      iqamah: "2026-01-30T17:15:00.000Z",
    },
    isha: {
      start: "2026-01-30T19:00:00.000Z",
      iqamah: "2026-01-30T19:30:00.000Z",
    },
  };
  const nextDayPrayers = {
    fajr: {
      start: "2026-01-31T06:00:00.000Z",
      iqamah: "2026-01-31T06:20:00.000Z",
    },
    sunrise: { start: "2026-01-31T07:30:00.000Z" },
    dhuhr: {
      start: "2026-01-31T13:10:00.000Z",
      iqamah: "2026-01-31T13:30:00.000Z",
    },
    asr: {
      start: "2026-01-31T16:10:00.000Z",
      iqamah: "2026-01-31T16:30:00.000Z",
    },
    maghrib: {
      start: "2026-01-31T17:10:00.000Z",
      iqamah: "2026-01-31T17:25:00.000Z",
    },
    isha: {
      start: "2026-01-31T20:10:00.000Z",
      iqamah: "2026-01-31T20:30:00.000Z",
    },
  };
  const previousDayPrayers = {
    fajr: {
      start: "2026-01-29T05:10:00.000Z",
      iqamah: "2026-01-29T05:25:00.000Z",
    },
    sunrise: { start: "2026-01-29T06:50:00.000Z" },
    dhuhr: {
      start: "2026-01-29T13:50:00.000Z",
      iqamah: "2026-01-29T14:10:00.000Z",
    },
    asr: {
      start: "2026-01-29T15:10:00.000Z",
      iqamah: "2026-01-29T15:25:00.000Z",
    },
    maghrib: {
      start: "2026-01-29T16:50:00.000Z",
      iqamah: "2026-01-29T17:05:00.000Z",
    },
    isha: {
      start: "2026-01-29T18:50:00.000Z",
      iqamah: "2026-01-29T19:05:00.000Z",
    },
  };

  const basePreferences = {
    appearance: {
      clockFormat: "24h",
      prayerNameLanguage: "english",
      enableDateNavigation: true,
    },
  };

  const defaultProps = {
    prayers: mockPrayers,
    nextPrayer: { name: "asr", isTomorrow: false },
    viewedDate: "2026-01-30",
    referenceDate: "2026-01-30",
    onNavigate,
    onResetToday,
    canNavigateBackward: true,
    canNavigateForward: true,
    transitionDirection: "future",
    transitionNonce: 0,
    isTransitioning: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useClientPreferences.mockReturnValue({ preferences: basePreferences });
  });

  it("renders the interactive date header and the timetable rows", () => {
    render(<PrayerCard {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Previous Day" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Next Day" })).toBeDefined();
    expect(screen.getByText("Friday, 30 January")).toBeDefined();
    expect(screen.getByText("Fajr")).toBeDefined();
    expect(screen.getByText("Start Time")).toBeDefined();
  });

  it("formats times in 24h mode", () => {
    render(<PrayerCard {...defaultProps} />);

    expect(screen.getAllByText("14:00").length).toBeGreaterThan(0);
  });

  it("formats times in 12h mode with AM/PM", () => {
    useClientPreferences.mockReturnValue({
      preferences: {
        appearance: {
          ...basePreferences.appearance,
          clockFormat: "12h",
        },
      },
    });

    render(<PrayerCard {...defaultProps} />);

    expect(screen.getAllByText("2:00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PM")[0].className).toContain("text-[0.45em]");
  });

  it("replaces the date with a loading indicator while prayer data is fetching", () => {
    render(<PrayerCard {...defaultProps} viewedDate="2026-01-31" isFetching />);

    expect(screen.getByLabelText("Loading prayer data")).toBeDefined();
    expect(screen.queryByText("Friday, 31 January")).toBeNull();
    expect(screen.getByText(/Today/)).toBeDefined();
  });

  it("does not show the Today button before a viewed date exists", () => {
    render(<PrayerCard {...defaultProps} viewedDate={null} isFetching />);

    expect(screen.getByLabelText("Loading prayer data")).toBeDefined();
    expect(screen.queryByText(/Today/)).toBeNull();
  });

  it("renders outgoing and incoming timetable panels during a day transition", () => {
    render(
      <PrayerCard
        {...defaultProps}
        isTransitioning
        transitionDirection="future"
        transitionDate="2026-01-31"
        transitionPrayers={nextDayPrayers}
      />,
    );

    expect(screen.getAllByText("Fajr")).toHaveLength(2);
    expect(screen.getByText("14:00")).toBeDefined();
    expect(screen.getByText("16:10")).toBeDefined();
    expect(screen.getByTestId("prayer-table-track").className).toContain(
      "flex",
    );
  });

  it("stages matching slide animations for future and past navigation", () => {
    const animationFrames = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => {});

    const { rerender } = render(
      <PrayerCard
        {...defaultProps}
        isTransitioning
        transitionDirection="future"
        transitionDate="2026-01-31"
        transitionNonce={1}
        transitionPrayers={nextDayPrayers}
      />,
    );

    const track = screen.getByTestId("prayer-table-track");
    expect(track.style.transition).toBe("none");
    expect(track.style.transform).toBe("translate3d(0, 0, 0)");

    act(() => {
      animationFrames.shift()?.(0);
      animationFrames.shift()?.(16);
    });

    expect(track.style.transition).toContain("transform 300ms");
    expect(track.style.transform).toBe("translate3d(-100%, 0, 0)");

    rerender(
      <PrayerCard
        {...defaultProps}
        isTransitioning
        transitionDirection="past"
        transitionDate="2026-01-29"
        transitionNonce={2}
        transitionPrayers={previousDayPrayers}
      />,
    );

    expect(track.style.transition).toBe("none");
    expect(track.style.transform).toBe("translate3d(-100%, 0, 0)");

    act(() => {
      animationFrames.shift()?.(32);
      animationFrames.shift()?.(48);
    });

    expect(track.style.transition).toContain("transform 300ms");
    expect(track.style.transform).toBe("translate3d(0, 0, 0)");

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("shows the Today button only when viewedDate differs from the reference date", () => {
    const { rerender } = render(
      <PrayerCard {...defaultProps} viewedDate="2026-01-31" />,
    );

    expect(screen.getByText(/Today/)).toBeDefined();

    fireEvent.click(screen.getByText(/Today/));
    expect(onResetToday).toHaveBeenCalled();

    rerender(<PrayerCard {...defaultProps} viewedDate="2026-01-30" />);
    expect(screen.queryByText(/Today/)).toBeNull();
  });

  it("disables the Today button while a transition is running", () => {
    render(
      <PrayerCard {...defaultProps} viewedDate="2026-01-31" isTransitioning />,
    );

    expect(screen.getByRole("button", { name: /Today/ })).toBeDisabled();
  });

  it("calls onNavigate when the chevrons are clicked", () => {
    render(<PrayerCard {...defaultProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Previous Day" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Day" }));

    expect(onNavigate).toHaveBeenNthCalledWith(1, -1);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 1);
  });

  it("disables the next-day chevron when forward navigation is unavailable", () => {
    render(<PrayerCard {...defaultProps} canNavigateForward={false} />);

    expect(screen.getByRole("button", { name: "Next Day" })).toBeDisabled();
  });

  it("responds to keyboard arrows when focus is not inside an input", () => {
    render(<PrayerCard {...defaultProps} />);

    fireEvent.keyDown(window, { key: "ArrowLeft", code: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });

    expect(onNavigate).toHaveBeenNthCalledWith(1, -1);
    expect(onNavigate).toHaveBeenNthCalledWith(2, 1);
  });

  it("ignores keyboard arrows when focus is inside an input", () => {
    render(<PrayerCard {...defaultProps} />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(window, { key: "ArrowRight", code: "ArrowRight" });

    expect(onNavigate).not.toHaveBeenCalled();
    input.remove();
  });

  it("triggers future navigation on a right-to-left swipe beyond the threshold", () => {
    const { container } = render(<PrayerCard {...defaultProps} />);

    fireEvent.touchStart(container.firstChild, {
      touches: [{ clientX: 200, clientY: 20 }],
    });
    fireEvent.touchEnd(container.firstChild, {
      changedTouches: [{ clientX: 120, clientY: 20 }],
    });

    expect(onNavigate).toHaveBeenCalledWith(1);
  });

  it("renders Arabic prayer names when that preference is enabled", () => {
    useClientPreferences.mockReturnValue({
      preferences: {
        appearance: {
          ...basePreferences.appearance,
          prayerNameLanguage: "arabic",
        },
      },
    });

    render(<PrayerCard {...defaultProps} />);

    expect(screen.getByText("فجر")).toBeDefined();
    expect(screen.getByText("ظُهْر")).toBeDefined();
  });

  it("hides all date navigation controls when the feature flag is disabled", () => {
    useClientPreferences.mockReturnValue({
      preferences: {
        appearance: {
          ...basePreferences.appearance,
          enableDateNavigation: false,
        },
      },
    });

    render(<PrayerCard {...defaultProps} viewedDate="2026-01-31" />);

    expect(screen.queryByRole("button", { name: "Previous Day" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next Day" })).toBeNull();
    expect(screen.queryByText(/Today/)).toBeNull();
  });
});
