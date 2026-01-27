import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Loader2, Play, Power, AlertTriangle } from 'lucide-react';
import PasswordInput from '@/components/common/PasswordInput';
import axios from 'axios';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

const Toggle = ({ checked, onChange }) => (
    <button 
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-app-card border-transparent",
            checked ? "bg-emerald-600" : "bg-app-card-hover"
        )}
    >
        <span
            className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out",
                checked ? "translate-x-6" : "translate-x-1"
            )}
        />
    </button>
);

export default function OutputStrategyCard({ strategy, config, onChange, systemHealth }) {
    const [testing, setTesting] = useState(false);
    const [status, setStatus] = useState('idle'); // idle, testing, online, offline
    const [errorMsg, setErrorMsg] = useState(null);

    const { id, label, params, hidden } = strategy;

    useEffect(() => {
        if (systemHealth && systemHealth[id]) {
            const health = systemHealth[id];
            if (health.healthy) {
                setStatus('online');
                setErrorMsg(null);
            } else {
                setStatus('offline');
                setErrorMsg(health.message || 'Unknown error');
            }
        }
    }, [systemHealth, id]);

    if (hidden) return null;

    const values = config?.params || {};
    const enabled = config?.enabled ?? false;
    const leadTimeMs = config?.leadTimeMs ?? strategy.defaultLeadTimeMs ?? 0;

    const handleParamChange = (key, value) => {
        onChange('params', { ...values, [key]: value });
        setStatus('idle'); // Reset status on change
    };

    const handleTest = async () => {
        setTesting(true);
        setStatus('testing');
        setErrorMsg(null);
        
        try {
            // Using refreshHealth endpoint to trigger health check for specific target
            // Pass current values to allow testing unsaved changes
            const res = await axios.post('/api/system/health/refresh', { 
                target: id,
                params: values
            });
            
            const healthData = res.data[id];
            
            if (healthData && healthData.healthy) {
                setStatus('online');
            } else {
                setStatus('offline');
                setErrorMsg(healthData?.message || 'Unknown error');
            }
        } catch (e) {
            setStatus('offline');
            setErrorMsg(e.response?.data?.error || e.message);
        } finally {
            setTesting(false);
        }
    };

    return (
        <div className="bg-app-card p-6 rounded-lg border border-app-border shadow-md">
            <div className="flex items-center justify-between mb-4 border-b border-app-border pb-4">
                <div>
                    <h3 className="text-lg font-semibold text-app-text">{label}</h3>
                    <div className="text-xs text-app-dim mt-1">ID: {id}</div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={cn("text-sm font-medium", enabled ? "text-emerald-400" : "text-app-dim")}>
                        {enabled ? 'Active' : 'Inactive'}
                    </span>
                    <Toggle checked={enabled} onChange={v => onChange('enabled', v)} />
                </div>
            </div>
            
            <div className="space-y-5">
                {/* Lead Time Config */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-app-text mb-1">Lead Time (ms)</label>
                        <div className="text-xs text-app-dim mb-2">Advance triggering offset.</div>
                        <input 
                            type="number"
                            min={strategy.leadTimeConstraints?.min || 0}
                            max={strategy.leadTimeConstraints?.max || 300000}
                            value={leadTimeMs}
                            onChange={e => onChange('leadTimeMs', parseInt(e.target.value) || 0)}
                            className="w-full bg-app-bg border border-app-border rounded p-2 text-app-text focus:ring-emerald-500 focus:border-emerald-500"
                        />
                     </div>
                </div>

                {/* Strategy Params - Non-Sensitive Only */}
                {params.filter(p => !p.sensitive).length > 0 && (
                    <div className="space-y-4 pt-2">
                        {params.filter(p => !p.sensitive).map(param => (
                            <div key={param.key}>
                                <label className="block text-sm font-medium text-app-text mb-1">
                                    {param.label}
                                    {param.requiredForHealth && <span className="text-red-400 ml-1">*</span>}
                                </label>
                                <input 
                                    type="text"
                                    value={values[param.key] || param.default || ''}
                                    onChange={e => handleParamChange(param.key, e.target.value)}
                                    className="w-full bg-app-bg border border-app-border rounded p-2 text-app-text focus:ring-emerald-500 focus:border-emerald-500 mb-1"
                                />
                                {param.subtext && (
                                    <div className="text-xs text-app-dim italic ml-1">
                                        {param.subtext}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div className="pt-4 flex flex-wrap gap-3 items-center border-t border-app-border">
                    <div className="relative group">
                        <button 
                            onClick={handleTest} 
                            disabled={testing} // Let users re-try even if offline, unless actively testing
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded transition-colors text-sm font-medium disabled:opacity-50 min-w-[140px] justify-center",
                                status === 'testing' ? "bg-amber-600/20 text-amber-400 border border-amber-600/50" :
                                status === 'online' ? "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-600/50" :
                                status === 'offline' ? "bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-600/50" :
                                "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
                            )}
                        >
                            {status === 'testing' ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Testing</>
                            ) : status === 'online' ? (
                                <><CheckCircle className="w-4 h-4" /> Online</>
                            ) : status === 'offline' ? (
                                <><XCircle className="w-4 h-4" /> Offline</>
                            ) : (
                                <><Play className="w-4 h-4" /> Check Health</>
                            )}
                        </button>
                        
                        {/* Error Tooltip */}
                        {status === 'offline' && errorMsg && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[250px] px-3 py-2 bg-gray-900 text-white text-xs rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-gray-700">
                                <div className="font-semibold text-red-400 mb-0.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Connection Error
                                </div>
                                {errorMsg}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 border-b border-r border-gray-700 rotate-45"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
