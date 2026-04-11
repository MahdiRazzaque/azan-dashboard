import { useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { useAudioFiles } from "@/hooks/useAudioFiles";
import { useOutputStrategies } from "@/hooks/useOutputStrategies";
import TriggerCard from "@/components/settings/TriggerCard";
import IqamahTimingCard from "@/components/settings/IqamahTimingCard";
import { Clock, AlertTriangle, Info } from "lucide-react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 *
 * @param {...any} inputs - The class names or objects to merge.
 * @returns {string} The merged class string.
 */
function cn(...inputs) { return twMerge(clsx(inputs)); }

const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

/**
 * A view component for managing prayer-specific settings, including individual 
 * automation triggers and audio event configurations for each prayer time.
 *
 * @returns {JSX.Element} The rendered prayer settings view.
 */
export default function PrayerSettingsView() {
    const { 
        draftConfig, 
        config,
        updateSetting, 
        getSectionHealth,
        providers
    } = useSettings();
    const [activeTab, setActiveTab] = useState('fajr');
    const { files: audioFiles } = useAudioFiles({
        select: (files) => files.filter(file => file.type !== 'cache')
    });
    const { strategies } = useOutputStrategies();


    if (!draftConfig) {
        return <div className="p-8 text-app-dim">Loading settings...</div>;
    }

    const localConfig = draftConfig; // Alias for compatibility
    const currentPrayerSettings = localConfig.prayers[activeTab];
    const currentTriggers = localConfig.automation.triggers[activeTab];
    

    // Handler for Iqamah Config
    const updatePrayerConfig = (key, value) => {
        updateSetting(`prayers.${activeTab}.${key}`, value);
    };

    // Handler for Automation Triggers
    const updateTrigger = (triggerName, newTriggerData) => {
        updateSetting(`automation.triggers.${activeTab}.${triggerName}`, newTriggerData);
    };

    const isTriggerDirty = (prayer, type) => {
        if (!config || !draftConfig) return false;
        const original = config.automation.triggers[prayer]?.[type];
        const current = draftConfig.automation.triggers[prayer]?.[type];
        // Simple JSON comparison for deep equality of simple objects
        return JSON.stringify(original) !== JSON.stringify(current);
    };

    const isPrayerTabDirty = (prayer) => {
        if (!config || !draftConfig) return false;
        
        // Check triggers
        const triggerTypes = ['preAdhan', 'adhan', 'preIqamah', 'iqamah'];
        const triggersChanged = triggerTypes.some(type => isTriggerDirty(prayer, type));
        
        if (triggersChanged) return true;

        // Check iqamah settings (part of prayers object)
        if (prayer === 'sunrise') return false;

        const originalSettings = config.prayers[prayer];
        const currentSettings = draftConfig.prayers[prayer];
        
        return JSON.stringify(originalSettings) !== JSON.stringify(currentSettings);
    };



    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 relative">

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-app-text mb-2">Prayer Configuration</h2>
                    <p className="text-app-dim">Configure timing rules and automation triggers for each prayer.</p>
                </div>

                <div className="flex items-start gap-3 px-3 py-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[10px] text-app-dim max-w-sm md:max-w-[240px]">
                        <Info className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <p className="leading-tight font-medium">
                            Enabled automations are automatically broadcasted to all devices with the dashboard open.
                        </p>
                    </div>
            </div>

            {/* Navigation Pills */}
            <div className="flex p-1 bg-app-bg/50 rounded-xl border border-app-border backdrop-blur-sm w-full md:w-fit overflow-x-auto md:overflow-visible flex-nowrap custom-scrollbar no-scrollbar">
                {PRAYERS.map(p => {
                    const isDirty = isPrayerTabDirty(p);
                    return (
                    <button
                        key={p}
                        onClick={() => setActiveTab(p)}
                        className={`px-4 lg:px-6 py-1.5 lg:py-2 rounded-lg text-xs lg:text-sm font-medium capitalize transition-all relative flex items-center gap-1.5 lg:gap-2 flex-shrink-0 ${
                            activeTab === p 
                            ? 'bg-emerald-600 text-app-text shadow-lg shadow-emerald-900/20' 
                            : 'text-app-dim hover:text-app-text hover:bg-app-card-hover'
                        }`}
                    >
                        {p}
                        {isDirty && (
                            <span className="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                        )}
                        {!getSectionHealth(`prayers.${p}`).healthy && (
                            <div className="relative group/tabwarning">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tabwarning:block z-50">
                                     <div className="bg-app-card border border-app-border p-2 rounded shadow-2xl text-[10px] whitespace-nowrap text-app-text">
                                         <p className="font-bold text-amber-500 mb-1 flex items-center gap-1 uppercase tracking-tighter">
                                             <AlertTriangle className="w-3 h-3" /> Service Issue
                                         </p>
                                         <ul className="space-y-0.5 list-disc list-inside">
                                              {getSectionHealth(`prayers.${p}`).issues.map((issue) => (
                                                  <li key={`${issue.type}-${issue.message || 'issue'}`}>{issue.type}</li>
                                              ))}
                                         </ul>
                                     </div>
                                     <div className="w-2 h-2 bg-app-card border-r border-b border-app-border rotate-45 mx-auto -mt-1"></div>
                                </div>
                            </div>
                        )}
                    </button>
                    );
                })}
            </div>

            {/* Iqamah Timing Card */}
            {activeTab !== 'sunrise' && (
                <IqamahTimingCard
                    key={activeTab}
                    activeTab={activeTab}
                    currentPrayerSettings={currentPrayerSettings}
                    updatePrayerConfig={updatePrayerConfig}
                    providers={providers}
                    sources={localConfig.sources}
                    isDirty={JSON.stringify(config.prayers[activeTab]) !== JSON.stringify(localConfig.prayers[activeTab])}
                />
            )}

                {/* Triggers Sequence */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-app-text mb-2 flex items-center gap-2 px-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Automation Sequence
                    </h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <TriggerCard 
                            label={activeTab === 'sunrise' ? "1. Pre-Sunrise" : "1. Pre-Adhan"} 
                            eventType="preAdhan"
                            trigger={currentTriggers.preAdhan} 
                            onChange={d => updateTrigger('preAdhan', d)} 
                            files={audioFiles}
                            strategies={strategies}
                            isDirty={isTriggerDirty(activeTab, 'preAdhan')}
                        />
                        <TriggerCard 
                            label={activeTab === 'sunrise' ? "2. Sunrise Time" : "2. Adhan"} 
                            eventType="adhan"
                            trigger={currentTriggers.adhan} 
                            onChange={d => updateTrigger('adhan', d)} 
                            files={audioFiles}
                            strategies={strategies}
                            isDirty={isTriggerDirty(activeTab, 'adhan')}
                        />
                        
                        {activeTab !== 'sunrise' && (
                            <>
                                <TriggerCard 
                                    label="3. Pre-Iqamah" 
                                    eventType="preIqamah"
                                    trigger={currentTriggers.preIqamah} 
                                    onChange={d => updateTrigger('preIqamah', d)} 
                                    files={audioFiles}
                            strategies={strategies}
                                    isDirty={isTriggerDirty(activeTab, 'preIqamah')}
                                />
                                <TriggerCard 
                                    label="4. Iqamah" 
                                    eventType="iqamah"
                                    trigger={currentTriggers.iqamah} 
                                    onChange={d => updateTrigger('iqamah', d)} 
                                    files={audioFiles}
                            strategies={strategies}
                                    isDirty={isTriggerDirty(activeTab, 'iqamah')}
                                />
                            </>
                        )}
                    </div>
                </div>
        </div>
    );
}
