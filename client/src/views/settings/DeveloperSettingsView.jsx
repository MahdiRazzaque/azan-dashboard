/* eslint-disable jsdoc/require-jsdoc */
import { useReducer, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Activity, LayoutGrid, Terminal, HeartPulse } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import DiagnosticsTab from '@/components/settings/developer/DiagnosticsTab';
import AutomationTTSTab from '@/components/settings/developer/AutomationTTSTab';
import SystemLogsTab from '@/components/settings/developer/SystemLogsTab';
import HealthTab from '@/components/settings/developer/HealthTab';

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 *
 * @param {...any} inputs - The class names or objects to merge.
 * @returns {string} The merged class string.
 */
function cn(...inputs) { return twMerge(clsx(inputs)); }

const initialState = {
    jobs: [],
    loading: null,
    message: null,
    automationStatus: null,
    ttsStatus: null,
    refreshing: null,
    feedback: {},
    apiOnline: true,
    jobStatuses: {},
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_JOBS':
            return { ...state, jobs: action.jobs };
        case 'SET_DIAGNOSTICS':
            return { ...state, automationStatus: action.automationStatus, ttsStatus: action.ttsStatus };
        case 'SET_LOADING':
            return { ...state, loading: action.loading };
        case 'SET_MESSAGE':
            return { ...state, message: action.message };
        case 'CLEAR_MESSAGE':
            return { ...state, message: null };
        case 'START_REFRESH':
            return { ...state, refreshing: action.target, feedback: { ...state.feedback, [action.target]: null } };
        case 'SET_API_ONLINE':
            return { ...state, apiOnline: action.online };
        case 'SET_FEEDBACK':
            return { ...state, feedback: { ...state.feedback, [action.target]: action.message } };
        case 'CLEAR_FEEDBACK':
            return { ...state, feedback: { ...state.feedback, [action.target]: null } };
        case 'END_REFRESH':
            return { ...state, refreshing: null };
        case 'SET_JOB_STATUS':
            return { ...state, jobStatuses: { ...state.jobStatuses, [action.jobName]: action.status } };
        default:
            return state;
    }
}

/**
 * A comprehensive developer view providing diagnostics, system logs, job scheduling 
 * status, and advanced system controls like restarts and cache clearing.
 *
 * @returns {JSX.Element} The rendered developer settings view.
 */
export default function DeveloperSettingsView() {
    const { logs } = useOutletContext();
    const { systemHealth, refreshHealth, config, refresh } = useSettings();
    const [searchParams, setSearchParams] = useSearchParams();
    
    const activeTab = searchParams.get('tab') || 'diagnostics';
    const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

    const [state, dispatch] = useReducer(reducer, initialState);
    const { jobs, loading, message, automationStatus, ttsStatus, refreshing, feedback, apiOnline, jobStatuses } = state;

    const TABS = [
        { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
        { id: 'health', label: 'Health', icon: HeartPulse },
        { id: 'automation', label: 'Automation & TTS', icon: LayoutGrid },
        { id: 'logs', label: 'System Logs', icon: Terminal }
    ];

    const handleManualRefresh = async (target) => {
        await executeRefresh(target);
    };

    const executeRefresh = async (target) => {
        dispatch({ type: 'START_REFRESH', target });
        
        let feedbackMsg = null;

        if (target === 'api') {
            try {
                const res = await fetch('/api/health');
                if (res.ok) {
                     dispatch({ type: 'SET_API_ONLINE', online: true });
                     feedbackMsg = "Online";
                } else {
                     throw new Error('Status ' + res.status);
                }
            } catch (e) {
                dispatch({ type: 'SET_API_ONLINE', online: false });
                feedbackMsg = "Unreachable";
            }
        } else {
            const res = await refreshHealth(target);
            if (res && res[target]) {
                 const item = res[target];
                 feedbackMsg = item.message || (item.healthy ? "Online" : "Offline");
            } else if (res && res.error) {
                 feedbackMsg = res.error;
            }
        }

        if (feedbackMsg) {
            dispatch({ type: 'SET_FEEDBACK', target, message: feedbackMsg });
            
            setTimeout(() => {
                dispatch({ type: 'CLEAR_FEEDBACK', target });
            }, 3000);
        }
        dispatch({ type: 'END_REFRESH' });
    };

    const fetchJobs = () => {
        fetch('/api/system/jobs')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                     dispatch({ type: 'SET_JOBS', jobs: data });
                } else if (data && (data.maintenance || data.automation)) {
                     dispatch({ type: 'SET_JOBS', jobs: data.maintenance || [] });
                } else {
                     dispatch({ type: 'SET_JOBS', jobs: [] });
                }
            })
            .catch(err => console.error("Failed to fetch jobs", err));
    };

    const fetchDiagnostics = async () => {
        try {
            const [autoRes, ttsRes] = await Promise.all([
                fetch('/api/system/status/automation'),
                fetch('/api/system/status/tts')
            ]);
            
            if (!autoRes.ok || !ttsRes.ok) throw new Error('Refresh failed');
            
            const [autoData, ttsData] = await Promise.all([
                autoRes.json(),
                ttsRes.json()
            ]);
            
            dispatch({ type: 'SET_DIAGNOSTICS', automationStatus: autoData, ttsStatus: ttsData });
            return true;
        } catch (err) {
            console.error("Failed to fetch diagnostics", err);
            return false;
        }
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
        dispatch({ type: 'SET_LOADING', loading: action });
        dispatch({ type: 'CLEAR_MESSAGE' });
        try {
            const res = await fetch(endpoint, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if(!res.ok) throw new Error(data.message || data.error || 'Failed');
            dispatch({ type: 'SET_MESSAGE', message: { 
                type: data.warnings && data.warnings.length > 0 ? 'warning' : 'success', 
                text: data.message,
                warnings: data.warnings
            }});
        } catch (err) {
            dispatch({ type: 'SET_MESSAGE', message: { type: 'error', text: err.message } });
        } finally {
            dispatch({ type: 'SET_LOADING', loading: null });
            if (action === 'config') {
                await Promise.all([
                    refresh(),
                    refreshHealth('primarySource'),
                    refreshHealth('backupSource')
                ]);
            }
            fetchJobs();
            fetchDiagnostics();
        }
    };

    const handleRunJob = async (jobName) => {
        dispatch({ type: 'SET_JOB_STATUS', jobName, status: 'loading' });
        try {
            const res = await fetch('/api/system/run-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobName })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to trigger job');
            dispatch({ type: 'SET_MESSAGE', message: { type: 'success', text: `Job "${jobName}" executed successfully.` } });
            dispatch({ type: 'SET_JOB_STATUS', jobName, status: 'success' });
            fetchJobs();
        } catch (error) {
            dispatch({ type: 'SET_MESSAGE', message: { type: 'error', text: error.message } });
            dispatch({ type: 'SET_JOB_STATUS', jobName, status: 'error' });
        } finally {
            setTimeout(() => {
                dispatch({ type: 'SET_JOB_STATUS', jobName, status: null });
            }, 3000);
        }
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-app-text mb-1">Developer Tools</h2>
                    <p className="text-app-dim text-sm">System diagnostics and maintenance operations.</p>
                </div>
                
                {/* Tab Switcher */}
                <div className="flex bg-app-card/60 p-1 rounded-lg border border-app-border backdrop-blur-sm self-start">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                                activeTab === tab.id 
                                    ? "bg-app-bg text-app-text shadow-lg border border-app-border/50" 
                                    : "text-app-dim hover:text-app-text hover:bg-app-card/80"
                            )}
                        >
                            <tab.icon className={cn("w-3.5 h-3.5", activeTab === tab.id ? "text-emerald-500" : "text-app-dim")} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {message && (
                <div className={`p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 ${
                    message.type === 'success' ? 'bg-emerald-900/10 border-emerald-800/30 text-emerald-300' : 
                    message.type === 'warning' ? 'bg-amber-900/10 border-amber-800/30 text-amber-300' :
                    'bg-red-900/10 border-red-800/30 text-red-300'
                }`}>
                    <div className="flex items-start gap-4">
                        <div className="flex-1">
                            <div className="font-semibold text-sm">{message.text}</div>
                            {message.warnings && message.warnings.length > 0 && (
                                <ul className="mt-2 text-xs opacity-70 list-disc list-inside space-y-0.5">
                                    {message.warnings.map((w) => <li key={w}>{w}</li>)}
                                </ul>
                            )}
                        </div>
                        <button 
                            onClick={() => dispatch({ type: 'CLEAR_MESSAGE' })}
                            className="text-app-dim hover:text-app-text transition-colors"
                            aria-label="Close message"
                        >
                            <LayoutGrid className="w-4 h-4 rotate-45" />
                        </button>
                    </div>
                </div>
            )}

            <div className="min-h-[400px]">
                {activeTab === 'diagnostics' && (
                    <DiagnosticsTab 
                        config={config}
                        systemHealth={systemHealth}
                        apiOnline={apiOnline}
                        refreshing={refreshing}
                        handleManualRefresh={handleManualRefresh}
                        feedback={feedback}
                        loading={loading}
                        callSystemAction={callSystemAction}
                        handleRunJob={handleRunJob}
                        jobStatuses={jobStatuses}
                        jobs={jobs}
                    />
                )}

                {activeTab === 'health' && (
                    <HealthTab 
                        config={config}
                        systemHealth={systemHealth}
                        refreshHealth={refreshHealth}
                        refresh={refresh}
                    />
                )}

                {activeTab === 'automation' && (
                    <AutomationTTSTab 
                        config={config}
                        systemHealth={systemHealth}
                        automationStatus={automationStatus}
                        ttsStatus={ttsStatus}
                        fetchDiagnostics={fetchDiagnostics}
                    />
                )}

                {activeTab === 'logs' && (
                    <SystemLogsTab logs={logs} />
                )}
            </div>
        </div>
    );
}
