import { Routes, Route } from 'react-router-dom';
import { usePrayerTimes } from './hooks/usePrayerTimes';
import { useSSE } from './hooks/useSSE';
import { useAudio } from './hooks/useAudio';
import DashboardView from './views/DashboardView';
import SettingsView from './views/SettingsView';

function App() {
  const { playUrl, isMuted, toggleMute, blocked } = useAudio();
  const { prayers, nextPrayer } = usePrayerTimes();
  const { logs, isConnected } = useSSE(playUrl);

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
        <Route 
            path="/settings" 
            element={
                <SettingsView logs={logs} />
            } 
        />
        <Route 
            path="*" 
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
      </Routes>
  );
}

export default App;
