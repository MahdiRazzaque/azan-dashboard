import { Server, Monitor, Zap, AlertTriangle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSettings } from '../contexts/SettingsContext';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function TriggerCard({ label, trigger, onChange, files, error, isDirty, eventType, extraContent }) {
    const { systemHealth, config } = useSettings();
    
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
            "rounded-lg border transition-all duration-300 relative overflow-hidden",
            isDisabledByMaster 
                ? "bg-zinc-900/10 border-zinc-800 opacity-60 grayscale" 
                : trigger.enabled 
                    ? "bg-zinc-900/50 border-zinc-700 p-4" 
                    : "bg-zinc-900/20 border-zinc-800 opacity-75 p-4"
        )}>
             {isDisabledByMaster && (
                 <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[1px]">
                     <div className="bg-zinc-900/90 px-4 py-2 rounded border border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider shadow-xl flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                         Disabled by {masterSwitchState.reason.includes('Global') ? 'Global Switch' : 'Sub-System'}
                     </div>
                 </div>
             )}
             
             <div className={cn("flex items-center justify-between", (!trigger.enabled || isDisabledByMaster) ? "p-3" : "mb-4")}>
                 <div className="flex items-center gap-2">
                    <h4 className={cn("font-semibold transition-colors", isDisabledByMaster ? "text-zinc-500" : "text-zinc-200")}>{label}</h4>
                     
                     {/* Unsaved Changes Indicator */}
                     {isDirty && (
                         <div className="relative group/unsaved ml-2">
                             <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)] block cursor-help"></span>
                             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/unsaved:block z-50">
                                 <div className="bg-zinc-900 border border-zinc-700 px-2 py-1 rounded shadow-xl text-[10px] whitespace-nowrap text-zinc-300 font-medium">
                                     Unsaved Changes
                                 </div>
                                 <div className="w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45 mx-auto -mt-1"></div>
                             </div>
                         </div>
                     )}
                     
                     {/* Warning icon if enabled but underlying service is dead */}
                     {(() => {
                         if (!trigger.enabled || isDisabledByMaster) return null;
                         
                         const issues = [];
                         if (trigger.type === 'tts' && !systemHealth.tts) issues.push('TTS Service Offline');
                         if (trigger.targets?.includes('local') && !systemHealth.local) issues.push('Local Audio (mpg123) Offline');
                         if ((trigger.targets?.includes('voiceMonkey') || trigger.type === 'voiceMonkey') && !systemHealth.voiceMonkey) issues.push('VoiceMonkey Service Offline');

                         if (issues.length === 0) return null;

                         return (
                            <div className="flex items-center gap-1.5 ml-2 group/warning relative">
                                <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse" />
                                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover/warning:block z-50">
                                    <div className="w-2 h-2 bg-zinc-900 border-t border-l border-zinc-700 rotate-45 mx-auto -mb-1 absolute -top-1 left-1/2 -translate-x-1/2"></div>
                                    <div className="bg-zinc-900 border border-zinc-700 p-2 rounded shadow-2xl text-[10px] whitespace-nowrap text-zinc-300 relative z-10">
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
                 <button
                    role="switch"
                    aria-checked={trigger.enabled}
                    onClick={() => update('enabled', !trigger.enabled)}
                    className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
                        trigger.enabled ? "bg-emerald-600" : "bg-zinc-700"
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
             
             {/* Collapsible Content */}
             {trigger.enabled && !isDisabledByMaster && (
                 <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                     {/* Type Selector */}
                     <div>
                         <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">Audio Source</label>
                         <div className="flex gap-2">
                             {['tts', 'file', 'url'].map(type => {
                                 
                                 // Check availability
                                 const isOffline = (type === 'tts' && !systemHealth.tts);
                                 const reason = isOffline ? "TTS Service Offline" : "";

                                 return (
                                     <button
                                        key={type}
                                        onClick={() => update('type', type)}
                                        title={reason}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded border transition-colors relative group",
                                            trigger.type === type 
                                                ? (isOffline ? "bg-amber-600 border-amber-500 text-white" : "bg-emerald-600 border-emerald-500 text-white")
                                                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700",
                                            isOffline && trigger.type !== type && "border-amber-900/30 text-amber-600/50"
                                        )}
                                     >
                                        {type.toUpperCase()}
                                        {isOffline && <AlertTriangle className={cn("w-3 h-3 absolute -top-1 -right-1 bg-zinc-900 rounded-full", trigger.type === type ? "text-white" : "text-amber-500")} />}
                                     </button>
                                 );
                             })}
                         </div>
                     </div>
                     
                     {/* Dynamic Input based on Type */}
                     <div className="bg-zinc-950/50 p-3 rounded border border-zinc-800/50">
                        {trigger.type === 'file' && (
                            <select 
                                value={trigger.path || ''} 
                                onChange={e => update('path', e.target.value)}
                                className={cn(
                                    "w-full bg-zinc-900 border rounded p-2 text-sm text-zinc-200 focus:outline-none",
                                    error ? "border-red-500 focus:border-red-500" : "border-zinc-700 focus:border-emerald-500"
                                )}
                            >
                                <option value="">-- Select File --</option>
                                {files.map(f => (
                                    <option key={f.path} value={f.path}>{f.name} ({f.type})</option>
                                ))}
                            </select>
                        )}
                        
                        {trigger.type === 'tts' && (
                            <div className="space-y-1">
                                <span className="text-xs text-zinc-500">
                                    Variables: <code className="text-zinc-400">{"{prayer}"}</code>, <code className="text-zinc-400">{"{prayerArabic}"}</code>, <code className="text-zinc-400">{"{minutes}"}</code>
                                </span>
                                <input 
                                    placeholder="TTS Template String (e.g. It is time for {prayer})"
                                    className={cn(
                                        "w-full bg-zinc-900 border rounded p-2 text-sm text-zinc-200 focus:outline-none",
                                        error ? "border-red-500 focus:border-red-500" : "border-zinc-700 focus:border-emerald-500"
                                    )}
                                    value={trigger.template || ''}
                                    onChange={e => update('template', e.target.value)}
                                />
                            </div>
                        )}

                        {trigger.type === 'url' && (
                             <input 
                                placeholder="https://..."
                                className={cn(
                                    "w-full bg-zinc-900 border rounded p-2 text-sm text-zinc-200 focus:outline-none",
                                    error ? "border-red-500 focus:border-red-500" : "border-zinc-700 focus:border-emerald-500"
                                )}
                                value={trigger.url || ''}
                                onChange={e => update('url', e.target.value)}
                             />
                        )}
                     </div>
                     
                     {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                     
                     {/* Targets */}
                     <div>
                         <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">Targets</label>
                         <div className="flex flex-wrap gap-3">
                              {/* Local Audio Info */}
                              {(() => {
                                  const isOffline = !systemHealth.local;
                                  const isSelected = trigger.targets?.includes('local');
                                  
                                  return (
                                      <label className={cn(
                                          "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors text-sm relative",
                                          isSelected
                                              ? (isOffline ? "bg-amber-900/20 border-amber-800 text-amber-400" : "bg-emerald-900/20 border-emerald-800 text-emerald-400")
                                              : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700",
                                          isOffline && !isSelected && "border-amber-900/30 text-amber-600/50"
                                      )} title={isOffline ? "Local Audio Service Offline" : ""}>
                                          <input 
                                             type="checkbox" 
                                             className="hidden" 
                                             checked={isSelected || false} 
                                             onChange={() => toggleTarget('local')} 
                                           />
                                          {isOffline && <AlertTriangle className="w-3 h-3 text-amber-500 absolute -top-1 -right-1 bg-zinc-900 rounded-full" />}
                                          <Server className="w-4 h-4" /> Server
                                      </label>
                                  );
                              })()}

                              {/* Browser Audio (Always available) */}
                              <label className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors text-sm",
                                  trigger.targets?.includes('browser') ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"
                              )}>
                                  <input type="checkbox" className="hidden" checked={trigger.targets?.includes('browser') || false} onChange={() => toggleTarget('browser')} />
                                  <Monitor className="w-4 h-4" /> Browser
                              </label>

                              {/* VoiceMonkey Info */}
                              {(() => {
                                  const isOffline = !systemHealth.voiceMonkey;
                                  const isSelected = trigger.targets?.includes('voiceMonkey');

                                  return (
                                      <label className={cn(
                                          "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors text-sm relative",
                                          isSelected 
                                              ? (isOffline ? "bg-amber-900/20 border-amber-800 text-amber-400" : "bg-emerald-900/20 border-emerald-800 text-emerald-400") 
                                              : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700",
                                          isOffline && !isSelected && "border-amber-900/30 text-amber-600/50"
                                      )} title={isOffline ? "VoiceMonkey Service Offline" : ""}>
                                          <input 
                                             type="checkbox" 
                                             className="hidden" 
                                             checked={isSelected || false} 
                                             onChange={() => toggleTarget('voiceMonkey')} 
                                           />
                                          {isOffline && <AlertTriangle className="w-3 h-3 text-amber-500 absolute -top-1 -right-1 bg-zinc-900 rounded-full" />}
                                          <Zap className="w-4 h-4" /> VoiceMonkey
                                      </label>
                                  );
                              })()}
                          </div>
                     </div>
                     
                     {/* Extra Content (e.g., Iqamah Rules) */}
                     {extraContent && (
                         <div className="pt-4 border-t border-zinc-800/50 mt-2">
                             {extraContent}
                         </div>
                     )}
                 </div>
             )}
        </div>
    );
}
