import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { usePrayerTimes } from './hooks/usePrayerTimes';
import { useSSE } from './hooks/useSSE';
import { useAudio } from './hooks/useAudio';
import { useAuth } from './contexts/AuthContext';
import DashboardView from './views/DashboardView';
import LoginView from './views/LoginView';
import SetupView from './views/SetupView';
import ProtectedRoute from './components/ProtectedRoute';
import SettingsLayout from './components/SettingsLayout';
import GeneralSettingsView from './views/settings/GeneralSettingsView';
import AccountSettingsView from './views/settings/AccountSettingsView';
import AutomationSettingsView from './views/settings/AutomationSettingsView';
import PrayerSettingsView from './views/settings/PrayerSettingsView';
import FileManagerView from './views/settings/FileManagerView';
import DeveloperSettingsView from './views/settings/DeveloperSettingsView';

function App() {
  const { playUrl, isMuted, toggleMute, blocked } = useAudio();
  const { prayers, nextPrayer } = usePrayerTimes();
  const { logs, isConnected, processStatus } = useSSE(playUrl);
  const { setupRequired, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="h-screen flex items-center justify-center bg-black text-white">Loading...</div>;

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
            <Route path="account" element={<AccountSettingsView />} />
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
