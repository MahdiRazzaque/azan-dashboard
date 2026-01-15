import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw, Power, RotateCcw, Activity, Database, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function DeveloperSettingsView() {
    const { logs } = useOutletContext();
    const { systemHealth, refreshHealth, config, draftConfig, resetDraft } = useSettings();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(null); // 'tts' | 'scheduler' | null
    const [message, setMessage] = useState(null);
    const [automationStatus, setAutomationStatus] = useState(null);
    const [ttsStatus, setTtsStatus] = useState(null);



    const [refreshing, setRefreshing] = useState(null); // 'voiceMonkey' | 'tts' | 'local'
    const [feedback, setFeedback] = useState({}); // { voiceMonkey: "Message", ... }
    const [apiOnline, setApiOnline] = useState(true); // Default to true since we loaded the page


    const handleManualRefresh = async (target) => {
        setRefreshing(target);
        // Clear old feedback for this target
        setFeedback(prev => ({ ...prev, [target]: null }));
        
        let feedbackMsg = null;
        let isHealthy = false;

        if (target === 'api') {
            try {
                // Direct ping to check connectivity
                const res = await fetch('/api/health'); // Use endpoint that just returns state
                if (res.ok) {
                     isHealthy = true;
                     setApiOnline(true);
                     feedbackMsg = "Online";
                } else {
                     throw new Error('Status ' + res.status);
                }
            } catch (e) {
                isHealthy = false;
                setApiOnline(false);
                feedbackMsg = "Unreachable";
            }
        } else {
            const res = await refreshHealth(target);
            if (res && res[target]) {
                 const item = res[target];
                 isHealthy = item.healthy;
                 feedbackMsg = item.message || (item.healthy ? "Online" : "Offline");
            }
        }

        if (feedbackMsg) {
             setFeedback(prev => ({ ...prev, [target]: feedbackMsg }));
             
             setTimeout(() => {
                 setFeedback(prev => ({ ...prev, [target]: null }));
             }, 3000);
        }
        setRefreshing(null);
    };

    const fetchJobs = () => {
        fetch('/api/system/jobs')
            .then(res => res.json())
            .then(data => {
                // Ensure data is object with maintenance/automation or fallback to empty
                if (Array.isArray(data)) {
                     // Legacy or fallback support
                     setJobs(data);
                } else if (data && (data.maintenance || data.automation)) {
                     // We only want to show maintenance jobs in the "Active Jobs" card per FR-05
                     setJobs(data.maintenance || []);
                } else {
                     setJobs([]);
                }
            })
            .catch(err => console.error("Failed to fetch jobs", err));
    };

    const fetchDiagnostics = () => {
        fetch('/api/system/status/automation')
            .then(res => res.json())
            .then(setAutomationStatus)
            .catch(err => console.error("Failed to fetch automation stats", err));

        fetch('/api/system/status/tts')
            .then(res => res.json())
            .then(setTtsStatus)
            .catch(err => console.error("Failed to fetch tts stats", err));
    };

    useEffect(() => {
        fetchJobs();
        fetchDiagnostics();
        const interval = setInterval(() => {
            fetchJobs();
            fetchDiagnostics();
        }, 10000); 
        return () => clearInterval(interval);
    }, []);

    const callSystemAction = async (action, endpoint) => {
        setLoading(action);
        setMessage(null);
        try {
            const res = await fetch(endpoint, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.error || 'Failed');
            setMessage({ type: 'success', text: data.message });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(null);
            // Refresh all data
            fetchJobs();
            fetchDiagnostics();
        }
    };

    const AutomationStatusCell = ({ status, time, details }) => {
        let color = 'bg-zinc-800 text-zinc-500 border-zinc-700'; // Disabled/Unknown
        let label = status;
        let title = status;

        if (status === 'PASSED') {
            color = 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50';
            label = time ? new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Done';
        } else if (status === 'UPCOMING') {
            color = 'bg-blue-900/30 text-blue-400 border-blue-800/50';
            label = time ? new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Pending';
        }

        if (details) {
            title = `Type: ${details.type}\nSource: ${details.source}\nTargets: ${details.targets}`;
        }

        return (
            <div 
                className={`px-2 py-1 rounded text-xs font-mono border text-center whitespace-nowrap overflow-hidden text-ellipsis ${color}`}
                title={title}
            >
                {label}
            </div>
        );
    };

    const TTSStatusCell = ({ status, detail }) => {
        let color = 'bg-zinc-800 text-zinc-500 border-zinc-700'; // Disabled/Unknown
        let label = status;
        let title = detail || status;

        if (status === 'GENERATED') {
            color = 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50';
            label = 'Ready';
            if (detail) title = `Generated: ${new Date(detail).toLocaleString()}`;
        } else if (status === 'MISSING' || status === 'ERROR') {
             color = 'bg-red-900/30 text-red-400 border-red-800/50';
        } else if (status === 'CUSTOM_FILE' || status === 'URL') {
             color = 'bg-indigo-900/30 text-indigo-400 border-indigo-800/50';
             label = status === 'URL' ? 'URL' : 'File';
        }

        return (
            <div 
                className={`px-2 py-1 rounded text-xs font-mono border text-center whitespace-nowrap overflow-hidden text-ellipsis ${color}`}
                title={title}
            >
                {label}
            </div>
        );
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Developer Tools</h2>
                    <p className="text-zinc-400">System diagnostics and maintenance operations.</p>
                </div>

            </div>

            {message && (
                <div className={`p-4 rounded-lg border animate-in fade-in slide-in-from-top-2 ${message.type === 'success' ? 'bg-emerald-900/20 border-emerald-800 text-emerald-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* System Health */}
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" /> System Health
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {/* Left Column: API & VoiceMonkey */}

    
                         <div className="space-y-4">
                             {/* API Health (Synthesized) */}
                             <div className="flex items-center justify-between p-3 bg-zinc-900 rounded border border-zinc-800">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-medium text-zinc-200">API Server</span>
                                         {apiOnline ? (
                                             <CheckCircle className="w-4 h-4 text-emerald-500" />
                                         ) : (
                                             <XCircle className="w-4 h-4 text-red-500" />
                                         )}
                                     </div>
                                     <div className="text-xs text-zinc-500 transition-all duration-300">
                                         Node.js Backend (Port {systemHealth?.ports?.api || '3000'})
                                     </div>
                                 </div>
                                 <div className="relative">
                                     {feedback?.api && (
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded border border-zinc-700 whitespace-nowrap z-10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                             {feedback.api}
                                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-b border-r border-zinc-700 rotate-45"></div>
                                         </div>
                                     )}
                                     <button 
                                         onClick={() => handleManualRefresh('api')}
                                         disabled={refreshing === 'api'}
                                         className={cn(
                                             "p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors",
                                             refreshing === 'api' && "text-emerald-500"
                                         )}
                                         title="Refresh Status"
                                     >
                                         <RefreshCw className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>

                             {/* VoiceMonkey */}
                             <div className="flex items-center justify-between p-3 bg-zinc-900 rounded border border-zinc-800">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-medium text-zinc-200">VoiceMonkey</span>
                                         {systemHealth.voiceMonkey?.healthy ? (
                                             <CheckCircle className="w-4 h-4 text-emerald-500" />
                                         ) : (
                                             <XCircle className="w-4 h-4 text-red-500" />
                                         )}
                                     </div>
                                     <div className="text-xs text-zinc-500 transition-all duration-300">
                                          Cloud API Connectivity
                                     </div>
                                 </div>
                                 <div className="relative">
                                     {feedback?.voiceMonkey && (
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded border border-zinc-700 whitespace-nowrap z-10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                             {feedback.voiceMonkey}
                                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-b border-r border-zinc-700 rotate-45"></div>
                                         </div>
                                     )}
                                     <button 
                                         onClick={() => handleManualRefresh('voiceMonkey')}
                                         disabled={refreshing === 'voiceMonkey'}
                                         className={cn(
                                             "p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors",
                                             refreshing === 'voiceMonkey' && "text-emerald-500"
                                         )}
                                         title="Refresh Status"
                                     >
                                         <RefreshCw className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>
                        </div>

                         {/* Right Column: TTS & Local */}
                        <div className="space-y-4">
                             {/* TTS Service */}
                             <div className="flex items-center justify-between p-3 bg-zinc-900 rounded border border-zinc-800">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-medium text-zinc-200">TTS Service</span>
                                         {systemHealth.tts?.healthy ? (
                                             <CheckCircle className="w-4 h-4 text-emerald-500" />
                                         ) : (
                                             <XCircle className="w-4 h-4 text-red-500" />
                                         )}
                                     </div>
                                     <div className="text-xs text-zinc-500 transition-all duration-300">
                                         Python Server (Port {systemHealth?.ports?.tts || '8000'})
                                     </div>
                                 </div>
                                 <div className="relative">
                                     {feedback?.tts && (
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded border border-zinc-700 whitespace-nowrap z-10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                             {feedback.tts}
                                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-b border-r border-zinc-700 rotate-45"></div>
                                         </div>
                                     )}
                                     <button 
                                         onClick={() => handleManualRefresh('tts')}
                                         disabled={refreshing === 'tts'}
                                         className={cn(
                                             "p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors",
                                             refreshing === 'tts' && "text-emerald-500"
                                         )}
                                         title="Refresh Status"
                                     >
                                         <RefreshCw className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>

                             {/* Local Audio */}
                             <div className="flex items-center justify-between p-3 bg-zinc-900 rounded border border-zinc-800">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-medium text-zinc-200">Local Audio</span>
                                         {systemHealth.local?.healthy ? (
                                             <CheckCircle className="w-4 h-4 text-emerald-500" />
                                         ) : (
                                             <XCircle className="w-4 h-4 text-red-500" />
                                         )}
                                     </div>
                                     <div className="text-xs text-zinc-500 transition-all duration-300">
                                         {systemHealth.local?.healthy ? "mpg123 CLI Tool" : (systemHealth.local?.message || "Not Found")}
                                     </div>
                                 </div>
                                 <div className="relative">
                                     {feedback?.local && (
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded border border-zinc-700 whitespace-nowrap z-10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                             {feedback.local}
                                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-800 border-b border-r border-zinc-700 rotate-45"></div>
                                         </div>
                                     )}
                                     <button 
                                         onClick={() => handleManualRefresh('local')}
                                         disabled={refreshing === 'local'}
                                         className={cn(
                                             "p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors",
                                             refreshing === 'local' && "text-emerald-500"
                                         )}
                                         title="Refresh Status"
                                     >
                                         <RefreshCw className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>
                        </div>
                    </div>
                </div>
                
                {/* Actions */}
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Power className="w-5 h-5 text-emerald-500" /> System Actions
                    </h3>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => callSystemAction('tts', '/api/system/regenerate-tts')}
                            disabled={loading !== null || !systemHealth.tts}
                            className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all group disabled:opacity-50"
                        >
                             <div className="flex items-center gap-3">
                                 <RefreshCw className={`w-5 h-5 text-blue-400 ${loading === 'tts' ? 'animate-spin' : ''}`} />
                                 <div className="text-left">
                                     <div className="font-medium text-zinc-200">Regenerate TTS Assets</div>
                                     <div className="text-xs text-zinc-500 group-hover:text-zinc-400">
                                         {systemHealth.tts ? "Rebuilds audio files for today's cache" : <span className="text-red-400">TTS Service Offline</span>}
                                     </div>
                                 </div>
                             </div>
                        </button>

                        <button
                            onClick={() => callSystemAction('scheduler', '/api/system/restart-scheduler')}
                            disabled={loading !== null}
                            className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all group disabled:opacity-50"
                        >
                             <div className="flex items-center gap-3">
                                 <RotateCcw className={`w-5 h-5 text-amber-400 ${loading === 'scheduler' ? 'animate-spin' : ''}`} />
                                 <div className="text-left">
                                     <div className="font-medium text-zinc-200">Restart Scheduler</div>
                                     <div className="text-xs text-zinc-500 group-hover:text-zinc-400">Re-initializes jobs (no config reload)</div>
                                 </div>
                             </div>
                        </button>

                        <button
                            onClick={() => callSystemAction('config', '/api/settings/refresh-cache')}
                            disabled={loading !== null}
                            className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 transition-all group disabled:opacity-50"
                        >
                             <div className="flex items-center gap-3">
                                 <Database className={`w-5 h-5 text-purple-400 ${loading === 'config' ? 'animate-pulse' : ''}`} />
                                 <div className="text-left">
                                     <div className="font-medium text-zinc-200">Reload Config & Cache</div>
                                     <div className="text-xs text-zinc-500 group-hover:text-zinc-400">Reloads disk config and refreshes prayer cache</div>
                                 </div>
                             </div>
                        </button>
                    </div>
                </div>

                {/* System Maintenance Jobs */}
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 overflow-hidden">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" /> Maintenance Jobs
                    </h3>
                    <div className="overflow-x-auto max-h-[200px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/50 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Job Name</th>
                                    <th className="px-4 py-2 font-medium text-right">Next Run</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {jobs.length === 0 ? (
                                    <tr><td colSpan="2" className="px-4 py-8 text-center text-zinc-500 text-xs italic">No active maintenance jobs</td></tr>
                                ) : (
                                    jobs.map((job, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3 font-medium text-zinc-200">{job.name}</td>
                                            <td className="px-4 py-3 text-zinc-400 text-right font-mono text-xs">
                                                {job.nextInvocation ? new Date(job.nextInvocation).toLocaleTimeString() : 'Pending'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Automation Status */}
            {(() => {
                 const isGlobalDisabled = config?.automation?.global?.enabled === false;
                 
                 // Column Disable States
                 const isPreAdhanDisabled = config?.automation?.global?.preAdhanEnabled === false;
                 const isAdhanDisabled = config?.automation?.global?.adhanEnabled === false;
                 const isPreIqamahDisabled = config?.automation?.global?.preIqamahEnabled === false;
                 const isIqamahDisabled = config?.automation?.global?.iqamahEnabled === false;

                 return (
                    <div className={cn(
                        "bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 overflow-hidden transition-all duration-300 relative",
                        isGlobalDisabled && "opacity-60 grayscale bg-zinc-900/10 pointer-events-none"
                    )}>
                        {isGlobalDisabled && (
                             <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[1px]">
                                 <div className="bg-zinc-900/90 px-4 py-2 rounded border border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider shadow-xl flex items-center gap-2">
                                     <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                                     Automation Globally Disabled
                                 </div>
                             </div>
                        )}

                         <div className="flex items-center justify-between mb-4">
                             <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                 <span className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></span>
                                 Automation Status
                             </h3>
                             <div className="flex gap-4 text-xs font-medium">
                                 <div className="flex items-center gap-2 text-zinc-400">
                                     <span className="w-2 h-2 rounded-full bg-emerald-500/50"></span> Passed
                                 </div>
                                 <div className="flex items-center gap-2 text-zinc-400">
                                     <span className="w-2 h-2 rounded-full bg-blue-500/50"></span> Upcoming
                                 </div>
                             </div>
                         </div>
                         <div className="overflow-x-auto">
                             <table className="w-full text-sm text-center">
                                 <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/50">
                                     <tr>
                                         <th className="px-3 py-2 text-left">Prayer</th>
                                         <th className={cn("px-3 py-2", isPreAdhanDisabled && "opacity-30 relative")}>
                                            Pre-Adhan
                                         </th>
                                         <th className={cn("px-3 py-2", isAdhanDisabled && "opacity-30 relative")}>
                                            Adhan
                                         </th>
                                         <th className={cn("px-3 py-2", isPreIqamahDisabled && "opacity-30 relative")}>
                                            Pre-Iqamah
                                         </th>
                                         <th className={cn("px-3 py-2", isIqamahDisabled && "opacity-30 relative")}>
                                            Iqamah
                                         </th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-zinc-800/50">
                                     {!automationStatus ? (
                                         <tr><td colSpan="5" className="p-4 text-center text-zinc-500">Loading...</td></tr>
                                     ) : Object.entries(automationStatus).map(([prayer, events]) => (
                                         <tr key={prayer}>
                                             <td className="px-3 py-3 text-left font-medium text-zinc-300 capitalize">{prayer}</td>
                                             <td className={cn("px-2 py-2", isPreAdhanDisabled && "opacity-20 grayscale pointer-events-none")}>
                                                <AutomationStatusCell {...events.preAdhan} />
                                             </td>
                                             <td className={cn("px-2 py-2", isAdhanDisabled && "opacity-20 grayscale pointer-events-none")}>
                                                <AutomationStatusCell {...events.adhan} />
                                             </td>
                                             <td className={cn("px-2 py-2", isPreIqamahDisabled && "opacity-20 grayscale pointer-events-none")}>
                                                <AutomationStatusCell {...events.preIqamah} />
                                             </td>
                                             <td className={cn("px-2 py-2", isIqamahDisabled && "opacity-20 grayscale pointer-events-none")}>
                                                <AutomationStatusCell {...events.iqamah} />
                                             </td>
                                         </tr>
                                     ))}
                                 </tbody>
                             </table>
                         </div>
                    </div>
                 );
            })()}

            {/* TTS Status */}
            <div className={cn(
                "bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 overflow-hidden transition-opacity",
                !systemHealth.tts && "opacity-50 grayscale select-none pointer-events-none"
            )}>
                 <div className="flex items-center justify-between mb-4">
                     <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                         <span className={cn("w-2 h-2 rounded-full shadow-lg", !systemHealth.tts?.healthy ? "bg-zinc-600" : "bg-purple-500 shadow-purple-500/50")}></span>
                         TTS Asset Status
                     </h3>
                     {!systemHealth.tts?.healthy && (
                         <div className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 font-mono">
                             SERVICE OFFLINE
                         </div>
                     )}
                 </div>
                 <div className="overflow-x-auto">
                     <table className="w-full text-sm text-center">
                         <thead className="text-xs text-zinc-500 uppercase bg-zinc-900/50">
                             <tr>
                                 <th className="px-3 py-2 text-left">Prayer</th>
                                 <th className="px-3 py-2">Pre-Adhan</th>
                                 <th className="px-3 py-2">Adhan</th>
                                 <th className="px-3 py-2">Pre-Iqamah</th>
                                 <th className="px-3 py-2">Iqamah</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-zinc-800/50">
                             {!ttsStatus ? (
                                 <tr><td colSpan="5" className="p-4 text-center text-zinc-500">Loading...</td></tr>
                             ) : Object.entries(ttsStatus).map(([prayer, events]) => (
                                 <tr key={prayer}>
                                     <td className="px-3 py-3 text-left font-medium text-zinc-300 capitalize">{prayer}</td>
                                     <td className="px-2 py-2"><TTSStatusCell {...events.preAdhan} /></td>
                                     <td className="px-2 py-2"><TTSStatusCell {...events.adhan} /></td>
                                     <td className="px-2 py-2"><TTSStatusCell {...events.preIqamah} /></td>
                                     <td className="px-2 py-2"><TTSStatusCell {...events.iqamah} /></td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
            </div>

            {/* Logs Console */}
            <div className="bg-black border border-zinc-800 rounded-xl overflow-hidden font-mono text-sm shadow-xl">
                <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                     <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">System Logs (Live)</span>
                     <div className="flex gap-2">
                         <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                         <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                         <span className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                     </div>
                </div>
                <div className="h-64 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    {logs && logs.length > 0 ? [...logs].reverse().map((log, i) => (
                        <div key={i} className="flex gap-3 text-zinc-300 hover:bg-white/5 px-2 py-0.5 rounded -mx-2">
                            <span className="text-zinc-600 shrink-0 select-none text-xs mt-0.5">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`text-xs font-bold mt-0.5 w-12 ${
                                log.level === 'ERROR' ? 'text-red-400' : 
                                log.level === 'WARN' ? 'text-amber-400' : 'text-emerald-400'
                            }`}>[{log.level}]</span>
                            <span className="break-all">{log.message}</span>
                        </div>
                    )) : (
                        <div className="text-zinc-600 italic text-xs p-2">No logs received yet...</div>
                    )}
                </div>
            </div>
        </div>
    );
}
