import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import TriggerCard from '../../components/TriggerCard';
import { validateTrigger } from '../../utils/validation';
import { Clock, AlertTriangle, Save, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export default function PrayerSettingsView() {
    const { 
        draftConfig, 
        config,
        updateSetting, 
        saveSettings, 
        saving,
        isSectionDirty
    } = useSettings();
    const [activeTab, setActiveTab] = useState('fajr');
    const [audioFiles, setAudioFiles] = useState([]);
    
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
        return <div className="p-8 text-zinc-400">Loading settings...</div>;
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
            for (const type of ['preAdhan', 'adhan', 'preIqamah', 'iqamah']) {
                const trigger = prayerTriggers[type];
                const error = await validateTrigger(trigger);
                if (error) {
                    hasErrors = true;
                    newErrors[`${prayer}-${type}`] = error;
                    // Disable it
                    trigger.enabled = false;
                    errorsList.push(`${prayer} ${type}: ${error}`);
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
            const success = await saveSettings(configToSave);
            if (success) {
                if (!hasErrors) {
                    setNotification({ type: 'success', message: 'Configuration saved successfully.' });
                }
            } else {
                 setNotification({ type: 'error', message: 'Failed to save configuration to server.' });
            }
        } catch (e) {
            console.error(e);
            setNotification({ type: 'error', message: 'An error occurred while saving.' });
        }
    };

    const isDirty = isSectionDirty('prayers') || isSectionDirty('calculation') || isSectionDirty('automation.triggers');

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

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Prayer Configuration</h2>
                    <p className="text-zinc-400">Configure timing rules and automation triggers for each prayer.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        isDirty 
                        ? "bg-orange-500 hover:bg-orange-400 text-white shadow-orange-900/20" 
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    )}
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : (isDirty ? 'Unsaved Changes' : 'Save Changes')}
                </button>
            </div>

            {/* Navigation Pills */}
            <div className="flex p-1 bg-zinc-900/50 rounded-xl border border-zinc-800 backdrop-blur-sm w-fit">
                {PRAYERS.map(p => {
                    const isDirty = isPrayerTabDirty(p);
                    return (
                    <button
                        key={p}
                        onClick={() => setActiveTab(p)}
                        className={`px-6 py-2 rounded-lg text-sm font-medium capitalize transition-all relative flex items-center gap-2 ${
                            activeTab === p 
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                    >
                        {p}
                        {isDirty && (
                            <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                        )}
                    </button>
                    );
                })}
            </div>

            {/* Warning Banner */}
            {isMyMasjid && currentPrayerSettings.iqamahOverride && (
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT COLUMN: Triggers */}
                <div className="lg:col-span-2">
                    <div className="grid grid-cols-1 gap-4">
                        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Automation Sequence
                        </h3>
                        
                        <TriggerCard 
                            label="1. Pre-Adhan" 
                            trigger={currentTriggers.preAdhan} 
                            onChange={d => updateTrigger('preAdhan', d)} 
                            files={audioFiles}
                            error={validationErrors[`${activeTab}-preAdhan`]}
                            isDirty={isTriggerDirty(activeTab, 'preAdhan')}
                        />
                         <TriggerCard 
                            label="2. Adhan" 
                            trigger={currentTriggers.adhan} 
                            onChange={d => updateTrigger('adhan', d)} 
                            files={audioFiles}
                            error={validationErrors[`${activeTab}-adhan`]}
                            isDirty={isTriggerDirty(activeTab, 'adhan')}
                        />
                         <TriggerCard 
                            label="3. Pre-Iqamah" 
                            trigger={currentTriggers.preIqamah} 
                            onChange={d => updateTrigger('preIqamah', d)} 
                            files={audioFiles}
                            error={validationErrors[`${activeTab}-preIqamah`]}
                            isDirty={isTriggerDirty(activeTab, 'preIqamah')}
                        />
                         <TriggerCard 
                            label="4. Iqamah" 
                            trigger={currentTriggers.iqamah} 
                            onChange={d => updateTrigger('iqamah', d)} 
                            files={audioFiles}
                            error={validationErrors[`${activeTab}-iqamah`]}
                            isDirty={isTriggerDirty(activeTab, 'iqamah')}
                        />
                    </div>
                </div>

                {/* RIGHT COLUMN: Timing Rules */}
                <div className="lg:col-span-1 space-y-6 mt-9">
                    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Clock className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                Iqamah Rules
                                {JSON.stringify(config.prayers[activeTab]) !== JSON.stringify(localConfig.prayers[activeTab]) && (
                                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                                )}
                            </h3>
                        </div>

                        <div className="space-y-6">
                            {/* Override Switch - Only Visible for MyMasjid */}
                            {isMyMasjid && (
                                <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                                    <div>
                                        <label className="text-sm font-medium text-zinc-300">Override Source</label>
                                        <p className="text-xs text-zinc-500 mt-0.5">Ignore masjid times and calculate locally</p>
                                    </div>
                                    <button
                                        role="switch"
                                        aria-checked={currentPrayerSettings.iqamahOverride}
                                        onClick={() => updatePrayerConfig('iqamahOverride', !currentPrayerSettings.iqamahOverride)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                            currentPrayerSettings.iqamahOverride ? 'bg-emerald-600' : 'bg-zinc-700'
                                        }`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                                            currentPrayerSettings.iqamahOverride ? 'translate-x-6' : 'translate-x-1'
                                        }`} />
                                    </button>
                                </div>
                            )}

                            {/* Show Settings IF: Not MyMasjid OR (MyMasjid AND Override Enabled) */}
                            {(!isMyMasjid || currentPrayerSettings.iqamahOverride) ? (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                                    <div className="space-y-2">
                                        <label className="text-xs text-zinc-500 font-bold uppercase">Mode</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => updatePrayerConfig('fixedTime', null)}
                                                className={`p-2 text-sm rounded border ${
                                                    currentPrayerSettings.fixedTime === null
                                                    ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400'
                                                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                                                }`}
                                            >
                                                Offset (+Min)
                                            </button>
                                            <button
                                                onClick={() => updatePrayerConfig('fixedTime', '12:00')} // Default placeholder
                                                className={`p-2 text-sm rounded border ${
                                                    currentPrayerSettings.fixedTime !== null
                                                    ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400'
                                                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                                                }`}
                                            >
                                                Fixed Time
                                            </button>
                                        </div>
                                    </div>

                                    {currentPrayerSettings.fixedTime === null ? (
                                        <>
                                            <div>
                                                <label className="block text-sm text-zinc-400 mb-1">Minutes after Adhan</label>
                                                <input 
                                                    type="number" 
                                                    value={currentPrayerSettings.iqamahOffset}
                                                    onChange={e => updatePrayerConfig('iqamahOffset', parseInt(e.target.value) || 0)}
                                                    className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm text-zinc-400 mb-1">Round To (Nearest Min)</label>
                                                <input 
                                                    type="number" 
                                                    value={currentPrayerSettings.roundTo}
                                                    onChange={e => updatePrayerConfig('roundTo', parseInt(e.target.value) || 0)}
                                                    className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-white"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <div>
                                            <label className="block text-sm text-zinc-400 mb-1">Set Time (HH:MM)</label>
                                            <input 
                                                type="time" 
                                                value={currentPrayerSettings.fixedTime}
                                                onChange={e => updatePrayerConfig('fixedTime', e.target.value)}
                                                className="w-full bg-black/40 border border-zinc-700 rounded p-2 text-white [color-scheme:dark]"
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* MyMasjid Placeholder State */
                                <div className="text-center py-6 px-4 bg-zinc-900 rounded-lg border border-zinc-800 border-dashed">
                                    <p className="text-zinc-400 text-sm">
                                        Following <strong>MyMasjid</strong> schedule.
                                    </p>
                                    <p className="text-zinc-500 text-xs mt-2">
                                        Enable override above to configure custom iqamah timing locally.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
