/* eslint-disable jsdoc/require-jsdoc */
import { useReducer, useEffect, useCallback } from 'react';
import { HardDrive, RefreshCw, CheckCircle, XCircle, Save, AlertTriangle } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

const initialState = {
    storage: null,
    loading: true,
    saving: false,
    feedback: null,
    limit: 1.0,
};

function reducer(state, action) {
    switch (action.type) {
        case 'STORAGE_LOADED':
            return { ...state, storage: action.data, loading: false };
        case 'SYNC_LIMIT':
            return { ...state, limit: action.limit };
        case 'SET_LIMIT':
            return { ...state, limit: action.limit };
        case 'SAVE_START':
            return { ...state, saving: true, feedback: null };
        case 'SAVE_SUCCESS':
            return { ...state, saving: false, feedback: { type: 'success', message: action.message } };
        case 'SAVE_ERROR':
            return { ...state, saving: false, feedback: { type: 'error', message: action.message } };
        case 'VALIDATION_ERROR':
            return { ...state, feedback: { type: 'error', message: action.message } };
        case 'CLEAR_FEEDBACK':
            return { ...state, feedback: null };
        default:
            return state;
    }
}

/**
 * A React component that provides storage management capabilities.
 * It visualises disk usage for audio assets and allows users to configure
 * storage limits for the application's data.
 *
 * @param {Object} props - The component properties.
 * @param {Object} props.config - The application configuration object.
 * @returns {JSX.Element} The rendered storage management card.
 */
export default function StorageManagementCard({ config }) {
    const [state, dispatch] = useReducer(reducer, {
        ...initialState,
        limit: config?.data?.storageLimit || 1.0,
    });
    const { storage, loading, saving, feedback, limit } = state;
    const { draftConfig, updateSetting, saveSettings } = useSettings();

    const fetchStorage = useCallback(async () => {
        try {
            const res = await fetch('/api/system/storage');
            if (res.ok) {
                const data = await res.json();
                dispatch({ type: 'STORAGE_LOADED', data });
            } else {
                dispatch({ type: 'SAVE_ERROR', message: 'Failed to fetch storage stats' });
            }
        } catch (e) {
            console.error("Failed to fetch storage stats", e);
        }
    }, []);

    useEffect(() => {
        fetchStorage();
        const interval = setInterval(fetchStorage, 30000);
        return () => clearInterval(interval);
    }, [fetchStorage]);

    useEffect(() => {
        if (config?.data?.storageLimit !== undefined) {
            dispatch({ type: 'SYNC_LIMIT', limit: config.data.storageLimit });
        }
    }, [config?.data?.storageLimit]);

    const handleSave = async () => {
        dispatch({ type: 'SAVE_START' });
        try {
            const parsedLimit = parseFloat(limit);
            if (isNaN(parsedLimit) || parsedLimit < 0.1) {
                dispatch({ type: 'VALIDATION_ERROR', message: 'Invalid limit' });
                return;
            }

            const nextConfig = JSON.parse(JSON.stringify(draftConfig || config));
            if (!nextConfig.data) nextConfig.data = {};
            nextConfig.data.storageLimit = parsedLimit;

            updateSetting('data.storageLimit', parsedLimit);
            
            const result = await saveSettings(nextConfig);
            if (result && result.success) {
                dispatch({ type: 'SAVE_SUCCESS', message: 'Limit updated' });
                await fetchStorage();
                setTimeout(() => dispatch({ type: 'CLEAR_FEEDBACK' }), 3000);
            } else {
                dispatch({ type: 'SAVE_ERROR', message: result?.error || 'Save failed' });
            }
        } catch (e) {
            console.error("Failed to save storage limit", e);
            dispatch({ type: 'SAVE_ERROR', message: 'Connection Error' });
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
        <div className="bg-app-card/40 border border-app-border rounded-xl p-6 relative overflow-hidden group h-full">
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
                        <label htmlFor="storage-limit-gb" className="text-xs font-bold text-app-dim uppercase tracking-wider">Storage Limit (GB)</label>
                        <div className="flex items-center gap-2">
                            <input 
                                id="storage-limit-gb"
                                type="number" 
                                step="0.1" 
                                min="0.1"
                                value={limit}
                                onChange={(e) => dispatch({ type: 'SET_LIMIT', limit: e.target.value })}
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
