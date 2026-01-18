import { useState, useEffect } from 'react';
import { Database, Globe, Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useSettings } from '../../contexts/SettingsContext';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function PrayerSourceStatusCard({ config }) {
    const { systemHealth, refreshHealth } = useSettings();
    const [activeSource, setActiveSource] = useState(null);
    const [loading, setLoading] = useState(null); // 'primary' | 'backup' | null
    const [results, setResults] = useState({}); // { primary: { success: true, message: '...' } }

    const fetchActiveSource = async () => {
        try {
            const res = await fetch('/api/prayers');
            const data = await res.json();
            if (data.meta && data.meta.source) {
                setActiveSource(data.meta.source);
            }
        } catch (err) {
            console.error('Failed to fetch active source:', err);
        }
    };

    useEffect(() => {
        fetchActiveSource();
    }, [config]);

    const testConnection = async (target) => {
        setLoading(target);
        setResults(prev => ({ ...prev, [target]: null }));
        
        try {
            const res = await fetch('/api/system/source/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target })
            });
            const data = await res.json();
            
            setResults(prev => ({ 
                ...prev, 
                [target]: { success: data.success, message: data.success ? data.message : (data.message || data.error) } 
            }));

            // Refresh health cache to update "Online" badges immediately
            await refreshHealth(target === 'primary' ? 'primarySource' : 'backupSource');

        } catch (err) {
            setResults(prev => ({ 
                ...prev, 
                [target]: { success: false, message: err.message } 
            }));
        } finally {
            setLoading(null);
            setTimeout(() => {
                setResults(prev => ({ ...prev, [target]: null }));
            }, 5000);
        }
    };

    const primary = config?.sources?.primary;
    const backup = config?.sources?.backup;
    const isBackupEnabled = backup && backup.enabled !== false;

    // Active Logic
    const isActivePrimary = activeSource && activeSource.toLowerCase().includes(primary?.type?.toLowerCase());
    
    // Cache Fallback Detection
    const isPrimaryDown = systemHealth?.primarySource?.healthy === false;
    const isBackupDown = systemHealth?.backupSource?.healthy === false;
    const isUsingCache = isPrimaryDown && (!isBackupEnabled || isBackupDown);
    
    const getStatusText = () => {
        if (isUsingCache) return 'Dashboard Cache';
        return activeSource || 'Detecting...';
    };

    const getStatusColor = () => {
        if (isUsingCache) return 'text-indigo-400';
        if (!activeSource) return 'text-app-dim';
        const sourceMatch = activeSource.toLowerCase().includes(primary?.type?.toLowerCase());
        return sourceMatch ? 'text-emerald-400' : 'text-amber-400';
    };

    const Row = ({ label, source, target, disabled }) => {
        const result = results[target];
        const isLoading = loading === target;
        
        // Get Health from systemHealth context
        const healthKey = target === 'primary' ? 'primarySource' : 'backupSource';
        const health = systemHealth?.[healthKey];

        return (
            <div className={cn(
                "flex flex-col p-4 bg-app-card rounded-lg border border-app-border transition-all gap-4",
                disabled && "opacity-50 grayscale"
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-app-bg rounded-lg">
                            {source?.type === 'aladhan' ? <Globe className="w-5 h-5 text-blue-400" /> : <Database className="w-5 h-5 text-emerald-400" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-app-text">{label}</span>
                                {health && (
                                    <div className={cn(
                                        "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                        health.healthy ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-red-900/20 border-red-800 text-red-400"
                                    )}>
                                        <div className={cn("w-1.5 h-1.5 rounded-full", health.healthy ? "bg-emerald-500" : "bg-red-500")} />
                                        {health.message || (health.healthy ? 'Online' : 'Offline')}
                                    </div>
                                )}
                            </div>
                            <div className="text-xs text-app-dim mt-0.5 font-mono">
                                {source?.type || 'Not Set'}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-3 mt-auto">
                    {result && (
                        <div className={cn(
                            "flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded border animate-in fade-in zoom-in-95",
                            result.success ? "bg-emerald-900/20 border-emerald-800 text-emerald-400" : "bg-red-900/20 border-red-800 text-red-400"
                        )}>
                            {result.success ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span className="truncate">{result.success ? "Connection Success" : result.message}</span>
                        </div>
                    )}
                    
                    <button
                        onClick={() => testConnection(target)}
                        disabled={isLoading || disabled}
                        className="flex items-center justify-center gap-2 px-3 py-2 bg-app-card' hover:bg-app-card-hover text-app-dim rounded border border-app-border transition-all disabled:opacity-50 w-full"
                    >
                        {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                        <span className="text-xs font-semibold">Test Connectivity</span>
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-app-card/40 border border-app-border rounded-xl p-6 lg:col-span-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
                    <Database className="w-5 h-5 text-emerald-500" /> Prayer Source Status
                </h3>
                
                <div className="flex items-center gap-2 bg-app-bg px-3 py-1.5 rounded-full border border-app-border shadow-inner">
                    <div className={cn(
                        "w-2 h-2 rounded-full",
                        isUsingCache ? "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" :
                        activeSource ? (isActivePrimary ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]") : "bg-app-dim/50"
                    )} />
                    <span className="text-xs font-medium text-app-dim">Current Source:</span>
                    <span className={cn("text-xs font-bold", getStatusColor())}>
                        {getStatusText()}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Row 
                    label="Primary" 
                    source={primary} 
                    target="primary" 
                />
                
                <Row 
                    label="Backup" 
                    source={backup} 
                    target="backup" 
                    disabled={!isBackupEnabled}
                />
            </div>

            <p className="mt-6 text-xs text-app-dim flex items-center gap-1.5 bg-app-card/50 p-3 rounded border border-app-border/50 italic">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                These tests occur independently of the dashboard cache. A successful test means the source is reachable.
            </p>
        </div>
    );
}
