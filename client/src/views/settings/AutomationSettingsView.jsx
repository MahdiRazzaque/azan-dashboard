import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Save, Power, Zap, CheckCircle, XCircle, Play, BadgeCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import PasswordInput from '../../components/PasswordInput';
import ConfirmModal from '../../components/ConfirmModal';

function cn(...inputs) { return twMerge(clsx(inputs)); }

const Toggle = ({ checked, onChange, label, description }) => (
    <div className="flex items-center justify-between py-3">
        <div className="mr-4">
            <div className="font-medium text-app-text">{label}</div>
            {description && <div className="text-sm text-app-dim">{description}</div>}
        </div>
        <button 
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-app-card border-transparent",
                checked ? "bg-emerald-600" : "bg-app-card-hover"
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

  if (loading || !draftConfig) return <div className="p-8 text-center text-app-dim">Loading...</div>;

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

  const [testing, setTesting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [testError, setTestError] = useState(null);

  // FR-03 & Clean up: Removed VoiceMonkey logic

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div className="flex justify-between items-center">
            <div>
                 <h1 className="text-3xl font-bold text-app-text">Automation & Integrations</h1>
                 <p className="text-app-dim mt-1">Manage global behavior and external services.</p>
            </div>

        </div>

        {/* Global Master Switch */}
        <section className="bg-app-card p-6 rounded-lg border border-app-border shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-emerald-400 flex items-center gap-2 border-b border-app-border pb-2">
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
                
                <div className="pt-4 mt-2 border-t border-app-border space-y-4">
                     <h3 className="text-xs font-semibold text-app-dim uppercase tracking-wider">Sub-Systems Override</h3>
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

    </div>
  );
}
