import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { RefreshCw, Power, RotateCcw, Activity, Database, CheckCircle, XCircle, AlertTriangle, Volume2, HardDrive, Save } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import ConfirmModal from '../../components/ConfirmModal';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import PrayerSourceStatusCard from '../../components/settings/PrayerSourceStatusCard';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function DeveloperSettingsView() {
    const { logs } = useOutletContext();
    const { systemHealth, refreshHealth, config, draftConfig, resetDraft, refresh } = useSettings();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(null); // 'tts' | 'scheduler' | null
    const [message, setMessage] = useState(null);
    const [automationStatus, setAutomationStatus] = useState(null);
    const [ttsStatus, setTtsStatus] = useState(null);



    const [refreshing, setRefreshing] = useState(null); // 'voiceMonkey' | 'tts' | 'local'
    const [feedback, setFeedback] = useState({}); // { voiceMonkey: "Message", ... }
    const [apiOnline, setApiOnline] = useState(true); // Default to true since we loaded the page

    // Confirmation Logic
    const [showConfirm, setShowConfirm] = useState(false);
    const [pendingTarget, setPendingTarget] = useState(null);

    const [failedVoiceMonkey, setFailedVoiceMonkey] = useState(false);

    const handleManualRefresh = async (target, mode = 'silent') => {
        // Reset failure state on new attempt
        if (target === 'voiceMonkey') {
             setFailedVoiceMonkey(false);
        }
        await executeRefresh(target, mode);
    };

    const executeRefresh = async (target, mode = 'silent') => {
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
            const res = await refreshHealth(target, mode);
            if (res && res[target]) {
                 const item = res[target];
                 isHealthy = item.healthy;
                 feedbackMsg = item.message || (item.healthy ? "Online" : "Offline");
            } else if (res && res.error) {
                 // Handle Rate Limit or other explicit errors
                 feedbackMsg = res.error;
                 isHealthy = false;
            }
        }

        if (target === 'voiceMonkey' && mode === 'loud' && isHealthy) {
             // API Success, now Verify Sound
             setPendingTarget(target);
             setShowConfirm(true);
        } else {
             if (feedbackMsg) {
                 setFeedback(prev => ({ ...prev, [target]: feedbackMsg }));
                 
                 setTimeout(() => {
                     setFeedback(prev => ({ ...prev, [target]: null }));
                 }, 3000);
            }
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
            if(!res.ok) throw new Error(data.message || data.error || 'Failed');
            setMessage({ 
                type: data.warnings && data.warnings.length > 0 ? 'warning' : 'success', 
                text: data.message,
                warnings: data.warnings
            });
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(null);
            if (action === 'config') {
                await refresh();
                await refreshHealth('primarySource', 'silent');
                await refreshHealth('backupSource', 'silent');
            }
            fetchJobs();
            fetchDiagnostics();
        }
    };

    const AutomationStatusCell = ({ status, time, details }) => {
        let color = 'bg-app-card text-app-dim border-app-border'; // Disabled/Unknown
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
        let color = 'bg-app-card text-app-dim border-app-border'; // Disabled/Unknown
        let label = status;
        let title = detail || status;

        if (status === 'GENERATED') {
            color = 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50';
            label = 'Ready';
            if (detail) title = `Generated: ${new Date(detail).toLocaleString()}`;
        } else if (status === 'MISMATCH') {
            color = 'bg-amber-900/30 text-amber-400 border-amber-800/50';
            label = 'Mismatch';
            title = 'Template changed - Regeneration Required';
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
                    <h2 className="text-2xl font-bold text-app-text mb-2">Developer Tools</h2>
                    <p className="text-app-dim">System diagnostics and maintenance operations.</p>
                </div>

            </div>

            {message && (
                <div className={`p-4 rounded-lg border animate-in fade-in slide-in-from-top-2 ${
                    message.type === 'success' ? 'bg-emerald-900/20 border-emerald-800 text-emerald-300' : 
                    message.type === 'warning' ? 'bg-amber-900/20 border-amber-800 text-amber-300' :
                    'bg-red-900/20 border-red-800 text-red-300'
                }`}>
                    <div className="flex items-start gap-3">
                        {message.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
                        <div className="flex-1">
                            <div className="font-medium">{message.text}</div>
                            {message.warnings && message.warnings.length > 0 && (
                                <ul className="mt-2 text-sm opacity-80 list-disc list-inside space-y-1">
                                    {message.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* System Health */}
                <div className="bg-app-card/40 border border-app-border rounded-xl p-6 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" /> System Health
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        {/* Left Column: API & VoiceMonkey */}

    
                         <div className="space-y-4">
                             {/* API Health (Synthesized) */}
                             <div className="flex items-center justify-between p-3 bg-app-card rounded border border-app-border">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-medium text-app-text">API Server</span>
                                         {apiOnline ? (
                                             <CheckCircle className="w-4 h-4 text-emerald-500" />
                                         ) : (
                                             <XCircle className="w-4 h-4 text-red-500" />
                                         )}
                                     </div>
                                     <div className="text-xs text-app-dim transition-all duration-300">
                                         Node.js Backend (Port {systemHealth?.ports?.api || '3000'})
                                     </div>
                                 </div>
                                 <div className="relative">
                                     {feedback?.api && (
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-app-card text-app-text text-xs rounded border border-app-border whitespace-nowrap z-10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                             {feedback.api}
                                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-app-card border-b border-r border-app-border rotate-45"></div>
                                         </div>
                                     )}
                                     <button 
                                         onClick={() => handleManualRefresh('api')}
                                         disabled={refreshing === 'api'}
                                         className={cn(
                                             "p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text transition-colors",
                                             refreshing === 'api' && "text-emerald-500"
                                         )}
                                         title="Refresh Status"
                                     >
                                         <RefreshCw className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>

                             {/* VoiceMonkey */}
                             <div className="flex items-center justify-between p-3 bg-app-card rounded border border-app-border">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-medium text-app-text">VoiceMonkey</span>
                                         {systemHealth.voiceMonkey?.healthy && !failedVoiceMonkey ? (
                                             <CheckCircle className="w-4 h-4 text-emerald-500" />
                                         ) : (
                                             <XCircle className="w-4 h-4 text-red-500" />
                                         )}
                                     </div>
                                     <div className="text-xs text-app-dim transition-all duration-300">
                                          Cloud API Connectivity
                                     </div>
                                 </div>
                                 <div className="relative flex items-center gap-1">
                                     {feedback?.voiceMonkey && (
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-app-card text-app-text text-xs rounded border border-app-border whitespace-nowrap z-10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                             {feedback.voiceMonkey}
                                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-app-card border-b border-r border-app-border rotate-45"></div>
                                         </div>
                                     )}
                                     <button 
                                         onClick={() => handleManualRefresh('voiceMonkey', 'loud')}
                                         disabled={refreshing === 'voiceMonkey'}
                                         className={cn(
                                             "p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text transition-colors",
                                             refreshing === 'voiceMonkey' && "text-amber-500"
                                         )}
                                         title="Test Speaker Output"
                                     >
                                         <Volume2 className="w-4 h-4" />
                                     </button>
                                     <div className="w-px h-4 bg-app-border mx-1"></div>
                                     <button 
                                         onClick={() => handleManualRefresh('voiceMonkey', 'silent')}
                                         disabled={refreshing === 'voiceMonkey'}
                                         className={cn(
                                             "p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text transition-colors",
                                             refreshing === 'voiceMonkey' && "text-emerald-500"
                                         )}
                                         title="Silent Connectivity Check"
                                     >
                                         <RefreshCw className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>
                        </div>

                         {/* Right Column: TTS & Local */}
                        <div className="space-y-4">
                             {/* TTS Service */}
                             <div className="flex items-center justify-between p-3 bg-app-card rounded border border-app-border">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-medium text-app-text">TTS Service</span>
                                         {systemHealth.tts?.healthy ? (
                                             <CheckCircle className="w-4 h-4 text-emerald-500" />
                                         ) : (
                                             <XCircle className="w-4 h-4 text-red-500" />
                                         )}
                                     </div>
                                     <div className="text-xs text-app-dim transition-all duration-300">
                                         Python Server (Port {systemHealth?.ports?.tts || '8000'})
                                     </div>
                                 </div>
                                 <div className="relative">
                                     {feedback?.tts && (
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-app-card text-app-text text-xs rounded border border-app-border whitespace-nowrap z-10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                             {feedback.tts}
                                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-app-card border-b border-r border-app-border rotate-45"></div>
                                         </div>
                                     )}
                                     <button 
                                         onClick={() => handleManualRefresh('tts')}
                                         disabled={refreshing === 'tts'}
                                         className={cn(
                                             "p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text transition-colors",
                                             refreshing === 'tts' && "text-emerald-500"
                                         )}
                                         title="Refresh Status"
                                     >
                                         <RefreshCw className="w-4 h-4" />
                                     </button>
                                 </div>
                             </div>

                             {/* Local Audio */}
                             <div className="flex items-center justify-between p-3 bg-app-card rounded border border-app-border">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="font-medium text-app-text">Local Audio</span>
                                         {systemHealth.local?.healthy ? (
                                             <CheckCircle className="w-4 h-4 text-emerald-500" />
                                         ) : (
                                             <XCircle className="w-4 h-4 text-red-500" />
                                         )}
                                     </div>
                                     <div className="text-xs text-app-dim transition-all duration-300">
                                         {systemHealth.local?.healthy ? "mpg123 CLI Tool" : (systemHealth.local?.message || "Not Found")}
                                     </div>
                                 </div>
                                 <div className="relative">
                                     {feedback?.local && (
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-app-card text-app-text text-xs rounded border border-app-border whitespace-nowrap z-10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
                                             {feedback.local}
                                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-app-card border-b border-r border-app-border rotate-45"></div>
                                         </div>
                                     )}
                                     <button 
                                         onClick={() => handleManualRefresh('local')}
                                         disabled={refreshing === 'local'}
                                         className={cn(
                                             "p-1.5 hover:bg-app-card-hover rounded text-app-dim hover:text-app-text transition-colors",
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
                <div className="bg-app-card/40 border border-app-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
                        <Power className="w-5 h-5 text-emerald-500" /> System Actions
                    </h3>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => callSystemAction('tts', '/api/system/regenerate-tts')}
                            disabled={loading !== null || !systemHealth.tts}
                            className="flex items-center justify-between p-4 bg-app-card rounded-lg border border-app-border hover:bg-app-card-hover hover:border-app-border/50 transition-all group disabled:opacity-50"
                        >
                             <div className="flex items-center gap-3">
                                 <RefreshCw className={`w-5 h-5 text-blue-400 ${loading === 'tts' ? 'animate-spin' : ''}`} />
                                 <div className="text-left">
                                     <div className="font-medium text-app-text">Regenerate TTS Assets</div>
                                     <div className="text-xs text-app-dim group-hover:text-app-text/70">
                                         {systemHealth.tts ? "Rebuilds audio files for today's cache" : <span className="text-red-400">TTS Service Offline</span>}
                                     </div>
                                 </div>
                             </div>
                        </button>

                        <button
                            onClick={() => callSystemAction('scheduler', '/api/system/restart-scheduler')}
                            disabled={loading !== null}
                            className="flex items-center justify-between p-4 bg-app-card rounded-lg border border-app-border hover:bg-app-card-hover hover:border-app-border/50 transition-all group disabled:opacity-50"
                        >
                             <div className="flex items-center gap-3">
                                 <RotateCcw className={`w-5 h-5 text-amber-400 ${loading === 'scheduler' ? 'animate-spin' : ''}`} />
                                 <div className="text-left">
                                     <div className="font-medium text-app-text">Restart Scheduler</div>
                                     <div className="text-xs text-app-dim group-hover:text-app-text/70">Re-initializes jobs (no config reload)</div>
                                 </div>
                             </div>
                        </button>

                        <button
                            onClick={() => callSystemAction('config', '/api/settings/refresh-cache')}
                            disabled={loading !== null}
                            className="flex items-center justify-between p-4 bg-app-card rounded-lg border border-app-border hover:bg-app-card-hover hover:border-app-border/50 transition-all group disabled:opacity-50"
                        >
                             <div className="flex items-center gap-3">
                                 <Database className={`w-5 h-5 text-purple-400 ${loading === 'config' ? 'animate-pulse' : ''}`} />
                                 <div className="text-left">
                                     <div className="font-medium text-app-text">Reload Config & Cache</div>
                                     <div className="text-xs text-app-dim group-hover:text-app-text/70">Reloads disk config and refreshes prayer cache</div>
                                 </div>
                             </div>
                        </button>
                    </div>
                </div>

                {/* System Maintenance Jobs */}
                <div className="bg-app-card/40 border border-app-border rounded-xl p-6 overflow-hidden">
                    <h3 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" /> Maintenance Jobs
                    </h3>
                    <div className="overflow-x-auto max-h-[200px]">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-app-dim uppercase bg-app-bg/50 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th className="px-4 py-2 font-medium">Job Name</th>
                                    <th className="px-4 py-2 font-medium text-right">Next Run</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-app-border/50">
                                {jobs.length === 0 ? (
                                    <tr><td colSpan="2" className="px-4 py-8 text-center text-app-dim text-xs italic">No active maintenance jobs</td></tr>
                                ) : (
                                    jobs.map((job, i) => (
                                        <tr key={i}>
                                            <td className="px-4 py-3 font-medium text-app-text">{job.name}</td>
                                            <td className="px-4 py-3 text-app-dim text-right font-mono text-xs">
                                                {job.nextInvocation ? new Date(job.nextInvocation).toLocaleTimeString() : 'Pending'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Prayer Source Status */}
                <PrayerSourceStatusCard config={config} />

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
                        "bg-app-card/40 border border-app-border rounded-xl p-6 overflow-hidden transition-all duration-300 relative",
                        isGlobalDisabled && "opacity-60 grayscale bg-app-bg/10 pointer-events-none"
                    )}>
                        {isGlobalDisabled && (
                             <div className="absolute inset-0 z-10 flex items-center justify-center bg-app-bg/20 backdrop-blur-[1px]">
                                 <div className="bg-app-card/90 px-4 py-2 rounded border border-app-border text-xs font-bold text-app-dim uppercase tracking-wider shadow-xl flex items-center gap-2">
                                     <div className="w-2 h-2 rounded-full bg-app-dim/50"></div>
                                     Automation Globally Disabled
                                 </div>
                             </div>
                        )}

                         <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-4">
                                <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></span>
                                    Automation Status
                                </h3>
                                <button 
                                    onClick={fetchDiagnostics}
                                    title="Refresh Automation Status"
                                    className="p-1 px-2 rounded-md bg-app-card border border-app-border hover:bg-app-card-hover text-app-dim hover:text-app-text transition-all text-xs flex items-center gap-1"
                                >
                                    <RefreshCw className="w-3 h-3" /> Refresh
                                </button>
                             </div>
                             <div className="flex gap-4 text-xs font-medium">
                                 <div className="flex items-center gap-2 text-app-dim">
                                     <span className="w-2 h-2 rounded-full bg-emerald-500/50"></span> Passed
                                 </div>
                                 <div className="flex items-center gap-2 text-app-dim">
                                     <span className="w-2 h-2 rounded-full bg-blue-500/50"></span> Upcoming
                                 </div>
                             </div>
                         </div>
                         <div className="overflow-x-auto">
                             <table className="w-full text-sm text-center">
                                 <thead className="text-xs text-app-dim uppercase bg-app-bg/50">
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
                                 <tbody className="divide-y divide-app-border/50">
                                     {!automationStatus ? (
                                         <tr><td colSpan="5" className="p-4 text-center text-app-dim">Loading...</td></tr>
                                     ) : Object.entries(automationStatus).map(([prayer, events]) => (
                                         <tr key={prayer}>
                                             <td className="px-3 py-3 text-left font-medium text-app-dim capitalize">{prayer}</td>
                                             <td className={cn("px-2 py-2", isPreAdhanDisabled && "opacity-20 grayscale pointer-events-none")}>
                                                <AutomationStatusCell {...events.preAdhan} />
                                             </td>
                                             <td className={cn("px-2 py-2", isAdhanDisabled && "opacity-20 grayscale pointer-events-none")}>
                                                <AutomationStatusCell {...events.adhan} />
                                             </td>
                                             <td className={cn("px-2 py-2", isPreIqamahDisabled && "opacity-20 grayscale pointer-events-none")}>
                                                {prayer === 'sunrise' ? (
                                                    <div className="px-2 py-1 rounded text-xs font-mono border text-center bg-app-card text-app-dim border-app-border h-[26px] flex items-center justify-center">
                                                        <div className="w-6 border-t-2 border-dashed border-app-dim/40" />
                                                    </div>
                                                ) : <AutomationStatusCell {...events.preIqamah} />}
                                             </td>
                                             <td className={cn("px-2 py-2", isIqamahDisabled && "opacity-20 grayscale pointer-events-none")}>
                                                {prayer === 'sunrise' ? (
                                                    <div className="px-2 py-1 rounded text-xs font-mono border text-center bg-app-card text-app-dim border-app-border h-[26px] flex items-center justify-center">
                                                        <div className="w-6 border-t-2 border-dashed border-app-dim/40" />
                                                    </div>
                                                ) : <AutomationStatusCell {...events.iqamah} />}
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
                "bg-app-card/40 border border-app-border rounded-xl p-6 overflow-hidden transition-opacity",
                !systemHealth.tts && "opacity-50 grayscale select-none pointer-events-none"
            )}>
                 <div className="flex items-center justify-between mb-4">
                     <div className="flex items-center gap-4">
                        <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full shadow-lg", !systemHealth.tts?.healthy ? "bg-app-dim/50" : "bg-purple-500 shadow-purple-500/50")}></span>
                            TTS Asset Status
                        </h3>
                        <button 
                            onClick={fetchDiagnostics}
                            title="Refresh TTS Status"
                            className="p-1 px-2 rounded-md bg-app-card border border-app-border hover:bg-app-card-hover text-app-dim hover:text-app-text transition-all text-xs flex items-center gap-1"
                        >
                            <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                     </div>
                     {!systemHealth.tts?.healthy && (
                         <div className="px-2 py-0.5 rounded bg-app-card border border-app-border text-xs text-app-dim font-mono">
                             SERVICE OFFLINE
                         </div>
                     )}
                 </div>
                 <div className="overflow-x-auto">
                     <table className="w-full text-sm text-center">
                         <thead className="text-xs text-app-dim uppercase bg-app-bg/50">
                             <tr>
                                 <th className="px-3 py-2 text-left">Prayer</th>
                                 <th className="px-3 py-2">Pre-Adhan</th>
                                 <th className="px-3 py-2">Adhan</th>
                                 <th className="px-3 py-2">Pre-Iqamah</th>
                                 <th className="px-3 py-2">Iqamah</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-app-border/50">
                             {!ttsStatus ? (
                                 <tr><td colSpan="5" className="p-4 text-center text-app-dim">Loading...</td></tr>
                             ) : Object.entries(ttsStatus).map(([prayer, events]) => (
                                 <tr key={prayer}>
                                     <td className="px-3 py-3 text-left font-medium text-app-dim capitalize">{prayer}</td>
                                     <td className="px-2 py-2"><TTSStatusCell {...events.preAdhan} /></td>
                                     <td className="px-2 py-2"><TTSStatusCell {...events.adhan} /></td>
                                     <td className="px-2 py-2">
                                        {prayer === 'sunrise' ? (
                                            <div className="px-2 py-1 rounded text-xs font-mono border text-center bg-app-card text-app-dim border-app-border h-[26px] flex items-center justify-center">
                                                <div className="w-6 border-t-2 border-dashed border-app-dim/40" />
                                            </div>
                                        ) : <TTSStatusCell {...events.preIqamah} />}
                                     </td>
                                     <td className="px-2 py-2">
                                        {prayer === 'sunrise' ? (
                                            <div className="px-2 py-1 rounded text-xs font-mono border text-center bg-app-card text-app-dim border-app-border h-[26px] flex items-center justify-center">
                                                <div className="w-6 border-t-2 border-dashed border-app-dim/40" />
                                            </div>
                                        ) : <TTSStatusCell {...events.iqamah} />}
                                     </td>
                                 </tr>
                             ))}
                         </tbody>
                     </table>
                 </div>
            </div>

            {/* Storage Management */}
             <div className="w-full">
                 <StorageManagementCard 
                     config={config} 
                     onSave={(newLimit) => {
                         const newConfig = { ...config };
                         if (!newConfig.data) newConfig.data = {};
                         newConfig.data.storageLimit = parseFloat(newLimit);
                     }}
                 />
             </div>

            {/* Logs Console */}
            <div className="bg-app-bg border border-app-border rounded-xl overflow-hidden font-mono text-sm shadow-xl">
                <div className="flex items-center justify-between px-4 py-2 bg-app-card border-b border-app-border">
                     <span className="text-app-dim text-xs font-bold uppercase tracking-wider">System Logs (Live)</span>
                     <div className="flex gap-2">
                         <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                         <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                         <span className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                     </div>
                </div>
                <div className="h-64 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
                    {logs && logs.length > 0 ? [...logs].reverse().map((log, i) => (
                        <div key={i} className="flex gap-3 text-app-text hover:bg-app-card-hover px-2 py-0.5 rounded -mx-2">
                            <span className="text-app-dim/60 shrink-0 select-none text-xs mt-0.5">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`text-xs font-bold mt-0.5 w-12 ${
                                log.level === 'ERROR' ? 'text-red-400' : 
                                log.level === 'WARN' ? 'text-amber-400' : 'text-emerald-400'
                            }`}>[{log.level}]</span>
                            <span className="break-all">{log.message}</span>
                        </div>
                    )) : (
                        <div className="text-app-dim italic text-xs p-2">No logs received yet...</div>
                    )}
                </div>
            </div>
            
            <ConfirmModal 
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={() => setShowConfirm(false)} 
                onCancel={() => {
                    setFailedVoiceMonkey(true);
                    setFeedback(prev => ({ ...prev, voiceMonkey: "Audible Check Failed" }));
                    setShowConfirm(false); 
                }}
                title="Audio Verification"
                message="A test sound was sent to your VoiceMonkey device. Did you hear it?"
                confirmText="Yes"
                cancelText="No"
            />
        </div>
    );
}

function StorageManagementCard({ config }) {
    const [storage, setStorage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
    const [limit, setLimit] = useState(config?.data?.storageLimit || 1.0);
    const { draftConfig, updateSetting, saveSettings } = useSettings();

    const fetchStorage = async () => {
        try {
            const res = await fetch('/api/system/storage');
            if (res.ok) {
                const data = await res.json();
                setStorage(data);
            }
            setLoading(false);
        } catch (e) {
            console.error("Failed to fetch storage stats", e);
        }
    };

    useEffect(() => {
        fetchStorage();
        const interval = setInterval(fetchStorage, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (config?.data?.storageLimit !== undefined) {
            setLimit(config.data.storageLimit);
        }
    }, [config?.data?.storageLimit]);

    const handleSave = async () => {
        setSaving(true);
        setFeedback(null);
        try {
            const parsedLimit = parseFloat(limit);
            if (isNaN(parsedLimit) || parsedLimit < 0.1) {
                setFeedback({ type: 'error', message: 'Invalid limit' });
                return;
            }

            const nextConfig = JSON.parse(JSON.stringify(draftConfig || config));
            if (!nextConfig.data) nextConfig.data = {};
            nextConfig.data.storageLimit = parsedLimit;

            updateSetting('data.storageLimit', parsedLimit);
            
            const result = await saveSettings(nextConfig);
            if (result && result.success) {
                setFeedback({ type: 'success', message: 'Limit updated' });
                await fetchStorage();
                setTimeout(() => setFeedback(null), 3000);
            } else {
                setFeedback({ type: 'error', message: result?.error || 'Save failed' });
            }
        } catch (e) {
            console.error("Failed to save storage limit", e);
            setFeedback({ type: 'error', message: 'Connection Error' });
        } finally {
            setSaving(false);
        }
    };

    if (loading || !storage) {
        return (
            <div className="bg-app-card/40 border border-app-border rounded-xl p-6 h-full flex items-center justify-center min-h-[220px]">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-6 h-6 text-app-dim animate-spin" />
                    <span className="text-xs text-app-dim font-medium uppercase tracking-wider">Loading Storage Stats...</span>
                </div>
            </div>
        );
    }

    const usedMB = (storage.usedBytes / (1024 * 1024)).toFixed(1);
    const limitMB = (storage.limitBytes / (1024 * 1024)).toFixed(0);
    const freeSystemGB = (storage.systemFreeBytes / (1024 * 1024 * 1024)).toFixed(1);
    const percentUsed = Math.min(100, (storage.usedBytes / storage.limitBytes) * 100);
    
    let barColor = 'bg-emerald-500';
    if (percentUsed > 90) barColor = 'bg-red-500';
    else if (percentUsed > 75) barColor = 'bg-amber-500';

    return (
        <div className="bg-app-card/40 border border-app-border rounded-xl p-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                <HardDrive className="w-32 h-32" />
            </div>

            <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-emerald-500" /> Storage Management
                </h3>
                <div className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1",
                    percentUsed > 90 ? "bg-red-900/20 border-red-800 text-red-400" :
                    percentUsed > 75 ? "bg-amber-900/20 border-amber-800 text-amber-400" :
                    "bg-emerald-900/20 border-emerald-800 text-emerald-400"
                )}>
                    {percentUsed.toFixed(1)}% USED
                </div>
            </div>

            <div className="space-y-6 relative z-10">
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                        <span className="text-app-text">Virtual Quota Usage</span>
                        <span className="text-app-dim">{usedMB} MB / {limitMB} MB</span>
                    </div>
                    <div className="h-3 w-full bg-app-bg rounded-full overflow-hidden border border-app-border/50 p-0.5">
                        <div 
                            className={cn("h-full rounded-full transition-all duration-1000 ease-out shadow-sm", barColor)}
                            style={{ width: `${percentUsed}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-app-dim/60">
                         <div className="flex gap-4">
                             <div className="flex items-center gap-1">
                                 <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></div>
                                 Custom: {((storage.breakdown?.custom || 0) / (1024 * 1024)).toFixed(1)} MB
                             </div>
                             <div className="flex items-center gap-1">
                                 <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></div>
                                 Cache: {((storage.breakdown?.cache || 0) / (1024 * 1024)).toFixed(1)} MB
                             </div>
                         </div>
                         <div className="font-mono">
                             Disk Free: {freeSystemGB} GB
                         </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-app-border/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-app-dim uppercase tracking-wider">Storage Limit (GB)</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                step="0.1" 
                                min="0.1"
                                value={limit}
                                onChange={(e) => setLimit(e.target.value)}
                                className="w-full bg-app-bg border border-app-border rounded-lg px-3 py-2 text-app-text text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all font-medium"
                            />
                            <button 
                                onClick={handleSave}
                                disabled={saving || parseFloat(limit) === config?.data?.storageLimit}
                                className={cn(
                                    "p-2 rounded-lg transition-all shadow-lg flex items-center justify-center min-w-[36px]",
                                    feedback?.type === 'success' ? "bg-emerald-500 text-white" :
                                    feedback?.type === 'error' ? "bg-red-500 text-white" :
                                    "bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50"
                                )}
                            >
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                                 feedback?.type === 'success' ? <CheckCircle className="w-4 h-4" /> :
                                 feedback?.type === 'error' ? <XCircle className="w-4 h-4" /> :
                                 <Save className="w-4 h-4" />}
                            </button>
                        </div>
                        <div className="flex justify-between items-center h-4">
                            <p className="text-[10px] text-app-dim italic">
                                Recommended: {storage.recommendedLimitGB} GB
                            </p>
                            {feedback && (
                                <span className={cn(
                                    "text-[10px] font-bold uppercase tracking-tighter",
                                    feedback.type === 'success' ? "text-emerald-500" : "text-red-500"
                                )}>
                                    {feedback.message}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col justify-end">
                         <div className="p-3 bg-app-bg/50 rounded-lg border border-app-border/30 flex items-start gap-3">
                             <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                             <div className="text-[10px] text-app-dim leading-relaxed">
                                 Limits apply to <span className="text-app-text font-medium">public/audio</span> directory. 
                                 TTS generation and file uploads will be blocked if reached.
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
