/* eslint-disable jsdoc/require-jsdoc */
import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { validateTrigger, validateSourceSettings } from '@/utils/validation';
import { SettingsContext } from '@/hooks/useSettings';

const initialState = {
    config: null,
    draftConfig: null,
    systemHealth: {
        local: { healthy: false },
        tts: { healthy: false },
        voicemonkey: { healthy: false }
    },
    loading: true,
    saving: false,
    pausedPolling: false,
    voices: [],
    voicesLoading: false,
    voicesError: null,
    providers: [],
    providersLoading: false,
};

function settingsReducer(state, action) {
    switch (action.type) {
        case 'SET_CONFIG': return { ...state, config: action.value };
        case 'SET_DRAFT_CONFIG': return { ...state, draftConfig: action.value };
        case 'UPDATE_DRAFT_CONFIG': return { ...state, draftConfig: action.updater(state.draftConfig) };
        case 'SET_SYSTEM_HEALTH': return { ...state, systemHealth: action.value };
        case 'MERGE_SYSTEM_HEALTH': return { ...state, systemHealth: { ...state.systemHealth, ...action.value } };
        case 'SET_LOADING': return { ...state, loading: action.value };
        case 'SET_SAVING': return { ...state, saving: action.value };
        case 'SET_PAUSED_POLLING': return { ...state, pausedPolling: action.value };
        case 'SET_VOICES': return { ...state, voices: action.value };
        case 'SET_VOICES_LOADING': return { ...state, voicesLoading: action.value };
        case 'SET_VOICES_ERROR': return { ...state, voicesError: action.value };
        case 'SET_PROVIDERS': return { ...state, providers: action.value };
        case 'SET_PROVIDERS_LOADING': return { ...state, providersLoading: action.value };
        case 'FETCH_SETTINGS_OK': return { ...state, config: action.data, draftConfig: JSON.parse(JSON.stringify(action.data)), loading: false };
        case 'SAVE_OK': return { ...state, config: action.config, draftConfig: JSON.parse(JSON.stringify(action.config)), saving: false };
        default: return state;
    }
}

function getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined) ? acc[part] : undefined, obj);
}

function computeSectionHealth(draftConfig, systemHealth, path) {
    if (!draftConfig || !systemHealth) return { healthy: true, issues: [] };
    const section = getNestedValue(draftConfig, path);
    if (!section) return { healthy: true, issues: [] };
    const issues = [];

    const checkTrigger = (trigger, name) => {
        if (!trigger || !trigger.enabled) return;
        if (trigger.type === 'tts' && !systemHealth.tts?.healthy) {
            issues.push({ trigger: name, type: 'TTS Service Offline' });
        }
        
        (trigger.targets || []).forEach(targetId => {
            if (targetId === 'browser') return;
            
            const health = systemHealth[targetId];
            const outputConfig = draftConfig.automation?.outputs?.[targetId];
            
            if (outputConfig && !outputConfig.enabled) {
                issues.push({ trigger: name, type: `${targetId} Output Disabled` });
            } else if (health && !health.healthy) {
                issues.push({ trigger: name, type: `${targetId} Output Offline` });
            }
        });
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
}

function validateLocationConfig(location) {
    const { lat, long } = location.coordinates || {};
    const latNum = parseFloat(lat);
    const longNum = parseFloat(long);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
        return 'Validation Error: Latitude must be between -90 and 90';
    }
    if (isNaN(longNum) || longNum < -180 || longNum > 180) {
        return 'Validation Error: Longitude must be between -180 and 180';
    }
    
    try {
        Intl.DateTimeFormat(undefined, { timeZone: location.timezone });
    } catch (e) {
        return 'Validation Error: Invalid Timezone';
    }
    return null;
}

function validateSources(sources, providers) {
    const roles = ['primary', 'backup'];
    for (const role of roles) {
        const source = sources[role];
        if (!source || (role === 'backup' && source.enabled === false)) continue;

        const providerMeta = providers.find(p => p.id === source.type);
        const sourceError = validateSourceSettings(source, providerMeta);
        if (sourceError) {
            return `Validation Error (${role.toUpperCase()} Source): ${sourceError}`;
        }
    }
    return null;
}

async function validateTriggers(configToSave) {
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
        return { success: false, error: 'Verification Failed', warningsList };
    }
    return null;
}

function cloneConfig(value) {
    return JSON.parse(JSON.stringify(value));
}

async function fetchSettingsData({ pausedPolling, isAuthenticated, handleRateLimit, dispatch }) {
    if (pausedPolling) return;
    dispatch({ type: 'SET_LOADING', value: true });
    try {
        const endpoint = isAuthenticated ? '/api/settings' : '/api/settings/public';
        const res = await fetch(`${endpoint}?t=${Date.now()}`, { credentials: 'include' });
        if (res.status === 429) {
            handleRateLimit();
            return;
        }
        if (res.ok) {
            const data = await res.json();
            dispatch({ type: 'FETCH_SETTINGS_OK', data });
            return;
        }
    } catch (e) {
        console.error(e);
    } finally {
        dispatch({ type: 'SET_LOADING', value: false });
    }
}

async function fetchHealthData({ pausedPolling, handleRateLimit, dispatch }) {
    if (pausedPolling) return;
    try {
        const res = await fetch(`/api/system/health?t=${Date.now()}`, { credentials: 'include' });
        if (res.status === 429) {
            handleRateLimit();
            return;
        }
        if (res.ok || res.status === 503) {
            const data = await res.json();
            dispatch({ type: 'SET_SYSTEM_HEALTH', value: data });
        }
    } catch (e) {
        console.error('[SettingsContext] Failed to fetch health:', e);
    }
}

async function fetchVoicesData(dispatch) {
    dispatch({ type: 'SET_VOICES_LOADING', value: true });
    dispatch({ type: 'SET_VOICES_ERROR', value: null });
    try {
        const res = await fetch('/api/system/voices', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            dispatch({ type: 'SET_VOICES', value: data });
        } else {
            dispatch({ type: 'SET_VOICES_ERROR', value: 'Failed to fetch voices' });
        }
    } catch (e) {
        console.error('[SettingsContext] Failed to fetch voices:', e);
        dispatch({ type: 'SET_VOICES_ERROR', value: e.message });
    } finally {
        dispatch({ type: 'SET_VOICES_LOADING', value: false });
    }
}

async function fetchProvidersData({ isAuthenticated, dispatch }) {
    if (!isAuthenticated) return;
    dispatch({ type: 'SET_PROVIDERS_LOADING', value: true });
    try {
        const res = await fetch('/api/system/providers', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            dispatch({ type: 'SET_PROVIDERS', value: data });
        }
    } catch (e) {
        console.error('[SettingsContext] Failed to fetch providers:', e);
    } finally {
        dispatch({ type: 'SET_PROVIDERS_LOADING', value: false });
    }
}

async function refreshHealthData(dispatch, target = 'all', mode = 'silent') {
    try {
        const res = await fetch('/api/system/health/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ target, mode })
        });
        if (res.status === 429) {
            const data = await res.json();
            return { success: false, error: data.message || 'Too many requests' };
        }
        if (res.ok) {
            const data = await res.json();
            dispatch({ type: 'MERGE_SYSTEM_HEALTH', value: data });
            return data;
        }
    } catch (e) {
        console.error('[SettingsContext] Failed to refresh health:', e);
    }
}

function updateDraftSetting(dispatch, path, value) {
    dispatch({ type: 'UPDATE_DRAFT_CONFIG', updater: (prev) => {
        if (!prev) return prev;
        const next = cloneConfig(prev);
        const parts = path.split('.');
        const last = parts.pop();
        let target = next;
        for (const part of parts) {
            if (target[part] === undefined) target[part] = {};
            target = target[part];
        }
        target[last] = value;
        return next;
    }});
}

function bulkUpdateOffsetsData(dispatch, eventType, minutes) {
    const raw = parseInt(minutes);
    const clampedMinutes = isNaN(raw) ? 0 : Math.min(60, Math.max(0, raw));
    const prayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

    let count = 0;
    dispatch({ type: 'UPDATE_DRAFT_CONFIG', updater: (prev) => {
        if (!prev) return prev;
        const next = cloneConfig(prev);
        for (const prayer of prayers) {
            if (eventType === 'preIqamah' && prayer === 'sunrise') continue;
            const trigger = next.automation?.triggers?.[prayer]?.[eventType];
            if (trigger) {
                trigger.offsetMinutes = clampedMinutes;
                count++;
            }
        }
        return next;
    }});
    return count;
}

function bulkUpdateIqamahOffsetsData(dispatch, minutes) {
    const raw = parseInt(minutes);
    const clampedMinutes = isNaN(raw) ? 0 : Math.min(60, Math.max(0, raw));
    const prayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

    let count = 0;
    dispatch({ type: 'UPDATE_DRAFT_CONFIG', updater: (prev) => {
        if (!prev) return prev;
        const next = cloneConfig(prev);
        for (const prayer of prayers) {
            if (prayer === 'sunrise') continue;
            if (next.prayers?.[prayer]) {
                next.prayers[prayer].iqamahOffset = clampedMinutes;
                count++;
            }
        }
        return next;
    }});
    return count;
}

function resetDraftData(dispatch, config) {
    if (config) {
        dispatch({ type: 'SET_DRAFT_CONFIG', value: cloneConfig(config) });
    }
}

async function resetToDefaultsData({ dispatch, fetchSettings }) {
    dispatch({ type: 'SET_SAVING', value: true });
    try {
        const res = await fetch('/api/settings/reset', {
            method: 'POST',
            credentials: 'include'
        });
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
        dispatch({ type: 'SET_SAVING', value: false });
    }
}

async function saveSettingsData({ draftConfig, providers, dispatch, overrideConfig }) {
    dispatch({ type: 'SET_SAVING', value: true });
    try {
        const isEvent = overrideConfig && (overrideConfig.nativeEvent || typeof overrideConfig.preventDefault === 'function');
        let configToSave = (overrideConfig && !isEvent) ? overrideConfig : draftConfig;

        configToSave = cloneConfig(configToSave);

        if (!configToSave) {
            return { success: false, error: 'No configuration to save' };
        }

        if (configToSave.location) {
            const locationError = validateLocationConfig(configToSave.location);
            if (locationError) return { success: false, error: locationError };
        }

        if (configToSave.sources) {
            const sourceError = validateSources(configToSave.sources, providers);
            if (sourceError) return { success: false, error: sourceError };
        }

        const triggerResult = await validateTriggers(configToSave);
        if (triggerResult) return triggerResult;

        const res = await fetch('/api/settings/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
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
            dispatch({ type: 'SAVE_OK', config: configToSave });
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
        dispatch({ type: 'SET_SAVING', value: false });
    }
}

async function updateEnvSettingData({ dispatch, key, value, updateSetting, fetchSettings }) {
    dispatch({ type: 'SET_SAVING', value: true });
    try {
        const res = await fetch('/api/settings/env', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
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
        dispatch({ type: 'SET_SAVING', value: false });
    }
}

export const SettingsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(settingsReducer, initialState);
  const { config, draftConfig, systemHealth, loading, saving, pausedPolling, voices, voicesLoading, voicesError, providers, providersLoading } = state;
  
  const configRef = useRef(config);

  const { isAuthenticated } = useAuth();

  useEffect(() => {
      configRef.current = config;
  }, [config]);

  const handleRateLimit = useCallback(() => {
    console.warn('[SettingsContext] Rate limit hit. Pausing polling for 60 seconds.');
    dispatch({ type: 'SET_PAUSED_POLLING', value: true });
    setTimeout(() => {
        dispatch({ type: 'SET_PAUSED_POLLING', value: false });
    }, 60000);
  }, []);

  const fetchSettings = useCallback(() => fetchSettingsData({ pausedPolling, isAuthenticated, handleRateLimit, dispatch }), [pausedPolling, handleRateLimit, isAuthenticated]);

  const fetchHealth = useCallback(() => fetchHealthData({ pausedPolling, handleRateLimit, dispatch }), [pausedPolling, handleRateLimit]);

  const fetchVoices = useCallback(() => fetchVoicesData(dispatch), []);

  const fetchProviders = useCallback(() => fetchProvidersData({ isAuthenticated, dispatch }), [isAuthenticated]);

  useEffect(() => {
    if (!pausedPolling) {
      fetchSettings();
      fetchHealth();
      if (isAuthenticated) {
        fetchVoices();
        fetchProviders();
      }
    }
  }, [isAuthenticated, pausedPolling, fetchSettings, fetchHealth, fetchVoices, fetchProviders]);


  const refreshHealth = useCallback((target = 'all', mode = 'silent') => refreshHealthData(dispatch, target, mode), []);

  const updateSetting = useCallback((path, value) => updateDraftSetting(dispatch, path, value), []);

  const saveSettings = useCallback((overrideConfig) => saveSettingsData({ draftConfig, providers, dispatch, overrideConfig }), [draftConfig, providers]);

  const bulkUpdateOffsets = useCallback((eventType, minutes) => bulkUpdateOffsetsData(dispatch, eventType, minutes), []);

  const bulkUpdateIqamahOffsets = useCallback((minutes) => bulkUpdateIqamahOffsetsData(dispatch, minutes), []);

  const resetDraft = useCallback(() => resetDraftData(dispatch, configRef.current), []);

  const resetToDefaults = useCallback(() => resetToDefaultsData({ dispatch, fetchSettings }), [fetchSettings]);

  const hasUnsavedChanges = useCallback(() => {
      if (!config || !draftConfig) return false;
      return JSON.stringify(config) !== JSON.stringify(draftConfig);
  }, [config, draftConfig]);

  const isSectionDirty = useCallback((path) => {
      if (!config || !draftConfig) return false;
      const val1 = getNestedValue(config, path);
      const val2 = getNestedValue(draftConfig, path);
      return JSON.stringify(val1) !== JSON.stringify(val2);
  }, [config, draftConfig]);

  const getSectionHealth = useCallback((path) => {
      return computeSectionHealth(draftConfig, systemHealth, path);
  }, [draftConfig, systemHealth]);

  const updateEnvSetting = useCallback((key, value) => updateEnvSettingData({ dispatch, key, value, updateSetting, fetchSettings }), [updateSetting, fetchSettings]);

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
        bulkUpdateIqamahOffsets,
        voices,
        voicesLoading,
        voicesError,
        fetchVoices,
        providers,
        providersLoading,
        fetchProviders
    }}>
      {children}
    </SettingsContext.Provider>
  );
};
