import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "../../src/App";
import { useAuth } from "../../src/hooks/useAuth";
import { useAudio } from "../../src/hooks/useAudio";
import { usePrayerTimes } from "../../src/hooks/usePrayerTimes";
import { useSSE } from "../../src/hooks/useSSE";
import { useClientPreferences } from "../../src/hooks/useClientPreferences";

const dashboardViewSpy = vi.hoisted(() => vi.fn());

// Mock all hooks used in App
vi.mock("../../src/hooks/useAuth");
vi.mock("../../src/hooks/useAudio");
vi.mock("../../src/hooks/usePrayerTimes");
vi.mock("../../src/hooks/useSSE");
vi.mock("../../src/hooks/useClientPreferences");

// Mock views and components to simplify testing App logic
vi.mock("../../src/views/DashboardView", () => ({
  default: (props) => {
    dashboardViewSpy(props);
    return <div data-testid="dashboard-view">Dashboard</div>;
  },
}));
vi.mock("../../src/views/LoginView", () => ({
  default: () => <div data-testid="login-view">Login</div>,
}));
vi.mock("../../src/views/SetupView", () => ({
  default: () => <div data-testid="setup-view">Setup</div>,
}));
vi.mock("../../src/views/ConnectionErrorView", () => ({
  default: () => (
    <div data-testid="connection-error-view">Connection Error</div>
  ),
}));
vi.mock("../../src/components/layout/ProtectedRoute", () => ({
  default: ({ children }) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));
vi.mock("../../src/components/layout/SettingsLayout", () => ({
  default: () => <div data-testid="settings-layout">Settings</div>,
}));

describe("App", () => {
  const mockUseAuth = useAuth;
  const mockUseAudio = useAudio;
  const mockUsePrayerTimes = usePrayerTimes;
  const mockUseSSE = useSSE;
  const mockUseClientPreferences = useClientPreferences;

  beforeEach(() => {
    vi.clearAllMocks();
    dashboardViewSpy.mockClear();

    mockUseClientPreferences.mockReturnValue({
      preferences: {
        appearance: { autoUnmute: false, enableDateNavigation: true },
      },
      isAudioExcluded: vi.fn(),
    });
    mockUseAudio.mockReturnValue({
      playUrl: vi.fn(),
      isMuted: false,
      toggleMute: vi.fn(),
      blocked: false,
    });
    mockUsePrayerTimes.mockReturnValue({
      prayers: [],
      nextPrayer: null,
      lastUpdated: null,
      isFetching: false,
      refetch: vi.fn(),
      viewedPrayers: [],
      viewedDate: "2026-01-30",
      referenceDate: "2026-01-30",
      transitionDate: null,
      transitionNonce: 0,
      transitionPrayers: null,
      navigateDay: vi.fn(),
      resetViewedDate: vi.fn(),
      syncViewedDateToReference: vi.fn(),
      canNavigateBackward: true,
      canNavigateForward: true,
      transitionDirection: "future",
      isTransitioning: false,
      timezone: "UTC",
    });
    mockUseSSE.mockReturnValue({
      logs: [],
      isConnected: true,
      processStatus: {},
    });
    mockUseAuth.mockReturnValue({
      setupRequired: false,
      loading: false,
      isAuthenticated: false,
      connectionError: null,
    });
  });

  it("should render loading state", () => {
    mockUseAuth.mockReturnValue({
      loading: true,
    });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByText("Loading...")).toBeDefined();
  });

  it("should render connection error view", () => {
    mockUseAuth.mockReturnValue({
      connectionError: new Error("Failed to connect"),
    });
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("connection-error-view")).toBeDefined();
  });

  it("should redirect to /setup if setup is required and path is not /setup", () => {
    mockUseAuth.mockReturnValue({
      setupRequired: true,
      loading: false,
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    // Navigate is used, so SetupView should be rendered eventually if Router follows the redirect
    // But since it's a unit test of App component, Navigate component itself is returned.
    // MemoryRouter should handle it.
    expect(screen.getByTestId("setup-view")).toBeDefined();
  });

  it("should redirect to / (dashboard) if setup is NOT required and path is /setup", () => {
    mockUseAuth.mockReturnValue({
      setupRequired: false,
      loading: false,
    });
    render(
      <MemoryRouter initialEntries={["/setup"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-view")).toBeDefined();
  });

  it("should redirect to / (dashboard) if authenticated and path is /login with no prior location", () => {
    mockUseAuth.mockReturnValue({
      setupRequired: false,
      loading: false,
      isAuthenticated: true,
    });
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-view")).toBeDefined();
  });

  it("should redirect to intended destination if authenticated and path is /login with prior location state", () => {
    mockUseAuth.mockReturnValue({
      setupRequired: false,
      loading: false,
      isAuthenticated: true,
    });
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/login", state: { from: { pathname: "/settings" } } },
        ]}
      >
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("settings-layout")).toBeDefined();
  });

  it("should render DashboardView for root path", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("dashboard-view")).toBeDefined();
  });

  it("should snap dashboard props back to the reference day when date navigation is disabled", async () => {
    const syncViewedDateToReference = vi.fn();
    const currentDayPrayers = [{ id: "current" }];
    const viewedDayPrayers = [{ id: "viewed" }];

    mockUseClientPreferences.mockReturnValue({
      preferences: {
        appearance: { autoUnmute: false, enableDateNavigation: false },
      },
      isAudioExcluded: vi.fn(),
    });
    mockUsePrayerTimes.mockReturnValue({
      prayers: currentDayPrayers,
      nextPrayer: null,
      lastUpdated: null,
      isFetching: false,
      refetch: vi.fn(),
      viewedPrayers: viewedDayPrayers,
      viewedDate: "2026-01-31",
      referenceDate: "2026-01-30",
      transitionDate: "2026-01-31",
      transitionNonce: 7,
      transitionPrayers: viewedDayPrayers,
      navigateDay: vi.fn(),
      resetViewedDate: vi.fn(),
      syncViewedDateToReference,
      canNavigateBackward: true,
      canNavigateForward: true,
      transitionDirection: "future",
      isTransitioning: true,
      timezone: "UTC",
    });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    const latestProps = dashboardViewSpy.mock.calls.at(-1)?.[0];
    expect(latestProps.viewedPrayers).toBe(currentDayPrayers);
    expect(latestProps.viewedDate).toBe("2026-01-30");
    expect(latestProps.transitionDate).toBeNull();
    expect(latestProps.transitionPrayers).toBeNull();
    expect(latestProps.isTransitioning).toBe(false);
    expect(latestProps.canNavigateForward).toBe(false);

    await waitFor(() => expect(syncViewedDateToReference).toHaveBeenCalled());
  });

  it("should handle audio play via handleAudioPlay callback passed to useSSE", () => {
    let capturedHandleAudioPlay;
    mockUseSSE.mockImplementation((cb) => {
      capturedHandleAudioPlay = cb;
      return { logs: [], isConnected: true, processStatus: {} };
    });

    const playUrl = vi.fn();
    mockUseAudio.mockReturnValue({
      playUrl,
      isMuted: false,
      toggleMute: vi.fn(),
      blocked: false,
    });

    const isAudioExcluded = vi.fn().mockReturnValue(false);
    mockUseClientPreferences.mockReturnValue({
      preferences: { appearance: { autoUnmute: false } },
      isAudioExcluded,
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    capturedHandleAudioPlay("Fajr", "azan", "fajr.mp3");
    expect(isAudioExcluded).toHaveBeenCalledWith("Fajr", "azan");
    expect(playUrl).toHaveBeenCalledWith("fajr.mp3");
  });

  it("should skip audio play if excluded", () => {
    let capturedHandleAudioPlay;
    mockUseSSE.mockImplementation((cb) => {
      capturedHandleAudioPlay = cb;
      return { logs: [], isConnected: true, processStatus: {} };
    });

    const playUrl = vi.fn();
    mockUseAudio.mockReturnValue({
      playUrl,
      isMuted: false,
      toggleMute: vi.fn(),
      blocked: false,
    });

    const isAudioExcluded = vi.fn().mockReturnValue(true);
    mockUseClientPreferences.mockReturnValue({
      preferences: { appearance: { autoUnmute: false } },
      isAudioExcluded,
    });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    capturedHandleAudioPlay("Fajr", "azan", "fajr.mp3");
    expect(isAudioExcluded).toHaveBeenCalledWith("Fajr", "azan");
    expect(playUrl).not.toHaveBeenCalled();
  });
});
