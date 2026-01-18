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

  const { bulkUpdateOffsets } = useSettings();
  const [batchVals, setBatchVals] = useState({ preAdhan: 15, preIqamah: 10 });
  const [toast, setToast] = useState(null);

  const handleBulkUpdate = (type) => {
      const count = bulkUpdateOffsets(type, batchVals[type]);
      setToast(`Successfully updated ${count} ${type.replace(/([A-Z])/g, ' $1').toLowerCase()} triggers.`);
      setTimeout(() => setToast(null), 5000);
  };

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

        {/* Batch Adjustments Card */}
        <section className="bg-app-card p-6 rounded-xl border border-app-border shadow-xl">
            <h2 className="text-xl font-semibold mb-4 text-emerald-400 flex items-center gap-2 border-b border-app-border pb-2">
                <Zap className="w-5 h-5" />
                Batch Adjustments
            </h2>
            <p className="text-sm text-app-dim mb-6">
                Apply offset times to all prayers in one click. System will skip Sunrise for Iqamah adjustments.
            </p>
            
            <div className="space-y-6">
                 {/* Row 1: Pre-Adhan */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 bg-app-bg/20 p-4 rounded-lg border border-app-border">
                    <div className="flex-1">
                        <div className="font-medium text-app-text">Pre-Adhan Offset</div>
                        <div className="text-xs text-app-dim">Minutes before Adhan delivery</div>
                    </div>
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-2 bg-app-card border border-app-border rounded px-2 py-1">
                            <span className="text-[10px] text-app-dim font-bold uppercase">Mins</span>
                            <input 
                                type="number" 
                                min="0" 
                                max="60"
                                value={batchVals.preAdhan}
                                onChange={e => setBatchVals(prev => ({ ...prev, preAdhan: e.target.value }))}
                                className="w-12 bg-transparent border-none text-sm text-app-text focus:outline-none font-mono focus:ring-0"
                            />
                         </div>
                         <button 
                            type="button"
                            onClick={() => handleBulkUpdate('preAdhan')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded transition-colors"
                         >
                            Apply to All
                         </button>
                    </div>
                </div>

                {/* Row 2: Pre-Iqamah */}
                <div className="flex flex-col md:flex-row md:items-center gap-4 bg-app-bg/20 p-4 rounded-lg border border-app-border">
                    <div className="flex-1">
                        <div className="font-medium text-app-text">Pre-Iqamah Offset</div>
                        <div className="text-xs text-app-dim">Minutes before Iqamah delivery</div>
                    </div>
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-2 bg-app-card border border-app-border rounded px-2 py-1">
                            <span className="text-[10px] text-app-dim font-bold uppercase">Mins</span>
                            <input 
                                type="number" 
                                min="0" 
                                max="60"
                                value={batchVals.preIqamah}
                                onChange={e => setBatchVals(prev => ({ ...prev, preIqamah: e.target.value }))}
                                className="w-12 bg-transparent border-none text-sm text-app-text focus:outline-none font-mono focus:ring-0"
                            />
                         </div>
                         <button 
                            type="button"
                            onClick={() => handleBulkUpdate('preIqamah')}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded transition-colors"
                         >
                            Apply to All
                         </button>
                    </div>
                </div>
            </div>

            {/* Notification Area */}
            {toast && (
                <div className="mt-4 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-emerald-900/40 border border-emerald-500/50 rounded p-3 flex items-center gap-3 text-emerald-400 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        {toast}
                    </div>
                </div>
            )}
        </section>
    </div>
  );
}
