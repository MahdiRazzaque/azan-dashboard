import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';
import { Power, Zap, Music, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import AutomationGeneralTab from '@/components/settings/automation/AutomationGeneralTab';
import AutomationOutputsTab from '@/components/settings/automation/AutomationOutputsTab';
import AutomationVoiceTab from '@/components/settings/automation/AutomationVoiceTab';

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 *
 * @param {...any} inputs - The class names or objects to merge.
 * @returns {string} The merged class string.
 */
function cn(...inputs) { return twMerge(clsx(inputs)); }

/**
 * A view component for managing global automation settings, including master switches
 * for different types of automated events (e.g., adhan, iqamah).
 *
 * @returns {JSX.Element} The rendered automation settings view.
 */
export default function AutomationSettingsView() {
        const {
          config,
          draftConfig, 
          updateSetting, 
          loading,
          systemHealth,
          bulkUpdateOffsets,
          bulkUpdateIqamahOffsets,
          providers
        } = useSettings();
    
        const [searchParams, setSearchParams] = useSearchParams();
        const [strategies, setStrategies] = useState([]);

        const loadStrategies = () => {
            fetch('/api/system/outputs/registry')
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch strategies');
                    return res.json();
                })
                .then(data => setStrategies(data))
                .catch(console.error);
        };
        
        // Tab State
        const activeTab = searchParams.get('tab') || 'general';
        const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

        // Lifted VoiceLibrary State
        const [voiceSearch, setVoiceSearch] = useState("");
        const [voiceLocale, setVoiceLocale] = useState("All");
        const [voiceGender, setVoiceGender] = useState("All");
    
            useEffect(() => {
                loadStrategies();
            }, []);  

  if (loading || !draftConfig) return <div className="p-8 text-center text-app-dim">Loading...</div>;

  // Health check logic for tabs
  const getTabHealth = (tabId) => {
    if (!systemHealth || !draftConfig) return true;

    if (tabId === 'outputs') {
      const outputs = draftConfig.automation?.outputs || {};
      return !Object.entries(outputs).some(([id, cfg]) => 
        cfg.enabled && systemHealth[id] && !systemHealth[id].healthy
      );
    }

    return true;
  };

  const TABS = [
      { id: 'general', label: 'General', icon: Power, healthy: true },
      { id: 'outputs', label: 'Outputs', icon: Zap, healthy: getTabHealth('outputs') },
      { id: 'voice', label: 'Voice Library', icon: Music, healthy: true }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                 <h1 className="text-3xl font-bold text-app-text">Automation & Outputs</h1>
                 <p className="text-app-dim mt-1">Manage global behavior and external services.</p>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-app-card/60 p-1 rounded-lg border border-app-border backdrop-blur-sm self-start overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap relative",
                            activeTab === tab.id 
                                ? "bg-app-bg text-app-text shadow-lg border border-app-border/50" 
                                : "text-app-dim hover:text-app-text hover:bg-app-card/80"
                        )}
                    >
                        <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? "text-emerald-500" : "text-app-dim")} />
                        {tab.label}
                        {!tab.healthy && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse ml-0.5" />
                        )}
                    </button>
                ))}
            </div>
        </div>

        <div className="min-h-[400px]">
            {activeTab === 'general' && (
                <AutomationGeneralTab 
                    config={config}
                    formData={draftConfig}
                    onChange={updateSetting}
                    bulkUpdateOffsets={bulkUpdateOffsets}
                    bulkUpdateIqamahOffsets={bulkUpdateIqamahOffsets}
                    providers={providers}
                    sources={draftConfig?.sources}
                />
            )}

            {activeTab === 'outputs' && (
                <AutomationOutputsTab 
                    strategies={strategies}
                    formData={draftConfig}
                    systemHealth={systemHealth}
                    updateSetting={updateSetting}
                />
            )}

            {activeTab === 'voice' && (
                <AutomationVoiceTab 
                    voiceSearch={voiceSearch}
                    onVoiceSearchChange={setVoiceSearch}
                    voiceLocale={voiceLocale}
                    onVoiceLocaleChange={setVoiceLocale}
                    voiceGender={voiceGender}
                    onVoiceGenderChange={setVoiceGender}
                />
            )}
        </div>
    </div>
  );
}
