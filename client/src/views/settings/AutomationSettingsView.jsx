import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Save, Power, Zap, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

const Toggle = ({ checked, onChange, label, description }) => (
    <div className="flex items-center justify-between py-3">
        <div className="mr-4">
            <div className="font-medium text-zinc-200">{label}</div>
            {description && <div className="text-sm text-zinc-500">{description}</div>}
        </div>
        <button 
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 border-transparent",
                checked ? "bg-emerald-600" : "bg-zinc-700"
            )}
        >
            <span
                className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out",
                    checked ? "translate-x-6" : "translate-x-1"
                )}
            />
        </button>
    </div>
);

export default function AutomationSettingsView() {
    const { 
      config,
      draftConfig, 
      updateSetting, 
      saveSettings, 
      resetDraft,
      saving, 
      loading,
      systemHealth
    } = useSettings();

  if (loading || !draftConfig) return <div className="p-8 text-center text-zinc-500">Loading...</div>;

  const formData = draftConfig;

  const handleChange = (path, value) => updateSetting(path, value);

  const handleSave = () => saveSettings();

  const isDirty = (() => {
      if (!config || !draftConfig) return false;
      // Check automation section excluding triggers
      const { triggers: t1, ...rest1 } = config.automation || {};
      const { triggers: t2, ...rest2 } = draftConfig.automation || {};
      return JSON.stringify(rest1) !== JSON.stringify(rest2);
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div className="flex justify-between items-center">
            <div>
                 <h1 className="text-3xl font-bold text-white">Automation & Integrations</h1>
                 <p className="text-zinc-400 mt-1">Manage global behavior and external services.</p>
            </div>

        </div>

        {/* Global Master Switch */}
        <section className="bg-zinc-900 p-6 rounded-lg border border-zinc-800 shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-emerald-400 flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Power className="w-5 h-5" />
                Master Controls
                {JSON.stringify(config?.automation?.global) !== JSON.stringify(draftConfig?.automation?.global) && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                )}
            </h2>
            <div className="space-y-2">
                <Toggle 
                    label="Global Automation Enabled" 
                    description="Master switch. Turn off to silence all output."
                    checked={formData.automation?.global?.enabled ?? true}
                    onChange={v => handleChange('automation.global.enabled', v)}
                />
                
                <div className="pt-4 mt-2 border-t border-zinc-800 space-y-4">
                     <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Sub-Systems Override</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                        <Toggle 
                            label="Pre-Adhan Events" 
                            checked={formData.automation?.global?.preAdhanEnabled ?? true}
                            onChange={v => handleChange('automation.global.preAdhanEnabled', v)}
                        />
                        <Toggle 
                            label="Adhan Events" 
                            checked={formData.automation?.global?.adhanEnabled ?? true}
                            onChange={v => handleChange('automation.global.adhanEnabled', v)}
                        />
                         <Toggle 
                            label="Pre-Iqamah Events" 
                            checked={formData.automation?.global?.preIqamahEnabled ?? true}
                            onChange={v => handleChange('automation.global.preIqamahEnabled', v)}
                        />
                         <Toggle 
                            label="Iqamah Events" 
                            checked={formData.automation?.global?.iqamahEnabled ?? true}
                            onChange={v => handleChange('automation.global.iqamahEnabled', v)}
                        />
                     </div>
                </div>
            </div>
        </section>

        {/* VoiceMonkey Integration */}
        <section className="bg-zinc-900 p-6 rounded-lg border border-zinc-800 shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-emerald-400 flex items-center gap-2 border-b border-zinc-800 pb-2">
                <Zap className="w-5 h-5" />
                VoiceMonkey Integration
                {JSON.stringify(config?.automation?.voiceMonkey) !== JSON.stringify(draftConfig?.automation?.voiceMonkey) && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                )}
                <div className="ml-auto flex items-center gap-2 text-xs font-normal opacity-75">
                    {systemHealth?.voiceMonkey?.healthy ? (
                        <span className="flex items-center gap-1 text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Online
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-red-400 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> Offline
                        </span>
                    )}
                </div>
            </h2>
             <Toggle 
                label="Enable VoiceMonkey" 
                description="Trigger Alexa routines via VoiceMonkey API."
                checked={formData.automation?.voiceMonkey?.enabled ?? false}
                onChange={v => handleChange('automation.voiceMonkey.enabled', v)}
            />
            
            {(formData.automation?.voiceMonkey?.enabled) && (
                 <div className="grid grid-cols-1 gap-6 mt-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-zinc-950 p-4 rounded-md border border-zinc-800">
                     <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Access Token</label>
                        <input 
                            type="password"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-sm"
                            value={formData.automation?.voiceMonkey?.accessToken || ''}
                            onChange={e => handleChange('automation.voiceMonkey.accessToken', e.target.value)}
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Secret Token</label>
                        <input 
                            type="password"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono text-sm"
                            value={formData.automation?.voiceMonkey?.secretToken || ''}
                            onChange={e => handleChange('automation.voiceMonkey.secretToken', e.target.value)}
                        />
                    </div>
                </div>
            )}
        </section>
    </div>
  );
}
