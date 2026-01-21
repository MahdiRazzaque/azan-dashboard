import { Volume2, VolumeX, Settings, Monitor, Power } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ClientSettingsModal from '@/components/settings/ClientSettingsModal';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useClientPreferences } from '@/hooks/useClientPreferences';

const TopControls = ({ isMuted, toggleMute, blocked }) => {
  const [showSettings, setShowSettings] = useState(false);
  const navigate = useNavigate();
  const wakeLock = useWakeLock();
  const { preferences } = useClientPreferences();

  const handleWakeLockToggle = async () => {
    if (wakeLock.isActive) {
      await wakeLock.release();
    } else {
      await wakeLock.request();
    }
  };

  // Auto-start logic
  useEffect(() => {
    if (preferences.appearance.wakeLockAutoStart && wakeLock.isSupported && !wakeLock.isActive) {
        wakeLock.request();
    }
  }, [preferences.appearance.wakeLockAutoStart, wakeLock.isSupported]);

  const getWakeLockTitle = () => {
    if (!wakeLock.isSupported) return "Not supported (Requires HTTPS)";
    if (wakeLock.error) return `Error: ${wakeLock.error.message}. Click to retry.`;
    if (wakeLock.isActive) return "Wake Lock Active (Screen will stay on)";
    if (preferences.appearance.wakeLockAutoStart && !wakeLock.isActive) return "Wake Lock paused for this session";
    return "Enable Screen Wake Lock";
  };

  return (
    <div className="absolute top-3 right-3 lg:top-6 lg:right-6 flex gap-3 z-50">
      <button 
        onClick={handleWakeLockToggle}
        disabled={!wakeLock.isSupported}
        className={`p-2 lg:p-3 rounded-full transition-all duration-300 shadow-lg backdrop-blur-md ${
          !wakeLock.isSupported ? 'bg-app-card/50 text-app-dim cursor-not-allowed opacity-50' :
          wakeLock.error ? 'bg-app-danger/20 text-app-danger animate-pulse border border-app-danger/50' :
          wakeLock.isActive ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30' : 
          'bg-app-card hover:bg-app-card/80 text-app-dim hover:text-white'
        }`}
        title={getWakeLockTitle()}
      >
        <Power size={20} className="lg:scale-100 scale-90" />
      </button>

      <button 
        onClick={toggleMute}
        className={`p-2 lg:p-3 rounded-full transition-all duration-300 shadow-lg backdrop-blur-md ${
          blocked ? 'bg-app-danger animate-pulse text-white' : 
          isMuted ? 'bg-app-card hover:bg-app-card/80 text-app-dim' : 'bg-app-card hover:bg-app-card/80 text-app-accent'
        }`}
        title={blocked ? "Audio Blocked - Click to Enable" : isMuted ? "Unmute" : "Mute"}
      >
        {isMuted || blocked ? <VolumeX size={20} className="lg:scale-100 scale-90" /> : <Volume2 size={20} className="lg:scale-100 scale-90" />}
      </button>

      <button 
        onClick={() => setShowSettings(true)}
        className="p-2 lg:p-3 rounded-full bg-app-card hover:bg-app-card/80 transition-all duration-300 shadow-lg backdrop-blur-md text-app-dim hover:text-white"
        title="Display Settings"
      >
        <Monitor size={20} className="lg:scale-100 scale-90" />
      </button>
      
      <button 
        onClick={() => navigate('/settings')}
        className="p-2 lg:p-3 rounded-full bg-app-card hover:bg-app-card/80 transition-all duration-300 shadow-lg backdrop-blur-md text-app-dim hover:text-white"
        title="Settings"
      >
        <Settings size={20} className="lg:scale-100 scale-90" />
      </button>

      {showSettings && <ClientSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default TopControls;
