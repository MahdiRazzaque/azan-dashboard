import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClientPreferencesProvider } from "../../../src/contexts/ClientPreferencesContext";
import { useClientPreferences } from "../../../src/hooks/useClientPreferences";

const TestComponent = () => {
  const {
    preferences,
    updateAppearance,
    toggleAudioExclusion,
    isAudioExcluded,
    muteAll,
    unmuteAll,
  } = useClientPreferences();
  return (
    <div>
      <div data-testid="theme">{preferences.appearance.theme}</div>
      <div data-testid="enable-date-navigation">
        {preferences.appearance.enableDateNavigation ? "Yes" : "No"}
      </div>
      <div data-testid="prayer-name-language">
        {preferences.appearance.prayerNameLanguage}
      </div>
      <div data-testid="excluded">
        {isAudioExcluded("fajr", "adhan") ? "Yes" : "No"}
      </div>
      <button onClick={() => updateAppearance("theme", "light")}>
        Light Theme
      </button>
      <button onClick={() => toggleAudioExclusion("fajr", "adhan")}>
        Toggle Fajr
      </button>
      <button onClick={() => muteAll()}>Mute All</button>
      <button onClick={() => unmuteAll()}>Unmute All</button>
    </div>
  );
};

describe("ClientPreferencesContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("should initialize with default preferences", () => {
    render(
      <ClientPreferencesProvider>
        <TestComponent />
      </ClientPreferencesProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(screen.getByTestId("enable-date-navigation").textContent).toBe(
      "Yes",
    );
    expect(screen.getByTestId("prayer-name-language").textContent).toBe(
      "english",
    );
  });

  it("should load preferences from localStorage", () => {
    const saved = {
      appearance: { theme: "light", clockFormat: "12h" },
      audioExclusions: ["fajr-adhan"],
    };
    localStorage.setItem("azan-client-prefs", JSON.stringify(saved));

    render(
      <ClientPreferencesProvider>
        <TestComponent />
      </ClientPreferencesProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(screen.getByTestId("excluded").textContent).toBe("Yes");
    expect(screen.getByTestId("enable-date-navigation").textContent).toBe(
      "Yes",
    );
    expect(screen.getByTestId("prayer-name-language").textContent).toBe(
      "english",
    );
  });

  it("should handle corrupt localStorage data", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    localStorage.setItem("azan-client-prefs", "invalid json");

    render(
      <ClientPreferencesProvider>
        <TestComponent />
      </ClientPreferencesProvider>,
    );
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should update appearance and persist to localStorage", () => {
    render(
      <ClientPreferencesProvider>
        <TestComponent />
      </ClientPreferencesProvider>,
    );

    act(() => {
      screen.getByText("Light Theme").click();
    });

    expect(screen.getByTestId("theme").textContent).toBe("light");
    const stored = JSON.parse(localStorage.getItem("azan-client-prefs"));
    expect(stored.appearance.theme).toBe("light");
    expect(document.documentElement.classList.contains("light-mode")).toBe(
      true,
    );
  });

  it("should toggle audio exclusions", () => {
    render(
      <ClientPreferencesProvider>
        <TestComponent />
      </ClientPreferencesProvider>,
    );

    act(() => {
      screen.getByText("Toggle Fajr").click();
    });
    expect(screen.getByTestId("excluded").textContent).toBe("Yes");

    act(() => {
      screen.getByText("Toggle Fajr").click();
    });
    expect(screen.getByTestId("excluded").textContent).toBe("No");
  });

  it("should mute all prayers", () => {
    render(
      <ClientPreferencesProvider>
        <TestComponent />
      </ClientPreferencesProvider>,
    );

    act(() => {
      screen.getByText("Mute All").click();
    });
    expect(screen.getByTestId("excluded").textContent).toBe("Yes");

    const stored = JSON.parse(localStorage.getItem("azan-client-prefs"));
    // Total events: 5 * 4 (fajr, dhuhr, asr, maghrib, isha) + 2 (sunrise) = 22
    expect(stored.audioExclusions.length).toBe(22);
  });

  it("should unmute all prayers", () => {
    render(
      <ClientPreferencesProvider>
        <TestComponent />
      </ClientPreferencesProvider>,
    );

    act(() => {
      screen.getByText("Mute All").click();
    });
    expect(screen.getByTestId("excluded").textContent).toBe("Yes");

    act(() => {
      screen.getByText("Unmute All").click();
    });
    expect(screen.getByTestId("excluded").textContent).toBe("No");

    const stored = JSON.parse(localStorage.getItem("azan-client-prefs"));
    expect(stored.audioExclusions.length).toBe(0);
  });
});
