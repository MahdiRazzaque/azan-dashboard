import { Volume2, VolumeX, Settings, Monitor, Power, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import ClientSettingsModal from '@/components/settings/ClientSettingsModal';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useClientPreferences } from '@/hooks/useClientPreferences';
import { useSettings } from '@/hooks/useSettings';

const TopControls = ({ isMuted, toggleMute, blocked }) => {
  const navigate = useNavigate();
  const wakeLock = useWakeLock();
  const { preferences } = useClientPreferences();
  const { systemHealth, config } = useSettings();

  const [showSettings, setShowSettings] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [prevAutoStart, setPrevAutoStart] = useState(preferences.appearance.wakeLockAutoStart);

  // Health check logic
  const healthIssues = useMemo(() => {
    if (!systemHealth || !config) return [];
    const issues = [];
    
    // 1. Primary Source
    if (systemHealth.primarySource && !systemHealth.primarySource.healthy) {
      issues.push(`Primary Source: ${systemHealth.primarySource.message || 'Offline'}`);
    }

    // 2. TTS Service (if enabled)
    const ttsTriggersEnabled = config.automation?.triggers && Object.values(config.automation.triggers).some(prayerTriggers => 
      Object.values(prayerTriggers).some(trigger => trigger.enabled && trigger.type === 'tts')
    );
    if (ttsTriggersEnabled && systemHealth.tts && !systemHealth.tts.healthy) {
      issues.push(`TTS Service: ${systemHealth.tts.message || 'Offline'}`);
    }

    // 3. Automation Usage Check (Output disabled or unavailable)
    const outputs = config.automation?.outputs || {};
    const triggers = config.automation?.triggers || {};
    const usedOutputIssues = new Set();

    Object.entries(triggers).forEach(([prayer, prayerTriggers]) => {
      Object.entries(prayerTriggers).forEach(([type, trigger]) => {
        if (trigger.enabled) {
          (trigger.targets || []).forEach(targetId => {
            if (targetId === 'browser') return;
            
            const outputCfg = outputs[targetId];
            const health = systemHealth[targetId];
            const label = health?.label || targetId.charAt(0).toUpperCase() + targetId.slice(1);

            if (outputCfg && !outputCfg.enabled) {
              usedOutputIssues.add(`${label} is used by ${prayer} ${type} but is DISABLED`);
            } else if (health && !health.healthy) {
              usedOutputIssues.add(`${label} is used by ${prayer} ${type} but is OFFLINE`);
            }
          });
        }
      });
    });

    issues.push(...Array.from(usedOutputIssues));

    return issues;
  }, [systemHealth, config]);

  const isDegraded = healthIssues.length > 0;

  // Reset override if user toggles the setting in the modal
  if (preferences.appearance.wakeLockAutoStart !== prevAutoStart) {
    setPrevAutoStart(preferences.appearance.wakeLockAutoStart);
    setIsManuallyPaused(false);
  }

  const handleWakeLockToggle = async () => {
    if (wakeLock.isActive) {
      setIsManuallyPaused(true);
      await wakeLock.release();
    } else {
      setIsManuallyPaused(false);
      await wakeLock.request();
    }
  };

  // Auto-start logic
  useEffect(() => {
    const shouldAutoStart = preferences.appearance.wakeLockAutoStart && 
                           wakeLock.isSupported && 
                           !wakeLock.isActive && 
                           !isManuallyPaused;

    if (shouldAutoStart) {
        wakeLock.request();
    }
  }, [preferences.appearance.wakeLockAutoStart, wakeLock, isManuallyPaused]);

  const getWakeLockTitle = () => {
    if (!wakeLock.isSupported) return "Not supported (Requires HTTPS)";
    if (wakeLock.error) return `Error: ${wakeLock.error.message}. Click to retry.`;
    if (wakeLock.isActive) return "Wake Lock Active (Screen will stay on)";
    if (preferences.appearance.wakeLockAutoStart && !wakeLock.isActive) return "Wake Lock paused for this session";
    return "Enable Screen Wake Lock";
  };

  return (
    <div className="absolute top-2 right-2 lg:top-6 lg:right-6 flex gap-1.5 lg:gap-3 z-50">
      <button 
        onClick={handleWakeLockToggle}
        disabled={!wakeLock.isSupported}
        className={`p-1.5 lg:p-3 rounded-full transition-all duration-300 shadow-lg backdrop-blur-md ${
          !wakeLock.isSupported ? 'bg-app-card/50 text-app-dim cursor-not-allowed opacity-50' :
          wakeLock.error ? 'bg-app-danger/20 text-app-danger animate-pulse border border-app-danger/50' :
          wakeLock.isActive ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/30' : 
          'bg-app-card hover:bg-app-card/80 text-app-dim hover:text-white'
        }`}
        title={getWakeLockTitle()}
      >
        <Power size={18} className="lg:size-5" />
      </button>

      <button 
        onClick={toggleMute}
        className={`p-1.5 lg:p-3 rounded-full transition-all duration-300 shadow-lg backdrop-blur-md ${
          blocked ? 'bg-app-danger animate-pulse text-white' : 
          isMuted ? 'bg-app-card hover:bg-app-card/80 text-app-dim' : 'bg-app-card hover:bg-app-card/80 text-app-accent'
        }`}
        title={blocked ? "Auto-play blocked. Click to enable." : isMuted ? "Unmute" : "Mute"}
      >
        {isMuted || blocked ? <VolumeX size={18} className="lg:size-5" /> : <Volume2 size={18} className="lg:size-5" />}
      </button>

      <button 
        onClick={() => setShowSettings(true)}
        className="p-1.5 lg:p-3 rounded-full bg-app-card hover:bg-app-card/80 transition-all duration-300 shadow-lg backdrop-blur-md text-app-dim hover:text-white"
        title="Display Settings"
      >
        <Monitor size={18} className="lg:size-5" />
      </button>
      
      <div className="relative">
        <button 
          onClick={() => navigate('/settings')}
          className="p-1.5 lg:p-3 rounded-full bg-app-card hover:bg-app-card/80 transition-all duration-300 shadow-lg backdrop-blur-md text-app-dim hover:text-white"
          title={isDegraded ? `System Warning:\n${healthIssues.join('\n')}` : "Settings"}
        >
          <Settings size={18} className="lg:size-5" />
        </button>
        {isDegraded && (
          <div 
            className="absolute -top-1 -right-1 bg-amber-500 text-app-bg rounded-full p-0.5 border-2 border-app-bg shadow-sm animate-pulse"
            title={`System Warning:\n${healthIssues.join('\n')}`}
          >
            <AlertTriangle size={10} className="lg:size-3" />
          </div>
        )}
      </div>

      {showSettings && <ClientSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
};

export default TopControls;
