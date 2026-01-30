import { useState, useEffect } from 'react';
import { Activity, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

/**
 * A React component that allows users to configure the external base URL for the application.
 * This URL is essential for services like VoiceMonkey and remote access, requiring a valid HTTPS address.
 *
 * @returns {JSX.Element} The rendered network configuration card.
 */
export default function NetworkConfigCard() {
    const { config, updateEnvSetting, refreshHealth } = useSettings();
    const [baseUrl, setBaseUrl] = useState(config?.automation?.baseUrl || '');
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    useEffect(() => {
        if (config?.automation?.baseUrl !== undefined) {
            setBaseUrl(config.automation.baseUrl);
        }
    }, [config?.automation?.baseUrl]);

    const isValid = baseUrl.startsWith('https://');

    const handleSave = async () => {
        if (!isValid) return;
        setSaving(true);
        setFeedback(null);
        
        try {
            const result = await updateEnvSetting('BASE_URL', baseUrl);
            if (result.success) {
                setFeedback({ type: 'success', message: 'Saved' });
                await refreshHealth('voiceMonkey');
                setTimeout(() => setFeedback(null), 3000);
            } else {
                setFeedback({ type: 'error', message: result.error || 'Failed' });
            }
        } catch (e) {
            setFeedback({ type: 'error', message: 'Save failed' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-app-card/40 border border-app-border rounded-xl p-6 relative overflow-hidden group h-full">
            <div className="flex items-center justify-between mb-6 relative z-10">
                <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-500" /> Network Configuration
                </h3>
            </div>

            <div className="space-y-4 relative z-10">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-app-dim uppercase tracking-wider flex justify-between">
                        <span>External Base URL</span>
                        {baseUrl && (
                            isValid ? 
                            <span className="text-emerald-500 flex items-center gap-1 normal-case font-normal"><CheckCircle className="w-3 h-3" /> Valid HTTPS</span> :
                            <span className="text-red-400 flex items-center gap-1 normal-case font-normal"><XCircle className="w-3 h-3" /> HTTPS Required</span>
                        )}
                    </label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://your-domain.com"
                            className={cn(
                                "flex-1 bg-app-bg border rounded-lg px-3 py-2 text-app-text text-sm focus:outline-none transition-all font-medium",
                                baseUrl && !isValid ? "border-red-500/50 focus:ring-1 focus:ring-red-500/50" : "border-app-border focus:ring-1 focus:ring-blue-500/50"
                            )}
                        />
                        <button 
                            onClick={handleSave}
                            disabled={saving || !isValid || baseUrl === config?.automation?.baseUrl}
                            className="bg-blue-600 hover:bg-blue-500 text-white p-2 px-4 rounded-lg disabled:opacity-50 transition-all font-bold text-sm flex items-center gap-2"
                        >
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
                        </button>
                    </div>
                    {feedback && (
                        <p className={cn(
                            "text-[10px] font-bold uppercase",
                            feedback.type === 'success' ? "text-emerald-500" : "text-red-500"
                        )}>
                            {feedback.message}
                        </p>
                    )}
                </div>

                <div className="p-3 bg-blue-900/10 rounded-lg border border-blue-800/20 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-app-dim leading-relaxed">
                        Required for <span className="text-app-text font-medium">VoiceMonkey</span> and <span className="text-app-text font-medium">Remote Access</span>. 
                        Must be a publicly accessible HTTPS URL pointing to this dashboard.
                    </div>
                </div>
            </div>
        </div>
    );
}
