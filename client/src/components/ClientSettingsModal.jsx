import React, { useState } from 'react';
import { X, Monitor, Palette, Clock, Bell, VolumeX, Volume2, Check, Layout, Timer, AlertTriangle } from 'lucide-react';
import { useClientPreferences } from '../contexts/ClientPreferencesContext';
import { useSettings } from '../contexts/SettingsContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

const ClientSettingsModal = ({ onClose }) => {
  const { preferences, updateAppearance, toggleAudioExclusion, isAudioExcluded, muteAll, unmuteAll } = useClientPreferences();
  const { config } = useSettings();
  const [activeTab, setActiveTab] = useState('appearance');

  const prayers = [
    { id: 'fajr', label: 'Fajr' },
    { id: 'sunrise', label: 'Sunrise' },
    { id: 'dhuhr', label: 'Dhuhr' },
    { id: 'asr', label: 'Asr' },
    { id: 'maghrib', label: 'Maghrib' },
    { id: 'isha', label: 'Isha' }
  ];

  const events = [
    { id: 'preAdhan', label: 'Pre-Adhan' },
    { id: 'adhan', label: 'Adhan' },
    { id: 'preIqamah', label: 'Pre-Iqamah' },
    { id: 'iqamah', label: 'Iqamah' }
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-app-card border border-app-border rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[80vh] md:h-auto max-h-[90vh]">
        
        {/* Sidebar */}
        <div className="w-full md:w-48 bg-app-bg/50 border-b md:border-b-0 md:border-r border-app-border p-4 space-y-2">
          <div className="flex items-center gap-2 px-2 py-4 mb-2">
            <Monitor size={20} className="text-app-accent" />
            <span className="font-bold text-app-text text-sm uppercase tracking-widest">Display</span>
          </div>
          
          <button 
            onClick={() => setActiveTab('appearance')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'appearance' ? "bg-app-accent text-app-bg" : "text-app-dim hover:text-app-text hover:bg-app-card-hover"
            )}
          >
            <Palette size={18} />
            <span>Appearance</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('prayers')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
              activeTab === 'prayers' ? "bg-app-accent text-app-bg" : "text-app-dim hover:text-app-text hover:bg-app-card-hover"
            )}
          >
            <Bell size={18} />
            <span>Prayer Audio</span>
          </button>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-app-border">
            <h2 className="text-xl font-bold text-app-text capitalize">{activeTab} Settings</h2>
            <button onClick={onClose} className="p-2 text-app-dim hover:text-app-text transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            
            {activeTab === 'appearance' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Clock Format */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-app-dim">
                    <Clock size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Clock Format</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {['12h', '24h'].map(format => (
                      <button
                        key={format}
                        onClick={() => updateAppearance('clockFormat', format)}
                        className={cn(
                          "py-3 rounded-2xl border transition-all duration-300 font-medium",
                          preferences.appearance.clockFormat === format
                            ? "bg-app-accent/10 border-app-accent text-app-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.2)]"
                            : "bg-app-card border-app-border text-app-dim hover:border-app-card-hover"
                        )}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Show Seconds */}
                <div className="flex items-center justify-between p-4 bg-app-bg/30 rounded-2xl border border-app-border/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-app-text">Show Seconds</span>
                    <span className="text-xs text-app-dim">Display seconds on the main clock</span>
                  </div>
                  <button
                    onClick={() => updateAppearance('showSeconds', !preferences.appearance.showSeconds)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      preferences.appearance.showSeconds ? "bg-app-accent" : "bg-app-card-hover"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition duration-200",
                      preferences.appearance.showSeconds ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>

                {/* Countdown Mode */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-app-dim">
                    <Timer size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Countdown Style</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'normal', label: 'Natural', desc: '1hr 30min' },
                      { id: 'digital', label: 'Digital', desc: '01:30:00' },
                      { id: 'minimal', label: 'Minimal', desc: 'Smart focus' }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => updateAppearance('countdownMode', mode.id)}
                        className={cn(
                          "p-4 rounded-2xl border transition-all duration-300 text-left flex flex-col gap-1",
                          preferences.appearance.countdownMode === mode.id
                            ? "bg-app-accent/10 border-app-accent text-app-accent"
                            : "bg-app-card border-app-border text-app-dim hover:border-app-card-hover"
                        )}
                      >
                        <span className="text-sm font-bold">{mode.label}</span>
                        <span className="text-[10px] opacity-60 font-mono tracking-tighter">{mode.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Skip Sunrise in Countdown */}
                <div className="flex items-center justify-between p-4 bg-app-bg/30 rounded-2xl border border-app-border/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-app-text">Target Dhuhr after Fajr</span>
                    <span className="text-xs text-app-dim">Skip Sunrise in the main dashboard countdown</span>
                  </div>
                  <button
                    onClick={() => updateAppearance('skipSunriseCountdown', !preferences.appearance.skipSunriseCountdown)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      preferences.appearance.skipSunriseCountdown ? "bg-app-accent" : "bg-app-card-hover"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition duration-200",
                      preferences.appearance.skipSunriseCountdown ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
                </div>

                {/* Theme */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-app-dim">
                    <Palette size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Visual Theme</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'dark', label: 'Night Mode' },
                      { id: 'light', label: 'Day Mode' }
                    ].map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => updateAppearance('theme', theme.id)}
                        className={cn(
                          "py-3 rounded-2xl border transition-all duration-300 font-medium",
                          preferences.appearance.theme === theme.id
                            ? "bg-app-accent/10 border-app-accent text-app-accent"
                            : "bg-app-card border-app-border text-app-dim hover:border-app-card-hover"
                        )}
                      >
                        {theme.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prayers' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex gap-2 mb-2">
                  <button 
                    onClick={unmuteAll}
                    className="flex-1 py-3 px-4 rounded-2xl bg-app-bg/50 border border-app-border text-app-dim hover:text-app-text hover:bg-app-card-hover transition-all duration-300 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Volume2 size={14} /> Unmute All
                  </button>
                  <button 
                    onClick={muteAll}
                    className="flex-1 py-3 px-4 rounded-2xl bg-app-bg/50 border border-app-border text-app-dim hover:text-app-text hover:bg-app-card-hover transition-all duration-300 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <VolumeX size={14} /> Mute All
                  </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className="text-left py-2 px-3 text-[10px] uppercase tracking-widest text-app-dim font-bold bg-app-bg/20 backdrop-blur rounded-tl-xl">Prayer</th>
                                {events.map(e => (
                                    <th key={e.id} className="text-center py-2 px-3 text-[10px] uppercase tracking-widest text-app-dim font-bold bg-app-bg/20 backdrop-blur">{e.label.split('-')[0]}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border/50">
                            {prayers.map(p => (
                                <tr key={p.id}>
                                    <td className="py-4 px-3 text-sm font-bold text-app-dim uppercase tracking-tighter">{p.label}</td>
                                    {events.map(e => {
                                        // Skip iqamah events for sunrise
                                        if (p.id === 'sunrise' && (e.id === 'preIqamah' || e.id === 'iqamah')) {
                                            return <td key={e.id} className="py-4 px-3 text-center text-app-dim opacity-10">—</td>;
                                        }

                                        const isExcluded = isAudioExcluded(p.id, e.id);
                                        
                                        // Trigger Active Logic
                                        const globalEnabled = config?.automation?.global?.enabled ?? true;
                                        const eventTypeEnabled = config?.automation?.global?.[`${e.id}Enabled`] ?? true;
                                        const triggerEnabled = config?.automation?.triggers?.[p.id]?.[e.id]?.enabled ?? false;
                                        
                                        const isActive = globalEnabled && eventTypeEnabled && triggerEnabled;
                                        
                                        let disabledReason = null;
                                        if (!globalEnabled) disabledReason = "Automation is globally disabled";
                                        else if (!eventTypeEnabled) disabledReason = `${e.label} events are disabled globally`;
                                        else if (!triggerEnabled) disabledReason = `This automation is disabled system-wide`;

                                        return (
                                            <td key={e.id} className="py-4 px-3 text-center">
                                                <div className="relative inline-block group">
                                                    <button
                                                        onClick={() => toggleAudioExclusion(p.id, e.id)}
                                                        className={cn(
                                                            "w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-300",
                                                            isExcluded 
                                                                ? "bg-app-card border-app-border text-app-dim opacity-50 hover:bg-app-card-hover" 
                                                                : "bg-app-accent/20 border-app-accent/40 text-app-accent hover:bg-app-accent/30"
                                                        )}
                                                        title={isExcluded ? "Unmute on this device" : "Mute on this device"}
                                                    >
                                                        {isExcluded ? <VolumeX size={16} /> : <Volume2 size={16} />}
                                                    </button>
                                                    
                                                    {!isActive && (
                                                        <div 
                                                            className="absolute -top-1.5 -right-1.5 p-1 bg-amber-500 text-black rounded-full shadow-lg cursor-help z-10"
                                                            title={disabledReason}
                                                        >
                                                            <AlertTriangle size={10} strokeWidth={3} />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientSettingsModal;
