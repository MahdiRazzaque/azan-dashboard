import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { validateTrigger } from '@/utils/validation';
import { SettingsContext } from '@/hooks/useSettings';

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
  const [pausedPolling, setPausedPolling] = useState(false);
  const [voices, setVoices] = useState([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voicesError, setVoicesError] = useState(null);
  
  // Ref to hold the latest config for stable callbacks
  const configRef = useRef(config);

  const { isAuthenticated } = useAuth();

  // Keep ref in sync with state
  useEffect(() => {
      configRef.current = config;
  }, [config]);

  const handleRateLimit = useCallback(() => {
    console.warn('[SettingsContext] Rate limit hit. Pausing polling for 60 seconds.');
    setPausedPolling(true);
    setTimeout(() => {
        setPausedPolling(false);
    }, 60000);
  }, []);

  const fetchSettings = useCallback(async () => {
    if (pausedPolling) return;
    setLoading(true);
    try {
      const endpoint = isAuthenticated ? '/api/settings' : '/api/settings/public';
      const res = await fetch(`${endpoint}?t=${Date.now()}`);
      if (res.status === 429) {
          handleRateLimit();
          return;
      }
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setDraftConfig(JSON.parse(JSON.stringify(data)));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [pausedPolling, handleRateLimit, isAuthenticated]);

  const fetchHealth = useCallback(async () => {
      if (pausedPolling) return;
      try {
          const res = await fetch(`/api/system/health?t=${Date.now()}`);
          if (res.status === 429) {
              handleRateLimit();
              return;
          }
          if (res.ok) {
              const data = await res.json();
              setSystemHealth(data);
          }
      } catch (e) {
          console.error('[SettingsContext] Failed to fetch health:', e);
      }
  }, [pausedPolling, handleRateLimit]);

  const fetchVoices = useCallback(async () => {
    setVoicesLoading(true);
    setVoicesError(null);
    try {
        const res = await fetch('/api/system/voices');
        if (res.ok) {
            const data = await res.json();
            setVoices(data);
        } else {
            setVoicesError('Failed to fetch voices');
        }
    } catch (e) {
        console.error('[SettingsContext] Failed to fetch voices:', e);
        setVoicesError(e.message);
    } finally {
        setVoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!pausedPolling) {
      fetchSettings();
      fetchHealth();
      
      if (isAuthenticated) {
        fetchVoices();
      }
    }
  }, [isAuthenticated, pausedPolling, fetchSettings, fetchHealth, fetchVoices]);


  const refreshHealth = useCallback(async (target = 'all', mode = 'silent') => {
      try {
          const res = await fetch('/api/system/health/refresh', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target, mode })
          });
          if (res.status === 429) {
              const data = await res.json();
              return { success: false, error: data.message || 'Too many requests' };
          }
          if (res.ok) {
              const data = await res.json();
              setSystemHealth(prev => ({ ...prev, ...data }));
              return data;
          }
      } catch (e) {
           console.error('[SettingsContext] Failed to refresh health:', e);
      }
  }, []);

  const updateSetting = useCallback((path, value) => {
    setDraftConfig(prev => {
        if (!prev) return prev;
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
  }, []);

  const saveSettings = useCallback(async (overrideConfig) => {
    setSaving(true);
    try {
      const isEvent = overrideConfig && (overrideConfig.nativeEvent || typeof overrideConfig.preventDefault === 'function');
      let configToSave = (overrideConfig && !isEvent) ? overrideConfig : draftConfig;

      configToSave = JSON.parse(JSON.stringify(configToSave));

      if (configToSave.location) {
          const { lat, long } = configToSave.location.coordinates || {};
          const latNum = parseFloat(lat);
          const longNum = parseFloat(long);

          if (isNaN(latNum) || latNum < -90 || latNum > 90) {
              return { success: false, error: 'Validation Error: Latitude must be between -90 and 90' };
          }
          if (isNaN(longNum) || longNum < -180 || longNum > 180) {
              return { success: false, error: 'Validation Error: Longitude must be between -180 and 180' };
          }
          
          try {
              Intl.DateTimeFormat(undefined, { timeZone: configToSave.location.timezone });
          } catch (e) {
              return { success: false, error: 'Validation Error: Invalid Timezone' };
          }
      }

      const prayers = configToSave.prayers ? Object.keys(configToSave.prayers) : [];
      let warningsList = [];
      let invalidCount = 0;

      for (const prayer of prayers) {
          if (!configToSave.automation?.triggers?.[prayer]) continue;
          for (const type of ['preAdhan', 'adhan', 'preIqamah', 'iqamah']) {
              const trigger = configToSave.automation.triggers[prayer][type];
              if (trigger && trigger.enabled) {
                  const error = await validateTrigger(trigger);
                  if (error) {
                      const niceName = `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} ${type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`;
                      warningsList.push(`${niceName}: ${error}`);
                      invalidCount++;
                  }
              }
          }
      }

      if (invalidCount > 0) {
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
      
      if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After') || 60;
          return { 
              success: false, 
              error: data.message || `Too many requests. Please wait ${retryAfter} seconds.` 
          };
      }

      if (res.ok) {
        setConfig(configToSave);
        setDraftConfig(JSON.parse(JSON.stringify(configToSave)));
        const backendWarnings = data.warnings || [];
        return { 
            success: true, 
            message: data.message, 
            warning: backendWarnings.length > 0,
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
  }, [draftConfig]);

  const bulkUpdateOffsets = useCallback((eventType, minutes) => {
    const raw = parseInt(minutes);
    const clampedMinutes = isNaN(raw) ? 0 : Math.min(60, Math.max(0, raw));
    const prayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    let count = 0;
    setDraftConfig(prev => {
        if (!prev) return prev;
        const next = JSON.parse(JSON.stringify(prev));
        for (const prayer of prayers) {
            if (eventType === 'preIqamah' && prayer === 'sunrise') continue;
            const trigger = next.automation?.triggers?.[prayer]?.[eventType];
            if (trigger) {
                trigger.offsetMinutes = clampedMinutes;
                count++;
            }
        }
        return next;
    });
    return count;
  }, []);

  const resetDraft = useCallback(() => {
      if (configRef.current) {
          setDraftConfig(JSON.parse(JSON.stringify(configRef.current)));
      }
  }, []);

  const resetToDefaults = useCallback(async () => {
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
  }, [fetchSettings]);

  const hasUnsavedChanges = useCallback(() => {
      if (!config || !draftConfig) return false;
      return JSON.stringify(config) !== JSON.stringify(draftConfig);
  }, [config, draftConfig]);

  const isSectionDirty = useCallback((path) => {
      if (!config || !draftConfig) return false;
      const getVal = (obj, p) => p.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
      const val1 = getVal(config, path);
      const val2 = getVal(draftConfig, path);
      return JSON.stringify(val1) !== JSON.stringify(val2);
  }, [config, draftConfig]);

  const getSectionHealth = useCallback((path) => {
      if (!draftConfig || !systemHealth) return { healthy: true, issues: [] };
      const getVal = (obj, p) => p.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
      const section = getVal(draftConfig, path);
      if (!section) return { healthy: true, issues: [] };
      const issues = [];
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

      if (path.startsWith('prayers.')) {
          const prayerName = path.split('.')[1];
          const prayerTriggers = draftConfig.automation?.triggers?.[prayerName];
          if (prayerTriggers) {
              Object.entries(prayerTriggers).forEach(([type, trigger]) => {
                  checkTrigger(trigger, `${prayerName} ${type}`);
              });
          }
      } else if (path === 'automation' || path === 'automation.triggers') {
          Object.entries(draftConfig.automation?.triggers || {}).forEach(([prayer, triggers]) => {
              Object.entries(triggers).forEach(([type, trigger]) => {
                  checkTrigger(trigger, `${prayer} ${type}`);
              });
          });
      } else if (path.includes('automation.triggers.')) {
          const parts = path.split('.');
          const prayer = parts[2];
          const type = parts[3];
          const trigger = draftConfig.automation?.triggers?.[prayer]?.[type];
          if (trigger) checkTrigger(trigger, `${prayer} ${type}`);
      }
      return { healthy: issues.length === 0, issues };
  }, [draftConfig, systemHealth]);

  const updateEnvSetting = useCallback(async (key, value) => {
    setSaving(true);
    try {
        const res = await fetch('/api/settings/env', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
        });
        const data = await res.json();
        if (res.ok) {
            const path = key === 'BASE_URL' ? 'automation.baseUrl' : `automation.${key}`;
            updateSetting(path, value);
            await fetchSettings();
            return { success: true };
        } else {
            return { success: false, error: data.message || 'Update failed' };
        }
    } catch (e) {
        return { success: false, error: e.message };
    } finally {
        setSaving(false);
    }
  }, [updateSetting, fetchSettings]);

  return (
    <SettingsContext.Provider value={{ 
        config, 
        draftConfig, 
        loading, 
        saving, 
        saveSettings, 
        updateSetting,
        updateEnvSetting,
        resetDraft,
        resetToDefaults,
        hasUnsavedChanges,
        isSectionDirty,
        getSectionHealth,
        refresh: fetchSettings,
        systemHealth,
        refreshHealth,
        validateBeforeSave: () => ({ success: true }),
        bulkUpdateOffsets,
        voices,
        voicesLoading,
        voicesError,
        fetchVoices
    }}>
      {children}
    </SettingsContext.Provider>
  );
};