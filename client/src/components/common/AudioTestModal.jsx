import { X, Volume2, Monitor, Radio, AlertCircle, Server } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { useOutputStrategies } from '@/hooks/useOutputStrategies';

/**
 * A modal component that allows users to test audio playback across different
 * output targets, such as the server speaker or connected browsers.
 *
 * @param {object} props - The component props.
 * @param {boolean} props.isOpen - Whether the modal is currently visible.
 * @param {Function} props.onClose - Function to call when closing the modal.
 * @param {object} props.file - The audio file object to be tested.
 * @param {boolean} props.consentGiven - Whether the user has provided consent for playback.
 * @param {Function} props.setConsentGiven - Function to update the consent state.
 * @param {Function} props.onTest - Function to trigger the actual audio test.
 * @returns {JSX.Element|null} The rendered modal or null if not open.
 */
export default function AudioTestModal({ 
    isOpen, 
    onClose, 
    file, 
    consentGiven, 
    setConsentGiven, 
    onTest 
}) {
    const { systemHealth, config } = useSettings();
    const { strategies } = useOutputStrategies({ enabled: isOpen });

    if (!isOpen || !file) return null;

    const targets = strategies.filter(s => !s.hidden || s.id === 'browser').map(strategy => {
        const health = systemHealth[strategy.id];
        const outputConfig = config.automation?.outputs?.[strategy.id];
        
        // Browser is special
        if (strategy.id === 'browser') {
            return {
                id: 'browser',
                label: 'All Dashboards',
                icon: Monitor,
                description: 'Broadcasts to all connected browsers',
                disabled: false
            };
        }

        const isEnabled = outputConfig?.enabled ?? false;
        const isHealthy = health?.healthy ?? false;

        let description = strategy.id === 'local' 
            ? 'Plays on the mosque local audio system' 
            : 'Triggers Alexa/Smart Home devices';
        
        if (!isEnabled) description = 'This output is disabled in settings';
        else if (!isHealthy) description = `Offline: ${health?.message || 'Service unreachable'}`;

        return {
            id: strategy.id,
            label: strategy.label,
            icon: strategy.id === 'local' ? Server : Radio,
            description,
            disabled: !isEnabled || !isHealthy
        };
    });

    const handleBackdropKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClose();
        }
    };

    const modalTitleId = 'audio-test-modal-title';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center isolate" role="dialog" aria-modal="true" aria-labelledby={modalTitleId}>
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
                onKeyDown={handleBackdropKeyDown}
                role="button"
                tabIndex={0}
                aria-label="Close audio test modal"
            />
            
            {/* Modal */}
            <div className="bg-app-card border border-app-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden relative z-10 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-app-border flex justify-between items-center">
                    <h3 id={modalTitleId} className="text-xl font-bold text-app-text">Test Audio Asset</h3>
                    <button 
                        onClick={onClose}
                        className="text-app-dim hover:text-app-text transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* File Info */}
                    <div className="flex items-center gap-3 p-3 bg-app-bg/50 rounded-lg border border-app-border/50">
                        <div className="w-10 h-10 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <Volume2 className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-xs text-app-dim uppercase tracking-wider font-bold">Filename</p>
                            <p className="text-app-text font-medium">{file.name}</p>
                        </div>
                    </div>

                    {/* Warning Box */}
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        <div className="space-y-2">
                             <p className="text-amber-200 text-sm font-semibold">Safety Warning</p>
                             <p className="text-amber-200/70 text-xs leading-relaxed">
                                Playback cannot be stopped once started. Ensure volume levels are safe before triggering audio on local audio systems or external devices.
                             </p>
                             <label className="flex items-center gap-2 cursor-pointer pt-1 group">
                                <div className="relative">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer"
                                        checked={consentGiven}
                                        onChange={(e) => setConsentGiven(e.target.checked)}
                                    />
                                    <div className="w-5 h-5 border-2 border-amber-500/50 rounded flex items-center justify-center peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all">
                                        {consentGiven && <X className="w-3 h-3 text-app-card stroke-[4]" />}
                                    </div>
                                </div>
                                <span className="text-amber-200/90 text-sm font-medium group-hover:text-amber-200 transition-colors select-none">
                                    I understand and acknowledge the risk.
                                </span>
                             </label>
                        </div>
                    </div>

                    {/* Target Selection */}
                    <div className="space-y-3">
                        <p className="text-xs text-app-dim uppercase tracking-wider font-bold px-1">Select Output Target</p>
                        <div className="grid gap-3">
                            {targets.map((target) => (
                                <button
                                    key={target.id}
                                    disabled={!consentGiven || target.disabled}
                                    onClick={() => onTest(target.id)}
                                    className={`
                                        flex items-center gap-4 p-4 rounded-xl border text-left transition-all group
                                        ${!consentGiven || target.disabled 
                                            ? 'bg-app-bg/30 border-app-border/30 opacity-40 cursor-not-allowed' 
                                            : 'bg-app-bg/60 border-app-border hover:bg-emerald-500/5 hover:border-emerald-500/30'
                                        }
                                    `}
                                >
                                    <div className={`
                                        p-3 rounded-lg transition-colors
                                        ${!consentGiven || target.disabled ? 'bg-app-border/30 text-app-dim' : 'bg-app-card text-emerald-500 group-hover:bg-emerald-500/10'}
                                    `}>
                                        <target.icon className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <span className={`block font-bold ${!consentGiven || target.disabled ? 'text-app-dim' : 'text-app-text'}`}>
                                            {target.label}
                                        </span>
                                        <span className="text-xs text-app-dim">
                                            {target.description}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="px-6 py-4 bg-app-bg/30 border-t border-app-border flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 text-app-dim hover:text-app-text font-medium transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
