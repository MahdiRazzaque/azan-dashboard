import { RefreshCw, Activity, Power, Database, RotateCcw, HardDrive, CheckCircle, XCircle, Volume2 } from 'lucide-react';
import PrayerSourceStatusCard from '@/components/settings/PrayerSourceStatusCard';
import StorageManagementCard from './StorageManagementCard';
import NetworkConfigCard from './NetworkConfigCard';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export default function DiagnosticsTab({ 
    config,
    systemHealth, 
    apiOnline, 
    refreshing, 
    handleManualRefresh, 
    feedback, 
    failedVoiceMonkey, 
    loading, 
    callSystemAction,
    handleRunJob,
    jobStatuses = {},
    jobs
}) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
            {/* System Health */}
            <div className="bg-app-card/40 border border-app-border rounded-xl p-6 lg:col-span-2">
                <h3 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" /> System Health
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-4">
                        {/* API Health */}
                        <HealthItem 
                            label="API Server" 
                            online={apiOnline} 
                            subtext={`Node.js Backend (Port ${systemHealth?.ports?.api || '3000'})`}
                            onRefresh={() => handleManualRefresh('api')}
                            refreshing={refreshing === 'api'}
                            feedback={feedback?.api}
                        />

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
                                <div className="text-xs text-app-dim">Cloud API Connectivity</div>
                            </div>
                            <div className="relative flex items-center gap-1">
                                {feedback?.voiceMonkey && <FeedbackBalloon text={feedback.voiceMonkey} />}
                                <button 
                                    onClick={() => handleManualRefresh('voiceMonkey', 'loud')}
                                    disabled={refreshing === 'voiceMonkey'}
                                    className={cn("p-1.5 hover:bg-app-card-hover rounded text-app-dim transition-colors", refreshing === 'voiceMonkey' && "text-amber-500")}
                                    title="Test Speaker Output"
                                >
                                    <Volume2 className="w-4 h-4" />
                                </button>
                                <div className="w-px h-4 bg-app-border mx-1"></div>
                                <button 
                                    onClick={() => handleManualRefresh('voiceMonkey', 'silent')}
                                    disabled={refreshing === 'voiceMonkey'}
                                    className={cn("p-1.5 hover:bg-app-card-hover rounded text-app-dim transition-colors", refreshing === 'voiceMonkey' && "text-emerald-500")}
                                    title="Silent Check"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <HealthItem 
                            label="TTS Service" 
                            online={systemHealth.tts?.healthy} 
                            subtext={`Python Server (Port ${systemHealth?.ports?.tts || '8000'})`}
                            onRefresh={() => handleManualRefresh('tts')}
                            refreshing={refreshing === 'tts'}
                            feedback={feedback?.tts}
                        />
                        <HealthItem 
                            label="Local Audio" 
                            online={systemHealth.local?.healthy} 
                            subtext={systemHealth.local?.healthy ? "mpg123 CLI Tool" : (systemHealth.local?.message || "Not Found")}
                            onRefresh={() => handleManualRefresh('local')}
                            refreshing={refreshing === 'local'}
                            feedback={feedback?.local}
                        />
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="bg-app-card/40 border border-app-border rounded-xl p-6">
                <h3 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
                    <Power className="w-5 h-5 text-emerald-500" /> System Actions
                </h3>
                <div className="flex flex-col gap-3">
                    <ActionButton 
                        label="Regenerate TTS Assets"
                        subtext={systemHealth.tts ? "Rebuilds audio files for today's cache" : "TTS Service Offline"}
                        icon={RefreshCw}
                        color="text-blue-400"
                        loading={loading === 'tts'}
                        disabled={loading !== null || !systemHealth.tts}
                        onClick={() => callSystemAction('tts', '/api/system/regenerate-tts')}
                    />
                    <ActionButton 
                        label="Restart Scheduler"
                        subtext="Re-initializes jobs (no config reload)"
                        icon={RotateCcw}
                        color="text-amber-400"
                        loading={loading === 'scheduler'}
                        disabled={loading !== null}
                        onClick={() => callSystemAction('scheduler', '/api/system/restart-scheduler')}
                    />
                    <ActionButton 
                        label="Reload Config & Cache"
                        subtext="Reloads disk config and refreshes prayer cache"
                        icon={Database}
                        color="text-purple-400"
                        loading={loading === 'config'}
                        disabled={loading !== null}
                        onClick={() => callSystemAction('config', '/api/settings/refresh-cache')}
                    />
                    <ActionButton 
                        label="Clean Temp TTS Files"
                        subtext="Removes old preview audio files"
                        icon={HardDrive}
                        color="text-rose-400"
                        loading={loading === 'tempCleanup'}
                        disabled={loading !== null}
                        onClick={() => callSystemAction('tempCleanup', '/api/system/cleanup-temp-tts')}
                    />
                </div>
            </div>

            {/* Maintenance Jobs */}
            <div className="bg-app-card/40 border border-app-border rounded-xl p-6 overflow-hidden">
                <h3 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-500" /> Maintenance Jobs
                </h3>
                <div className="overflow-x-auto max-h-[300px] -mx-6 px-6">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-app-dim uppercase bg-app-bg/50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-2 font-medium">Job Name</th>
                                <th className="px-4 py-2 font-medium">Next Run</th>
                                <th className="px-4 py-2 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border/50">
                            {jobs.length === 0 ? (
                                <tr><td colSpan="3" className="px-4 py-8 text-center text-app-dim text-xs italic">No active maintenance jobs</td></tr>
                            ) : (
                                jobs.map((job, i) => (
                                    <tr key={i} className="group hover:bg-app-card/40 transition-colors">
                                        <td className="px-4 py-3 font-medium text-app-text">{job.name}</td>
                                        <td className="px-4 py-3 text-app-dim font-mono text-xs">
                                            {job.nextInvocation ? new Date(job.nextInvocation).toLocaleTimeString() : 'Pending'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => handleRunJob(job.name)}
                                                disabled={jobStatuses[job.name] === 'loading'}
                                                className={cn(
                                                    "p-1.5 rounded-md transition-all disabled:opacity-50",
                                                    !jobStatuses[job.name] && "hover:bg-app-bg text-app-dim hover:text-emerald-500",
                                                    jobStatuses[job.name] === 'loading' && "text-app-dim",
                                                    jobStatuses[job.name] === 'success' && "text-emerald-500 bg-emerald-500/10",
                                                    jobStatuses[job.name] === 'error' && "text-red-500 bg-red-500/10"
                                                )}
                                                title="Run Now"
                                            >
                                                {jobStatuses[job.name] === 'loading' ? (
                                                     <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                ) : jobStatuses[job.name] === 'success' ? (
                                                     <CheckCircle className="w-3.5 h-3.5" />
                                                ) : jobStatuses[job.name] === 'error' ? (
                                                     <XCircle className="w-3.5 h-3.5" />
                                                ) : (
                                                     <Power className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="lg:col-span-2 text-app-text">
                <PrayerSourceStatusCard config={config} />
            </div>
            <NetworkConfigCard />
            <StorageManagementCard config={config} />
        </div>
    );
}

function HealthItem({ label, online, subtext, onRefresh, refreshing, feedback }) {
    return (
        <div className="flex items-center justify-between p-3 bg-app-card rounded border border-app-border">
            <div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-app-text">{label}</span>
                    {online ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="text-xs text-app-dim">{subtext}</div>
            </div>
            <div className="relative">
                {feedback && <FeedbackBalloon text={feedback} />}
                <button 
                    onClick={onRefresh}
                    disabled={refreshing}
                    className={cn("p-1.5 hover:bg-app-card-hover rounded text-app-dim transition-colors", refreshing && "text-emerald-500")}
                >
                    <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                </button>
            </div>
        </div>
    );
}

function FeedbackBalloon({ text }) {
    return (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-app-card text-app-text text-xs rounded border border-app-border whitespace-nowrap z-10 shadow-lg animate-in fade-in zoom-in-95 duration-200">
            {text}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-app-card border-b border-r border-app-border rotate-45"></div>
        </div>
    );
}

function ActionButton({ label, subtext, icon: Icon, color, loading, disabled, onClick }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex items-center justify-between p-4 bg-app-card rounded-lg border border-app-border hover:bg-app-card-hover transition-all group disabled:opacity-50"
        >
            <div className="flex items-center gap-3 text-left">
                <Icon className={cn("w-5 h-5", color, loading && "animate-spin")} />
                <div>
                    <div className="font-medium text-app-text">{label}</div>
                    <div className="text-xs text-app-dim group-hover:text-app-text/70">{subtext}</div>
                </div>
            </div>
        </button>
    );
}
