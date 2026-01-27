import React, { useState } from 'react';
import { X, Volume2, AlertCircle } from 'lucide-react';

/**
 * A modal that requests user consent before triggering a test audio playback.
 * Includes a "don't ask again" option that persists for the current session.
 *
 * @param {object} props - The component props.
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {Function} props.onClose - Function to call when closing the modal.
 * @param {Function} props.onConfirm - Function to call when the user confirms and triggers the test.
 * @param {string} props.strategyLabel - The label of the output strategy being tested.
 * @returns {JSX.Element|null} The rendered modal or null if not open.
 */
export default function AudioConsentModal({ isOpen, onClose, onConfirm, strategyLabel }) {
    const [dontAskAgain, setDontAskAgain] = useState(false);

    if (!isOpen) return null;

    const handleConfirm = () => {
        onConfirm(dontAskAgain);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center isolate">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="bg-app-card border border-app-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative z-10 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-app-border flex justify-between items-center bg-app-bg/30">
                    <h3 className="text-lg font-bold text-app-text">Confirm Audio Test</h3>
                    <button 
                        onClick={onClose}
                        className="text-app-dim hover:text-app-text transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                            <Volume2 className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-app-text font-medium">Trigger Test Sound</p>
                            <p className="text-sm text-app-dim">The output device <strong>{strategyLabel}</strong> will announce "Test".</p>
                        </div>
                    </div>

                    {/* Warning Box */}
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                        <p className="text-amber-200/90 text-xs leading-relaxed">
                            Ensure volume levels are safe. Playback cannot be stopped once it has been triggered.
                        </p>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-app-bg/50 transition-colors">
                        <div className="relative">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={dontAskAgain}
                                onChange={(e) => setDontAskAgain(e.target.checked)}
                            />
                            <div className="w-5 h-5 border-2 border-app-border rounded flex items-center justify-center peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all">
                                {dontAskAgain && <X className="w-3.5 h-3.5 text-white stroke-[3]" />}
                            </div>
                        </div>
                        <span className="text-app-text text-sm select-none">
                            Don't ask me again for this session
                        </span>
                    </label>
                </div>

                <div className="px-6 py-4 bg-app-bg/30 border-t border-app-border flex gap-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-2 px-4 bg-app-bg text-app-dim font-medium rounded-lg hover:bg-app-card-hover transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleConfirm}
                        className="flex-1 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                    >
                        Test Now
                    </button>
                </div>
            </div>
        </div>
    );
}
