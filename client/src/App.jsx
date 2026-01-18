import { useState, useCallback } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { usePrayerTimes } from './hooks/usePrayerTimes';
import { useSSE } from './hooks/useSSE';
import { useAudio } from './hooks/useAudio';
import { useAuth } from './contexts/AuthContext';
import { useClientPreferences } from './contexts/ClientPreferencesContext';
import DashboardView from './views/DashboardView';
import LoginView from './views/LoginView';
import SetupView from './views/SetupView';
import ProtectedRoute from './components/ProtectedRoute';
import SettingsLayout from './components/SettingsLayout';
import GeneralSettingsView from './views/settings/GeneralSettingsView';
import CredentialsSettingsView from './views/settings/CredentialsSettingsView';
import AutomationSettingsView from './views/settings/AutomationSettingsView';
import PrayerSettingsView from './views/settings/PrayerSettingsView';
import FileManagerView from './views/settings/FileManagerView';
import DeveloperSettingsView from './views/settings/DeveloperSettingsView';

function App() {
  const { playUrl, isMuted, toggleMute, blocked } = useAudio();
  const { isAudioExcluded } = useClientPreferences();
  const { prayers, nextPrayer, refetch } = usePrayerTimes();

  const handleAudioPlay = useCallback((prayer, event, url) => {
    if (isAudioExcluded(prayer, event)) {
      console.log(`[Audio] Skipping excluded event: ${prayer}-${event}`);
      return;
    }
    playUrl(url);
  }, [isAudioExcluded, playUrl]);

  const { logs, isConnected, processStatus } = useSSE(handleAudioPlay);
  const { setupRequired, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="h-screen flex items-center justify-center bg-app-bg text-app-text">Loading...</div>;

  // Force setup flow if required
  if (setupRequired && location.pathname !== '/setup') {
      return <Navigate to="/setup" replace />;
  }

  // Prevent accessing setup if not required
  if (!setupRequired && location.pathname === '/setup') {
      return <Navigate to="/login" replace />;
  }

  return (
      <Routes>
        <Route 
            path="/" 
            element={
                <DashboardView 
                    prayers={prayers} 
                    nextPrayer={nextPrayer} 
                    isMuted={isMuted} 
                    toggleMute={toggleMute} 
                    blocked={blocked} 
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

        <Route 
            path="*" 
            element={
                <Navigate to="/" replace />
            } 
        />
      </Routes>
  );
}

export default App;
