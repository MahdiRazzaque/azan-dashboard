import { useCallback, useEffect, useMemo } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { usePrayerTimes } from "@/hooks/usePrayerTimes";
import { useSSE } from "@/hooks/useSSE";
import { useAudio } from "@/hooks/useAudio";
import { useAuth } from "@/hooks/useAuth";
import { useClientPreferences } from "@/hooks/useClientPreferences";
import DashboardView from "@/views/DashboardView";
import LoginView from "@/views/LoginView";
import SetupView from "@/views/SetupView";
import ConnectionErrorView from "@/views/ConnectionErrorView";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import SettingsLayout from "@/components/layout/SettingsLayout";
import GeneralSettingsView from "@/views/settings/GeneralSettingsView";
import CredentialsSettingsView from "@/views/settings/CredentialsSettingsView";
import AutomationSettingsView from "@/views/settings/AutomationSettingsView";
import PrayerSettingsView from "@/views/settings/PrayerSettingsView";
import FileManagerView from "@/views/settings/FileManagerView";
import DeveloperSettingsView from "@/views/settings/DeveloperSettingsView";

/**
 * The main application component that manages the core state, including audio playback,
 * prayer times, and real-time updates via Server-Sent Events (SSE). It also handles
 * the primary routing and authentication flow of the dashboard.
 *
 * @returns {JSX.Element} The rendered application component.
 */
function App() {
  const { preferences, isAudioExcluded } = useClientPreferences();
  const { playUrl, isMuted, toggleMute, blocked } = useAudio({
    autoUnmute: preferences.appearance.autoUnmute,
  });
  const {
    prayers,
    nextPrayer,
    lastUpdated,
    isFetching,
    refetch,
    viewedPrayers,
    viewedDate,
    referenceDate,
    transitionDate,
    transitionNonce,
    transitionPrayers,
    navigateDay,
    resetViewedDate,
    syncViewedDateToReference,
    canNavigateBackward,
    canNavigateForward,
    transitionDirection,
    isTransitioning,
    timezone,
  } = usePrayerTimes();
  const enableDateNavigation = preferences.appearance.enableDateNavigation;

  useEffect(() => {
    if (
      !enableDateNavigation &&
      (isTransitioning ||
        (viewedDate && referenceDate && viewedDate !== referenceDate))
    ) {
      syncViewedDateToReference();
    }
  }, [
    enableDateNavigation,
    isTransitioning,
    referenceDate,
    syncViewedDateToReference,
    viewedDate,
  ]);

  const dashboardViewedDate = enableDateNavigation ? viewedDate : referenceDate;
  const dashboardViewedPrayers = useMemo(() => {
    if (!enableDateNavigation) {
      return prayers;
    }

    return viewedPrayers || prayers;
  }, [enableDateNavigation, prayers, viewedPrayers]);
  const dashboardTransitionDate = enableDateNavigation ? transitionDate : null;
  const dashboardTransitionNonce = enableDateNavigation ? transitionNonce : 0;
  const dashboardTransitionPrayers = enableDateNavigation
    ? transitionPrayers
    : null;
  const dashboardCanNavigateBackward = enableDateNavigation
    ? canNavigateBackward
    : false;
  const dashboardCanNavigateForward = enableDateNavigation
    ? canNavigateForward
    : false;
  const dashboardTransitionDirection = enableDateNavigation
    ? transitionDirection
    : "future";
  const dashboardIsTransitioning = enableDateNavigation
    ? isTransitioning
    : false;

  const handleAudioPlay = useCallback(
    (prayer, event, url) => {
      if (isAudioExcluded(prayer, event)) {
        console.log(`[Audio] Skipping excluded event: ${prayer}-${event}`);
        return;
      }
      playUrl(url);
    },
    [isAudioExcluded, playUrl],
  );

  const { logs, processStatus } = useSSE(handleAudioPlay);
  const { setupRequired, loading, isAuthenticated, connectionError } =
    useAuth();
  const location = useLocation();

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center bg-app-bg text-app-text">
        Loading...
      </div>
    );

  if (connectionError) return <ConnectionErrorView />;

  // Force setup flow if required
  if (setupRequired && location.pathname !== "/setup") {
    return <Navigate to="/setup" replace />;
  }

  // Prevent accessing setup if not required
  if (!setupRequired && location.pathname === "/setup") {
    return <Navigate to="/" replace />;
  }

  // Redirect authenticated users away from login
  if (isAuthenticated && location.pathname === "/login") {
    const intendedDestination = location.state?.from?.pathname || "/";
    return <Navigate to={intendedDestination} replace />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <DashboardView
            prayers={prayers}
            viewedPrayers={dashboardViewedPrayers}
            nextPrayer={nextPrayer}
            lastUpdated={lastUpdated}
            isFetching={isFetching}
            transitionDate={dashboardTransitionDate}
            transitionNonce={dashboardTransitionNonce}
            transitionPrayers={dashboardTransitionPrayers}
            isMuted={isMuted}
            toggleMute={toggleMute}
            blocked={blocked}
            viewedDate={dashboardViewedDate}
            referenceDate={referenceDate}
            onNavigateDay={navigateDay}
            onResetToToday={resetViewedDate}
            canNavigateBackward={dashboardCanNavigateBackward}
            canNavigateForward={dashboardCanNavigateForward}
            transitionDirection={dashboardTransitionDirection}
            isTransitioning={dashboardIsTransitioning}
            timezone={timezone}
            onCountdownComplete={refetch}
          />
        }
      />

      <Route path="/setup" element={<SetupView />} />
      <Route path="/login" element={<LoginView />} />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsLayout logs={logs} processStatus={processStatus} />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="general" replace />} />
        <Route path="general" element={<GeneralSettingsView />} />
        <Route path="credentials" element={<CredentialsSettingsView />} />
        <Route path="prayers" element={<PrayerSettingsView />} />
        <Route path="automation" element={<AutomationSettingsView />} />
        <Route path="files" element={<FileManagerView />} />
        <Route path="developer" element={<DeveloperSettingsView />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
