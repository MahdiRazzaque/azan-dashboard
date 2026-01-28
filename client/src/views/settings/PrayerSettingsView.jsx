import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import TriggerCard from '@/components/settings/TriggerCard';
import { validateTrigger } from '@/utils/validation';
import { Clock, AlertTriangle, Save, CheckCircle, XCircle, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
        saveSettings, 
        saving,
        isSectionDirty,
        getSectionHealth,
        resetDraft,
        systemHealth
    } = useSettings();
    const [activeTab, setActiveTab] = useState('fajr');
    const [audioFiles, setAudioFiles] = useState([]);
    const [strategies, setStrategies] = useState([]);
    
    // Local state for UI only
    const [validationErrors, setValidationErrors] = useState({});
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        // Fetch audio files for the dropdowns
        fetch('/api/system/audio-files')
            .then(res => res.json())
            .then(data => {
                // Filter out TTS/Cache files as per requirement
                const filtered = data.filter(f => f.type !== 'cache');
                setAudioFiles(filtered);
            })
            .catch(err => console.error("Failed to load audio files", err));

        // Fetch strategies for trigger card targets
        fetch('/api/system/outputs/registry')
            .then(res => res.json())
            .then(setStrategies)
            .catch(err => console.error("Failed to fetch output strategies", err));
    }, []);

    // Auto-dismiss notification
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    if (!draftConfig) {
        return <div className="p-8 text-app-dim">Loading settings...</div>;
    }

    const localConfig = draftConfig; // Alias for compatibility
    const currentPrayerSettings = localConfig.prayers[activeTab];
    const currentTriggers = localConfig.automation.triggers[activeTab];
    const isMyMasjid = localConfig.sources?.primary?.type === 'mymasjid';

    // Handler for Iqamah Config
    const updatePrayerConfig = (key, value) => {
        updateSetting(`prayers.${activeTab}.${key}`, value);
    };

    // Handler for Automation Triggers
    const updateTrigger = (triggerName, newTriggerData) => {
        // Clear error for this trigger if any when user edits
        if (validationErrors[`${activeTab}-${triggerName}`]) {
            setValidationErrors(prev => {
                const next = { ...prev };
                delete next[`${activeTab}-${triggerName}`];
                return next;
            });
        }

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


    const handleSave = async () => {
        setNotification(null);
        setValidationErrors({});
        
        let hasErrors = false;
        const newErrors = {};
        const configToSave = JSON.parse(JSON.stringify(localConfig));
        const errorsList = [];



        for (const prayer of PRAYERS) {
            const prayerTriggers = configToSave.automation.triggers[prayer];
            const triggerTypes = prayer === 'sunrise' 
                ? ['preAdhan', 'adhan'] 
                : ['preAdhan', 'adhan', 'preIqamah', 'iqamah'];

            for (const type of triggerTypes) {
                const trigger = prayerTriggers[type];
                const error = await validateTrigger(trigger);
                if (error) {
                    hasErrors = true;
                    newErrors[`${prayer}-${type}`] = error;
                    trigger.enabled = false;
                    errorsList.push(`${prayer} ${type}: ${error}`);
                } else if (trigger.enabled) {
                    // Extra Service Availability Checks
                    if (trigger.type === 'tts' && (!systemHealth.tts || !systemHealth.tts.healthy)) {
                        hasErrors = true;
                        const msg = "TTS Service is offline";
                        newErrors[`${prayer}-${type}`] = msg;
                        trigger.enabled = false;
                        errorsList.push(`${prayer} ${type}: ${msg}`);
                    }
                    
                    (trigger.targets || []).forEach(targetId => {
                        if (targetId === 'browser') return;
                        
                        const health = systemHealth[targetId];
                        const outputConfig = localConfig.automation?.outputs?.[targetId];
                        const strategy = strategies.find(s => s.id === targetId);
                        const label = strategy?.label || targetId;

                        if (outputConfig && !outputConfig.enabled) {
                            hasErrors = true;
                            const msg = `${label} output is disabled`;
                            newErrors[`${prayer}-${type}`] = msg;
                            trigger.enabled = false;
                            errorsList.push(`${prayer} ${type}: ${msg}`);
                        } else if (!health || !health.healthy) {
                            hasErrors = true;
                            const msg = `${label} output is offline`;
                            newErrors[`${prayer}-${type}`] = msg;
                            trigger.enabled = false;
                            errorsList.push(`${prayer} ${type}: ${msg}`);
                        }
                    });
                }
            }
        }

        if (hasErrors) {
            setValidationErrors(newErrors);
            // setLocalConfig(configToSave); // Removed
            setNotification({
                type: 'error',
                message: 'Some automations were invalid and have been disabled.',
                details: errorsList
            });
        }

        try {
            const result = await saveSettings(configToSave);
            if (result.success) {
                if (!hasErrors) {
                    setNotification({ type: 'success', message: 'Configuration saved successfully.' });
                }
            } else {
                 setNotification({ type: 'error', message: result.error || 'Failed to save configuration to server.' });
            }
        } catch (e) {
            console.error(e);
            setNotification({ type: 'error', message: 'An error occurred while saving.' });
        }
    };

    const isDirty = isSectionDirty('prayers') || isSectionDirty('automation.triggers');

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12 relative">
            {/* Notification Toast */}
            {notification && (
                <div className={`fixed top-6 left-1/2 -translate-x-1/2 lg:left-[calc(50%+8rem)] p-4 rounded-lg shadow-xl border backdrop-blur-md max-w-md w-[90%] z-50 animate-in slide-in-from-top-5 ${
                    notification.type === 'success' 
                    ? 'bg-emerald-900/90 border-emerald-700/50 text-emerald-100' 
                    : 'bg-red-900/90 border-red-700/50 text-red-100'
                }`}>
                    <div className="flex gap-3">
                        {notification.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                        <div>
                            <h4 className="font-semibold">{notification.message}</h4>
                            {notification.details && (
                                <ul className="mt-1 text-sm list-disc list-inside opacity-90 space-y-0.5">
                                    {notification.details.map((d, i) => <li key={i}>{d}</li>)}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

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
                                             {getSectionHealth(`prayers.${p}`).issues.map((issue, idx) => (
                                                 <li key={idx}>{issue.type}</li>
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

            {/* Warning Banner */}
            {activeTab !== 'sunrise' && isMyMasjid && currentPrayerSettings?.iqamahOverride && (
                <div className="bg-amber-900/20 border border-amber-800/50 rounded-lg p-4 flex items-start gap-4 mx-1">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-amber-200 font-medium">External Source Override Active</h4>
                        <p className="text-amber-400/80 text-sm mt-1">
                            You are using MyMasjid as a data source, but have enabled local Iqamah Overrides for {activeTab}. 
                            The dashboard will ignore the timings provided by the masjid and calculate them locally instead.
                        </p>
                    </div>
                </div>
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
                            error={validationErrors[`${activeTab}-preAdhan`]}
                            isDirty={isTriggerDirty(activeTab, 'preAdhan')}
                        />
                        <TriggerCard 
                            label={activeTab === 'sunrise' ? "2. Sunrise Time" : "2. Adhan"} 
                            eventType="adhan"
                            trigger={currentTriggers.adhan} 
                            onChange={d => updateTrigger('adhan', d)} 
                            files={audioFiles}
                            strategies={strategies}
                            error={validationErrors[`${activeTab}-adhan`]}
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
                                    error={validationErrors[`${activeTab}-preIqamah`]}
                                    isDirty={isTriggerDirty(activeTab, 'preIqamah')}
                                />
                                <TriggerCard 
                                    label="4. Iqamah" 
                                    eventType="iqamah"
                                    trigger={currentTriggers.iqamah} 
                                    onChange={d => updateTrigger('iqamah', d)} 
                                    files={audioFiles}
                            strategies={strategies}
                                    error={validationErrors[`${activeTab}-iqamah`]}
                                    isDirty={isTriggerDirty(activeTab, 'iqamah')}
                                    extraContent={(
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 mb-2">
                                                <Clock className="w-4 h-4 text-emerald-500" />
                                                <h4 className="text-sm font-semibold text-app-text flex items-center gap-2 uppercase tracking-tight">
                                                    Timing Logic
                                                    {JSON.stringify(config.prayers[activeTab]) !== JSON.stringify(localConfig.prayers[activeTab]) && (
                                                        <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                                                    )}
                                                </h4>
                                            </div>

                                            {/* Override Switch - Only Visible for MyMasjid */}
                                            {isMyMasjid && (
                                                <div className="flex items-center justify-between pb-3 border-b border-app-border">
                                                    <div>
                                                        <label className="text-xs font-medium text-app-dim">Override Masjid schedule</label>
                                                        <p className="text-[10px] text-app-dim mt-0.5">Calculate iqamah locally</p>
                                                    </div>
                                                    <button
                                                        role="switch"
                                                        aria-checked={currentPrayerSettings.iqamahOverride}
                                                        onClick={() => updatePrayerConfig('iqamahOverride', !currentPrayerSettings.iqamahOverride)}
                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                                            currentPrayerSettings.iqamahOverride ? 'bg-emerald-600' : 'bg-app-card-hover'
                                                        }`}
                                                    >
                                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-app-text transition duration-200 ease-in-out ${
                                                            currentPrayerSettings.iqamahOverride ? 'translate-x-5' : 'translate-x-1'
                                                        }`} />
                                                    </button>
                                                </div>
                                            )}

                                            {(!isMyMasjid || currentPrayerSettings.iqamahOverride) ? (
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-4">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] text-app-dim font-bold uppercase tracking-wider">Mode</label>
                                                        <div className="grid grid-cols-2 gap-1 bg-app-bg/20 p-1 rounded-lg border border-app-border">
                                                            <button
                                                                onClick={() => updatePrayerConfig('fixedTime', null)}
                                                                className={`py-1.5 text-[11px] font-medium rounded transition-all ${
                                                                    currentPrayerSettings.fixedTime === null
                                                                    ? 'bg-emerald-600 text-app-text shadow-lg'
                                                                    : 'text-app-dim hover:text-app-text'
                                                                }`}
                                                            >
                                                                Offset
                                                            </button>
                                                            <button
                                                                onClick={() => updatePrayerConfig('fixedTime', '12:00')}
                                                                className={`py-1.5 text-[11px] font-medium rounded transition-all ${
                                                                    currentPrayerSettings.fixedTime !== null
                                                                    ? 'bg-emerald-600 text-app-text shadow-lg'
                                                                    : 'text-app-dim hover:text-app-text'
                                                                }`}
                                                            >
                                                                Fixed
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {currentPrayerSettings.fixedTime === null ? (
                                                        <>
                                                            <div>
                                                                <label className="block text-[10px] text-app-dim font-bold uppercase tracking-wider mb-2">Minutes After</label>
                                                                <input 
                                                                    type="number" 
                                                                    value={currentPrayerSettings.iqamahOffset}
                                                                    onChange={e => updatePrayerConfig('iqamahOffset', parseInt(e.target.value) || 0)}
                                                                    className="w-full bg-app-bg border border-app-border rounded p-2 text-sm text-app-text focus:outline-none focus:border-emerald-500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] text-app-dim font-bold uppercase tracking-wider mb-2">Rounding</label>
                                                                <input 
                                                                    type="number" 
                                                                    value={currentPrayerSettings.roundTo}
                                                                    onChange={e => updatePrayerConfig('roundTo', parseInt(e.target.value) || 0)}
                                                                    className="w-full bg-app-bg border border-app-border rounded p-2 text-sm text-app-text focus:outline-none focus:border-emerald-500"
                                                                />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="md:col-span-2">
                                                            <label className="block text-[10px] text-app-dim font-bold uppercase tracking-wider mb-2">Set Time (HH:MM)</label>
                                                            <input 
                                                                type="time" 
                                                                value={currentPrayerSettings.fixedTime}
                                                                onChange={e => updatePrayerConfig('fixedTime', e.target.value)}
                                                                className="w-full bg-app-bg border border-app-border rounded p-2 text-sm text-app-text [color-scheme:dark] focus:outline-none focus:border-emerald-500 transition-colors"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3 py-2 px-3 bg-app-card/50 rounded-lg border border-app-border border-dashed">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                    <p className="text-app-dim text-[11px] leading-relaxed">
                                                        Following masjid schedule. Toggle <strong className="text-app-text font-semibold">Override</strong> to set custom rules.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                />
                            </>
                        )}
                    </div>
                </div>
        </div>
    );
}
