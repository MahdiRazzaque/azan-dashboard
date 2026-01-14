import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { validateTrigger } from '../utils/validation';

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [draftConfig, setDraftConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { isAuthenticated } = useAuth();


  useEffect(() => {
    if (isAuthenticated) {
      fetchSettings();
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

      prayers.forEach(prayer => {
          if (!configToSave.automation?.triggers?.[prayer]) return;
          ['preAdhan', 'adhan', 'preIqamah', 'iqamah'].forEach(type => {
              const trigger = configToSave.automation.triggers[prayer][type];
              if (trigger && trigger.enabled) {
                  const error = validateTrigger(trigger);
                  if (error) {
                      trigger.enabled = false;
                      invalidCount++;
                      const niceName = `${prayer.charAt(0).toUpperCase() + prayer.slice(1)} ${type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`;
                      warningsList.push(`${niceName}: ${error}`);
                  }
              }
          });
      });

      if (invalidCount > 0) {
          warningMessage = `${invalidCount} invalid automation(s) were disabled automatically.`;
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
        return { success: true, message: data.message, warning: warningMessage, warningsList };
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
        refresh: fetchSettings 
    }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
