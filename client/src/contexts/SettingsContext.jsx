import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { validateTrigger } from '../utils/validation';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [draftConfig, setDraftConfig] = useState(null);
  const [systemHealth, setSystemHealth] = useState({ 
      local: { healthy: true }, 
      tts: { healthy: true }, 
      voiceMonkey: { healthy: true } 
  }); // Default optimistic
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { isAuthenticated } = useAuth();


  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
      fetchHealth();
    }
  }, [isAuthenticated]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        // Reset draft on fresh fetch
        setDraftConfig(JSON.parse(JSON.stringify(data)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
      try {
          const res = await fetch('/api/system/health');
          if (res.ok) {
              const data = await res.json();
              setSystemHealth(data);
          }
      } catch (e) {
          console.error('[SettingsContext] Failed to fetch health:', e);
      }
  };

  const refreshHealth = async (target = 'all', mode = 'silent') => {
      try {
          const res = await fetch('/api/system/health/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target, mode })
          });
          if (res.ok) {
              const data = await res.json();
              setSystemHealth(prev => ({ ...prev, ...data }));
              return data;
          }
      } catch (e) {
           console.error('[SettingsContext] Failed to refresh health:', e);
      }
  };

  const updateSetting = (path, value) => {
    setDraftConfig(prev => {
        const next = JSON.parse(JSON.stringify(prev));
        const parts = path.split('.');
        const last = parts.pop();
        let target = next;
        for (const part of parts) {
            if (target[part] === undefined) target[part] = {};
            target = target[part];
        }
        target[last] = value;
        return next;
    });
  };

  const saveSettings = async (overrideConfig) => {
    setSaving(true);
    try {
      // Guard against event objects accidentally passed
      const isEvent = overrideConfig && (overrideConfig.nativeEvent || typeof overrideConfig.preventDefault === 'function');
      let configToSave = (overrideConfig && !isEvent) ? overrideConfig : draftConfig;

      // Deep clone to avoid mutating state directly during validation
      configToSave = JSON.parse(JSON.stringify(configToSave));

      // VALIDATION: Check for invalid triggers and disable them
      const prayers = configToSave.prayers ? Object.keys(configToSave.prayers) : [];
      let warningMessage = null;
      let warningsList = [];
      let invalidCount = 0;

      for (const prayer of prayers) {
          if (!configToSave.automation?.triggers?.[prayer]) continue;
          for (const type of ['preAdhan', 'adhan', 'preIqamah', 'iqamah']) {
              const trigger = configToSave.automation.triggers[prayer][type];
              if (trigger && trigger.enabled) {
                  const error = await validateTrigger(trigger);
                  if (error) {
                      // FR-03: Abort save on validation error
                      const niceName = `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} ${type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`;
                      warningsList.push(`${niceName}: ${error}`);
                      invalidCount++;
                  }
                  // Soft Warning checks removed (Frontend). Backend handles service warnings.
              }
          }
      }

      if (invalidCount > 0) {
          // FR-03: Abort immediately, do not save
          return { 
              success: false, 
              error: 'Verification Failed', 
              warningsList 
          };
      }

      const res = await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave)
      });
      const data = await res.json();
      
      if (res.ok) {
        setConfig(configToSave);
        // Sync draft with the sanitized config
        setDraftConfig(JSON.parse(JSON.stringify(configToSave)));
        
        // Merge backend warnings
        const backendWarnings = data.warnings || [];
        return { 
            success: true, 
            message: data.message, 
            warning: backendWarnings.length > 0, // Boolean flag for modal
            warningsList: backendWarnings 
        };
      } else {
        console.error('Save failed', data.error);
        return { success: false, error: data.error };
      }
    } catch (e) {
      console.error(e);
      return { success: false, error: e.message };
    } finally {
      setSaving(false);
    }
  };

  const resetDraft = () => {
      if (config) {
          setDraftConfig(JSON.parse(JSON.stringify(config)));
      }
  };

  const resetToDefaults = async () => {
     // Confirmation is now handled by the UI component
     setSaving(true);
     try {
         const res = await fetch('/api/settings/reset', { method: 'POST' });
         if (res.ok) {
             await fetchSettings();
             return { success: true };
         } else {
             const err = await res.json();
             return { success: false, error: err.error };
         }
     } catch (e) {
         console.error(e);
         return { success: false, error: e.message };
     } finally {
         setSaving(false);
     }
  };


  const hasUnsavedChanges = () => {
      if (!config || !draftConfig) return false;
      return JSON.stringify(config) !== JSON.stringify(draftConfig);
  };

    const isSectionDirty = (path) => {
      if (!config || !draftConfig) return false;
      const getVal = (obj, p) => p.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
      const val1 = getVal(config, path);
      const val2 = getVal(draftConfig, path);
      return JSON.stringify(val1) !== JSON.stringify(val2);
  };

  const getSectionHealth = (path) => {
      if (!draftConfig || !systemHealth) return { healthy: true, issues: [] };
      
      const getVal = (obj, p) => p.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
      const section = getVal(draftConfig, path);
      
      if (!section) return { healthy: true, issues: [] };

      const issues = [];
      
      // Helper to check a single trigger
      const checkTrigger = (trigger, name) => {
          if (!trigger || !trigger.enabled) return;
          
          if (trigger.type === 'tts' && !systemHealth.tts?.healthy) {
              issues.push({ trigger: name, type: 'TTS Service Offline' });
          }
          
          if (trigger.targets?.includes('local') && !systemHealth.local?.healthy) {
              issues.push({ trigger: name, type: 'Local Audio Offline' });
          }
          
          if ((trigger.targets?.includes('voiceMonkey') || trigger.type === 'voiceMonkey') && !systemHealth.voiceMonkey?.healthy) {
              issues.push({ trigger: name, type: systemHealth.voiceMonkey?.message || 'VoiceMonkey Offline' });
          }
      };

      // If path is a prayer (e.g. 'prayers.fajr'), check triggers in 'automation.triggers.fajr'
      if (path.startsWith('prayers.')) {
          const prayerName = path.split('.')[1];
          const prayerTriggers = draftConfig.automation?.triggers?.[prayerName];
          if (prayerTriggers) {
              Object.entries(prayerTriggers).forEach(([type, trigger]) => {
                  checkTrigger(trigger, `${prayerName} ${type}`);
              });
          }
      } 
      // If path is 'automation', check all triggers
      else if (path === 'automation' || path === 'automation.triggers') {
          Object.entries(draftConfig.automation?.triggers || {}).forEach(([prayer, triggers]) => {
              Object.entries(triggers).forEach(([type, trigger]) => {
                  checkTrigger(trigger, `${prayer} ${type}`);
              });
          });
      }
      // If path is a specific trigger
      else if (path.includes('automation.triggers.')) {
          const parts = path.split('.');
          const prayer = parts[2];
          const type = parts[3];
          const trigger = draftConfig.automation?.triggers?.[prayer]?.[type];
          if (trigger) checkTrigger(trigger, `${prayer} ${type}`);
      }

      return {
          healthy: issues.length === 0,
          issues
      };
  };

  const validateBeforeSave = () => {
      // Legacy VoiceMonkey validation removed as it is now handled in Credentials with 'Verify-to-Save'
      return { success: true };
  };

  return (
    <SettingsContext.Provider value={{ 
        config, 
        draftConfig, 
        loading, 
        saving, 
        saveSettings, 
        updateSetting,
        resetDraft,
        resetToDefaults,
        hasUnsavedChanges,
        isSectionDirty,
        getSectionHealth,
        refresh: fetchSettings,
        systemHealth,
        refreshHealth,
        validateBeforeSave
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
