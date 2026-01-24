import { Server, Monitor, Zap, AlertTriangle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSettings } from '@/hooks/useSettings';
import SearchableSelect from '@/components/common/SearchableSelect';

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 *
 * @param {...any} inputs - The class names or objects to merge.
 * @returns {string} The merged class string.
 */
function cn(...inputs) { return twMerge(clsx(inputs)); }

/**
 * A card component representing an automation trigger, allowing users to configure
 * audio files and view the current activation status.
 *
 * @param {object} props - The component props.
 * @param {string} props.label - The display name of the trigger.
 * @param {object} props.trigger - The trigger configuration object.
 * @param {Function} props.onChange - Callback function for when trigger settings change.
 * @param {Array} props.files - A list of available audio files for selection.
 * @param {string} [props.error] - An optional error message to display.
 * @param {boolean} [props.isDirty] - Whether the trigger state has unsaved changes.
 * @param {string} props.eventType - The type of event this trigger belongs to (e.g., 'adhan').
 * @param {React.ReactNode} [props.extraContent] - Optional additional content to render in the card.
 * @returns {JSX.Element} The rendered trigger card component.
 */
export default function TriggerCard({ label, trigger, onChange, files, error, isDirty, eventType, extraContent }) {
    const { systemHealth, config, voices } = useSettings();
    
    // Cascading Master Switch Logic - Returns { disabled: boolean, reason: string }
    const masterSwitchState = (() => {
        if (!config?.automation?.global) return { disabled: false, reason: '' };
        
        // 1. Check Global Master
        if (config.automation.global.enabled === false) {
             return { disabled: true, reason: 'Global Automation Disabled' };
        }
        
        // 2. Check Event Type Master
        if (eventType) {
            const map = {
                'preAdhan': 'preAdhanEnabled',
                'adhan': 'adhanEnabled',
                'preIqamah': 'preIqamahEnabled',
                'iqamah': 'iqamahEnabled'
            };
            const key = map[eventType];
            if (key && config.automation.global[key] === false) {
                 return { disabled: true, reason: `${eventType.replace(/([A-Z])/g, ' $1').trim()} Disabled` };
            }
        }
        return { disabled: false, reason: '' };
    })();
    
    const isDisabledByMaster = masterSwitchState.disabled;

    const update = (key, val) => {
        onChange({ ...trigger, [key]: val });
    };

    const toggleTarget = (target) => {
        const current = trigger.targets || [];
        if (current.includes(target)) {
            update('targets', current.filter(t => t !== target));
        } else {
            update('targets', [...current, target]);
        }
    };

    return (
        <div className={cn(
            "rounded-lg border transition-all duration-300 relative",
            isDisabledByMaster 
                ? "bg-app-bg/10 border-app-border opacity-60 grayscale overflow-hidden" 
                : trigger.enabled 
                    ? "bg-app-card/50 border-app-border p-4 overflow-visible" 
                    : "bg-app-card/20 border-app-border opacity-75 p-4 overflow-hidden"
        )}>
             {isDisabledByMaster && (
                 <div className="absolute inset-0 z-10 flex items-center justify-center bg-app-bg/20 backdrop-blur-[1px]">
                     <div className="bg-app-card/90 px-4 py-2 rounded border border-app-border text-xs font-bold text-app-dim uppercase tracking-wider shadow-xl flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-app-dim/50"></div>
                         Disabled by {masterSwitchState.reason.includes('Global') ? 'Global Switch' : 'Sub-System'}
                     </div>
                 </div>
             )}
             
             <div className={cn("flex items-center justify-between", (!trigger.enabled || isDisabledByMaster) ? "p-3" : "mb-4")}>
                 <div className="flex items-center gap-2">
                    <h4 className={cn("font-semibold transition-colors", isDisabledByMaster ? "text-app-dim" : "text-app-text")}>{label}</h4>
                     
                     {/* Unsaved Changes Indicator */}
                     {isDirty && (
                         <div className="relative group/unsaved ml-2">
                             <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] block cursor-help"></span>
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/unsaved:block z-50">
                                 <div className="bg-app-card border border-app-border px-2 py-1 rounded shadow-xl text-[10px] whitespace-nowrap text-app-text font-medium">
                                     Unsaved Changes
                                 </div>
                                 <div className="w-2 h-2 bg-app-card border-r border-b border-app-border rotate-45 mx-auto -mt-1"></div>
                             </div>
                         </div>
                     )}
                     
                      {/* Warning icon if enabled but underlying service is dead or incompatible */}
                     {(() => {
                         if (!trigger.enabled || isDisabledByMaster) return null;
                         
                         const issues = [];
                         if (trigger.type === 'tts' && !systemHealth.tts?.healthy) issues.push('TTS Service Offline');
                         if (trigger.targets?.includes('local') && !systemHealth.local?.healthy) issues.push('Local Audio (mpg123) Offline');
                         
                         // VoiceMonkey Reachability
                         if ((trigger.targets?.includes('voiceMonkey') || trigger.type === 'voiceMonkey') && !systemHealth.voiceMonkey?.healthy) {
                             issues.push('VoiceMonkey Service Offline');
                         }

                         // VoiceMonkey Compatibility (for custom files)
                         if (trigger.type === 'file' && trigger.targets?.includes('voiceMonkey')) {
                             const file = files?.find(f => f.path === trigger.path);
                             if (file && file.vmCompatible === false) {
                                 issues.push(`Alexa Incompatible: ${file.vmIssues?.join(', ') || 'Unsupported properties'}`);
                             }
                         }

                         if (issues.length === 0) return null;

                         return (
                            <div className="flex items-center gap-1.5 ml-2 group/warning relative">
                                <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/warning:block z-50">
                                    <div className="w-2 h-2 bg-app-card border-t border-l border-app-border rotate-45 mx-auto -mb-1 absolute -top-1 left-1/2 -translate-x-1/2"></div>
                                    <div className="bg-app-card border border-app-border p-2 rounded shadow-2xl text-[10px] whitespace-nowrap text-app-text relative z-10">
                                        <p className="font-bold text-amber-500 mb-1 flex items-center gap-1 uppercase tracking-tighter">
                                            <AlertTriangle className="w-3 h-3" /> Service Warning
                                        </p>
                                        <ul className="space-y-0.5 list-disc list-inside">
                                            {issues.map((issue, idx) => (
                                                <li key={idx}>{issue}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                         );
                     })()}
                  </div>
                  <div className="flex items-center gap-4">
                     {/* Offset Minutes Input - Only for pre* events */}
                     {eventType?.startsWith('pre') && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 transition-all">
                            <label className="text-[10px] text-app-dim font-bold uppercase tracking-wider">
                                Minutes Before
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={trigger.offsetMinutes || 15}
                                onChange={(e) => {
                                    const raw = parseInt(e.target.value);
                                    const clamped = isNaN(raw) ? 15 : Math.min(60, Math.max(0, raw));
                                    update('offsetMinutes', clamped);
                                }}
                                aria-label="Minutes Before"
                                disabled={!trigger.enabled || isDisabledByMaster}
                                className="w-14 bg-app-bg border border-app-border rounded-md px-2 py-1 text-xs text-app-text 
                                        focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 disabled:opacity-30 transition-all font-mono"
                            />
                        </div>
                     )}

                     <button
                        role="switch"
                        aria-checked={trigger.enabled}
                        onClick={() => update('enabled', !trigger.enabled)}
                        className={cn(
                            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-app-card",
                            trigger.enabled ? "bg-emerald-600" : "bg-app-card-hover"
                        )}
                     >
                        <span
                            className={cn(
                                "inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out",
                                trigger.enabled ? "translate-x-5" : "translate-x-1"
                            )}
                        />
                     </button>
                  </div>
             </div>
             
             {/* Collapsible Content */}
             {trigger.enabled && !isDisabledByMaster && (
                 <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                     {/* Type Selector */}
                     <div>
                         <label className="text-xs font-bold text-app-dim uppercase tracking-wider block mb-2">Audio Source</label>
                         <div className="flex gap-2">
                             {['tts', 'file', 'url'].map(type => {
                                 
                                 // Check availability
                                 const isOffline = (type === 'tts' && !systemHealth.tts?.healthy);
                                 const reason = isOffline ? "TTS Service Offline" : "";

                                 return (
                                     <button
                                        key={type}
                                        onClick={() => update('type', type)}
                                        title={reason}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded border transition-colors relative group",
                                            trigger.type === type 
                                                ? (isOffline ? "bg-amber-600 border-amber-500 text-app-text" : "bg-emerald-600 border-emerald-500 text-app-text")
                                                : "bg-app-bg border-app-border text-app-dim hover:bg-app-card-hover",
                                            isOffline && trigger.type !== type && "border-amber-900/30 text-amber-600/50"
                                        )}
                                     >
                                        {type.toUpperCase()}
                                        {isOffline && <AlertTriangle className={cn("w-3 h-3 absolute -top-1 -right-1 bg-app-card rounded-full", trigger.type === type ? "text-app-text" : "text-amber-500")} />}
                                     </button>
                                 );
                             })}
                         </div>
                     </div>
                     
                     {/* Dynamic Input based on Type */}
                     <div className="bg-app-bg/20 p-3 rounded-lg border border-app-border">
                        {trigger.type === 'file' && (
                            <SearchableSelect 
                                value={trigger.path || ""} 
                                placeholder="Select Audio File..."
                                onChange={val => update('path', val)}
                                options={files.map(f => ({
                                    value: f.path,
                                    label: f.name,
                                    sublabel: f.type
                                }))}
                                className={cn(error ? "border-red-500" : "")}
                            />
                        )}
                        
                        {trigger.type === 'tts' && (
                            <div className="space-y-1">
                                <span className="text-xs text-app-dim">
                                    Variables: <code className="text-app-dim">{"{prayerEnglish}"}</code>, <code className="text-app-dim">{"{prayerArabic}"}</code>, <code className="text-app-dim">{"{minutes}"}</code>
                                </span>
                                <input 
                                    placeholder="TTS Template String (e.g. It is time for {prayerEnglish})"
                                    className={cn(
                                        "w-full bg-app-card border border-app-border rounded-md p-2 text-sm text-app-text focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20",
                                        error ? "border-red-500 focus:border-red-500" : ""
                                    )}
                                    value={trigger.template || ''}
                                    onChange={e => update('template', e.target.value)}
                                />
                            </div>
                        )}

                        {trigger.type === 'tts' && (
                            <div className="space-y-1 mt-3">
                                <label className="text-[10px] font-bold text-app-dim uppercase tracking-wider">Voice Selection</label>
                                <SearchableSelect 
                                    value={trigger.voice || ""}
                                    placeholder={`Default (${config.automation?.defaultVoice || 'ar-DZ-IsmaelNeural'})`}
                                    onChange={val => update('voice', val)}
                                    options={[
                                        { value: "", label: `System Default (${config.automation?.defaultVoice || 'Fallback'})`, sublabel: "Inherit global setting" },
                                        ...(voices || []).map(v => ({
                                            value: v.ShortName,
                                            label: v.FriendlyName || v.Name.split('(')[1].split(',')[1].replace(')', '').trim(),
                                            sublabel: v.ShortName
                                        }))
                                    ]}
                                />
                            </div>
                        )}

                        {trigger.type === 'url' && (
                             <input 
                                placeholder="https://..."
                                className={cn(
                                    "w-full bg-app-card border border-app-border rounded-md p-2 text-sm text-app-text focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20",
                                    error ? "border-red-500 focus:border-red-500" : ""
                                )}
                                value={trigger.url || ''}
                                onChange={e => update('url', e.target.value)}
                             />
                        )}
                     </div>
                     
                     {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                     
                     {/* Targets */}
                     <div>
                         <label className="text-xs font-bold text-app-dim uppercase tracking-wider block mb-2">Targets</label>
                         <div className="flex flex-wrap gap-3">
                              {/* Local Audio Info */}
                              {(() => {
                                  const isOffline = !systemHealth.local?.healthy;
                                  const isSelected = trigger.targets?.includes('local');
                                  
                                  return (
                                      <label className={cn(
                                          "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors text-sm relative",
                                          isSelected
                                              ? (isOffline ? "bg-amber-900/20 border-amber-800 text-amber-400" : "bg-emerald-900/20 border-emerald-800 text-emerald-400")
                                              : "bg-app-bg border-app-border text-app-dim hover:bg-app-card-hover",
                                          isOffline && !isSelected && "border-amber-900/30 text-amber-600/50"
                                      )} title={isOffline ? "Local Audio Service Offline" : ""}>
                                          <input 
                                             type="checkbox" 
                                             className="hidden" 
                                             checked={isSelected || false} 
                                             onChange={() => toggleTarget('local')} 
                                           />
                                          {isOffline && <AlertTriangle className="w-3 h-3 text-amber-500 absolute -top-1 -right-1 bg-app-card rounded-full" />}
                                          <Server className="w-4 h-4" /> Server
                                      </label>
                                  );
                              })()}

                              {/* VoiceMonkey Info */}
                              {(() => {
                                  const isOffline = !systemHealth.voiceMonkey?.healthy;
                                  const isSelected = trigger.targets?.includes('voiceMonkey');

                                  return (
                                      <label className={cn(
                                          "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors text-sm relative",
                                          isSelected 
                                              ? (isOffline ? "bg-amber-900/20 border-amber-800 text-amber-400" : "bg-emerald-900/20 border-emerald-800 text-emerald-400") 
                                              : "bg-app-bg border-app-border text-app-dim hover:bg-app-card-hover",
                                          isOffline && !isSelected && "border-amber-900/30 text-amber-600/50"
                                      )} title={isOffline ? "VoiceMonkey Service Offline" : ""}>
                                          <input 
                                             type="checkbox" 
                                             className="hidden" 
                                             checked={isSelected || false} 
                                             onChange={() => toggleTarget('voiceMonkey')} 
                                           />
                                          {isOffline && <AlertTriangle className="w-3 h-3 text-amber-500 absolute -top-1 -right-1 bg-app-card rounded-full" />}
                                          <Zap className="w-4 h-4" /> VoiceMonkey
                                      </label>
                                  );
                              })()}
                          </div>
                     </div>
                     
                     {/* Extra Content (e.g., Iqamah Rules) */}
                     {extraContent && (
                         <div className="pt-4 border-t border-app-border/50 mt-2">
                             {extraContent}
                         </div>
                     )}
                 </div>
             )}
        </div>
    );
}
