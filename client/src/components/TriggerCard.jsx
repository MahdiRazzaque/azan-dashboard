import { Server, Monitor, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function TriggerCard({ label, trigger, onChange, files, error }) {
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
            "rounded-lg border p-4 transition-colors",
            trigger.enabled ? "bg-zinc-900/50 border-zinc-700" : "bg-zinc-900/20 border-zinc-800 opacity-75"
        )}>
             <div className="flex items-center justify-between mb-4">
                 <h4 className="font-semibold text-zinc-200">{label}</h4>
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
             
             {trigger.enabled && (
                 <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                     {/* Type Selector */}
                     <div>
                         <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">Audio Source</label>
                         <div className="flex gap-2">
                             {['tts', 'file', 'url'].map(type => (
                                 <button
                                    key={type}
                                    onClick={() => update('type', type)}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-medium rounded border transition-colors",
                                        trigger.type === type 
                                            ? "bg-emerald-600 border-emerald-500 text-white" 
                                            : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
                                    )}
                                 >
                                    {type.toUpperCase()}
                                 </button>
                             ))}
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
                             <label className={cn(
                                 "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors text-sm",
                                 trigger.targets?.includes('local') ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"
                             )}>
                                 <input type="checkbox" className="hidden" checked={trigger.targets?.includes('local') || false} onChange={() => toggleTarget('local')} />
                                 <Server className="w-4 h-4" /> Server
                             </label>
                             <label className={cn(
                                 "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors text-sm",
                                 trigger.targets?.includes('browser') ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"
                             )}>
                                 <input type="checkbox" className="hidden" checked={trigger.targets?.includes('browser') || false} onChange={() => toggleTarget('browser')} />
                                 <Monitor className="w-4 h-4" /> Browser
                             </label>
                             <label className={cn(
                                 "flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors text-sm",
                                 trigger.targets?.includes('voiceMonkey') ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"
                             )}>
                                 <input type="checkbox" className="hidden" checked={trigger.targets?.includes('voiceMonkey') || false} onChange={() => toggleTarget('voiceMonkey')} />
                                 <Zap className="w-4 h-4" /> VoiceMonkey
                             </label>
                         </div>
                     </div>
                 </div>
             )}
        </div>
    );
}
