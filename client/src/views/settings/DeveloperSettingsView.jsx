import { useState, useEffect, useMemo } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { RefreshCw, Activity, Database, LayoutGrid, Terminal, HeartPulse } from 'lucide-react';
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
    
    // Tab State
    const activeTab = searchParams.get('tab') || 'diagnostics';
    const setActiveTab = (tab) => setSearchParams({ tab }, { replace: true });

    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(null); // 'tts' | 'scheduler' | null
    const [message, setMessage] = useState(null);
    const [automationStatus, setAutomationStatus] = useState(null);
    const [ttsStatus, setTtsStatus] = useState(null);

    const [refreshing, setRefreshing] = useState(null); // 'api' | 'tts' | 'local'
    const [feedback, setFeedback] = useState({}); // { api: "Message", ... }
    const [apiOnline, setApiOnline] = useState(true); 
    const [jobStatuses, setJobStatuses] = useState({}); // { [jobName]: 'loading' | 'success' | 'error' }

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
        setRefreshing(target);
        // Clear old feedback for this target
        setFeedback(prev => ({ ...prev, [target]: null }));
        
        let feedbackMsg = null;

        if (target === 'api') {
            try {
                // Direct ping to check connectivity
                const res = await fetch('/api/health'); // Use endpoint that just returns state
                if (res.ok) {
                     setApiOnline(true);
                     feedbackMsg = "Online";
                } else {
                     throw new Error('Status ' + res.status);
                }
            } catch (e) {
                setApiOnline(false);
                feedbackMsg = "Unreachable";
            }
        } else {
            const res = await refreshHealth(target);
            if (res && res[target]) {
                 const item = res[target];
                 feedbackMsg = item.message || (item.healthy ? "Online" : "Offline");
            } else if (res && res.error) {
                 // Handle Rate Limit or other explicit errors
                 feedbackMsg = res.error;
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
            
            setAutomationStatus(autoData);
            setTtsStatus(ttsData);
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
                await refreshHealth('primarySource');
                await refreshHealth('backupSource');
            }
            fetchJobs();
            fetchDiagnostics();
        }
    };

    const handleRunJob = async (jobName) => {
        setJobStatuses(prev => ({ ...prev, [jobName]: 'loading' }));
        try {
            const res = await fetch('/api/system/run-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobName })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || 'Failed to trigger job');
            setMessage({ type: 'success', text: `Job "${jobName}" executed successfully.` });
            setJobStatuses(prev => ({ ...prev, [jobName]: 'success' }));
            fetchJobs(); // Refresh next run times
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
            setJobStatuses(prev => ({ ...prev, [jobName]: 'error' }));
        } finally {
            setTimeout(() => {
                setJobStatuses(prev => ({ ...prev, [jobName]: null }));
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
                                    {message.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            )}
                        </div>
                        <button 
                            onClick={() => setMessage(null)}
                            className="text-app-dim hover:text-app-text transition-colors"
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