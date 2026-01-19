import React, { useState, useEffect } from 'react';
import { ClientPreferencesContext } from '../hooks/useClientPreferences';

const STORAGE_KEY = 'azan-client-prefs';

const DEFAULT_PREFERENCES = {
  appearance: {
    theme: 'dark',
    clockFormat: '24h',
    showSeconds: true,
    countdownMode: 'normal', // 'normal' | 'digital' | 'minimal'
    skipSunriseCountdown: false
  },
  audioExclusions: [] // Array of "prayer-event" strings, e.g., ["fajr-adhan"]
};

export const ClientPreferencesProvider = ({ children }) => {
  const [preferences, setPreferences] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse client preferences:', e);
      return DEFAULT_PREFERENCES;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    // Apply theme to document root
    if (preferences.appearance.theme === 'light') {
      document.documentElement.classList.add('light-mode');
    } else {
      document.documentElement.classList.remove('light-mode');
    }
  }, [preferences]);

  const updateAppearance = (key, value) => {
    setPreferences(prev => ({
      ...prev,
      appearance: {
        ...prev.appearance,
        [key]: value
      }
    }));
  };

  const toggleAudioExclusion = (prayer, event) => {
    const key = `${prayer}-${event}`;
    setPreferences(prev => {
      const current = prev.audioExclusions || [];
      const next = current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key];
      return { ...prev, audioExclusions: next };
    });
  };

  const isAudioExcluded = (prayer, event) => {
    const key = `${prayer}-${event}`;
    return (preferences.audioExclusions || []).includes(key);
  };

  const muteAll = () => {
    const allPrayers = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const exclusions = [];
    allPrayers.forEach(p => {
      const events = p === 'sunrise' ? ['preAdhan', 'adhan'] : ['preAdhan', 'adhan', 'preIqamah', 'iqamah'];
      events.forEach(e => {
        exclusions.push(`${p}-${e}`);
      });
    });
    setPreferences(prev => ({ ...prev, audioExclusions: exclusions }));
  };

  const unmuteAll = () => {
    setPreferences(prev => ({ ...prev, audioExclusions: [] }));
  };

  return (
    <ClientPreferencesContext.Provider value={{
      preferences,
      updateAppearance,
      toggleAudioExclusion,
      isAudioExcluded,
      muteAll,
      unmuteAll
    }}>
      {children}
    </ClientPreferencesContext.Provider>
  );
};
