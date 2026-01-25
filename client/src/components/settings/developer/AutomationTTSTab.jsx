import { useState } from 'react';
import { RefreshCw, LayoutGrid, FileAudio, CheckCircle, XCircle } from 'lucide-react';
import { AutomationStatusCell, TTSStatusCell } from './StatusCells';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

/**
 * A React component that displays the status of the automation timeline and Text-to-Speech (TTS) assets.
 * It allows users to view prayer-related events and refresh diagnostic information.
 *
 * @param {Object} props - The component properties.
 * @param {Object} props.config - The application configuration object.
 * @param {Object} props.systemHealth - The current health status of system services.
 * @param {Object} props.automationStatus - The status of automation events per prayer.
 * @param {Object} props.ttsStatus - The status of TTS assets per prayer.
 * @param {Function} props.fetchDiagnostics - A function to trigger a diagnostic data refresh.
 * @returns {JSX.Element} The rendered automation and TTS status tab.
 */
export default function AutomationTTSTab({ 
    config, 
    systemHealth, 
    automationStatus, 
    ttsStatus, 
    fetchDiagnostics 
}) {
    const [refreshStatus, setRefreshStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'

    /**
     * Handles the diagnostic refresh process.
     * Sets the loading state, invokes the fetch function, and manages the outcome status.
     */
    const handleRefresh = async () => {
        if (refreshStatus !== 'idle') return;
        setRefreshStatus('loading');
        const success = await fetchDiagnostics();
        setRefreshStatus(success ? 'success' : 'error');
        // Reset the status back to idle after a short delay to allow the user to see the result
        setTimeout(() => setRefreshStatus('idle'), 3000);
    };

    const isGlobalDisabled = config?.automation?.global?.enabled === false;
    const isPreAdhanDisabled = config?.automation?.global?.preAdhanEnabled === false;
    const isAdhanDisabled = config?.automation?.global?.adhanEnabled === false;
    const isPreIqamahDisabled = config?.automation?.global?.preIqamahEnabled === false;
    const isIqamahDisabled = config?.automation?.global?.iqamahEnabled === false;

    const refreshButton = (
        <button 
            onClick={handleRefresh}
            disabled={refreshStatus !== 'idle'}
            className={cn(
                "p-1 px-2 rounded-md border transition-all text-xs flex items-center gap-1 shadow-sm",
                refreshStatus === 'idle' && "bg-app-card border-app-border hover:bg-app-card-hover text-app-dim hover:text-app-text",
                refreshStatus === 'loading' && "bg-app-card border-app-border text-app-dim cursor-wait",
                refreshStatus === 'success' && "bg-emerald-500/10 border-emerald-500/50 text-emerald-500",
                refreshStatus === 'error' && "bg-red-500/10 border-red-500/50 text-red-500"
            )}
        >
            {refreshStatus === 'loading' ? <RefreshCw className="w-3 h-3 animate-spin" /> : 
             refreshStatus === 'success' ? <CheckCircle className="w-3 h-3" /> :
             refreshStatus === 'error' ? <XCircle className="w-3 h-3" /> :
             <RefreshCw className="w-3 h-3" />}
            
            {refreshStatus === 'success' ? 'Refreshed' : 
             refreshStatus === 'error' ? 'Failed' : 
             'Refresh'}
        </button>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Automation Section */}
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

                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5 text-blue-500" />
                            Automation Timeline
                        </h3>
                        {refreshButton}
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
                                <th className={cn("px-3 py-2", isPreAdhanDisabled && "opacity-30")}>Pre-Adhan</th>
                                <th className={cn("px-3 py-2", isAdhanDisabled && "opacity-30")}>Adhan</th>
                                <th className={cn("px-3 py-2", isPreIqamahDisabled && "opacity-30")}>Pre-Iqamah</th>
                                <th className={cn("px-3 py-2", isIqamahDisabled && "opacity-30")}>Iqamah</th>
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
                                        {prayer === 'sunrise' ? <EmptyCell /> : <AutomationStatusCell {...events.preIqamah} />}
                                    </td>
                                    <td className={cn("px-2 py-2", isIqamahDisabled && "opacity-20 grayscale pointer-events-none")}>
                                        {prayer === 'sunrise' ? <EmptyCell /> : <AutomationStatusCell {...events.iqamah} />}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TTS Section */}
            <div className={cn(
                "bg-app-card/40 border border-app-border rounded-xl p-6 overflow-hidden transition-opacity",
                !systemHealth.tts?.healthy && "opacity-50 grayscale select-none pointer-events-none"
            )}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
                            <FileAudio className="w-5 h-5 text-purple-500" />
                            TTS Asset Status
                        </h3>
                        {refreshButton}
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
                                        {prayer === 'sunrise' ? <EmptyCell /> : <TTSStatusCell {...events.preIqamah} />}
                                    </td>
                                    <td className="px-2 py-2">
                                        {prayer === 'sunrise' ? <EmptyCell /> : <TTSStatusCell {...events.iqamah} />}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/**
 * A React component that renders a placeholder for an empty cell in the status table.
 * Typically used for prayers where certain events do not apply, such as iqamah for sunrise.
 *
 * @returns {JSX.Element} The rendered empty cell placeholder.
 */
function EmptyCell() {
    return (
        <div className="px-2 py-1 rounded text-xs font-mono border text-center bg-app-card text-app-dim border-app-border h-[26px] flex items-center justify-center">
            <div className="w-6 border-t-2 border-dashed border-app-dim/40" />
        </div>
    );
}
