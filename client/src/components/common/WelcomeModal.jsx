import React, { useRef, useEffect } from 'react';
import { Compass } from 'lucide-react';

/**
 * Introductory modal that offers users the option to start or skip an onboarding tour.
 * @param {object} props
 * @param {Function} props.onStartTour - Called when the user clicks "Start Tour".
 * @param {Function} props.onSkip - Called when the user clicks "Skip Tour".
 * @param {string} [props.title] - Modal heading text.
 * @param {string} [props.description] - Modal body text.
 * @returns {JSX.Element} The rendered welcome modal.
 */
export default function WelcomeModal({ onStartTour, onSkip, title, description }) {
    const startTourRef = useRef(null);
    const skipTourRef = useRef(null);

    useEffect(() => {
        if (startTourRef.current) {
            startTourRef.current.focus();
        }
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === startTourRef.current) {
                    e.preventDefault();
                    skipTourRef.current?.focus();
                }
            } else {
                if (document.activeElement === skipTourRef.current) {
                    e.preventDefault();
                    startTourRef.current?.focus();
                }
            }
        }
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center isolate"
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-modal-title"
            onKeyDown={handleKeyDown}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
            
            {/* Modal */}
            <div className="bg-app-card border border-app-border rounded-xl shadow-2xl w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-500">
                        <Compass className="w-8 h-8" />
                    </div>
                    
                    <div className="space-y-2">
                        <h3 id="welcome-modal-title" className="text-xl font-bold text-app-text">
                            {title || 'Welcome to your Azan Dashboard'}
                        </h3>
                        <p className="text-app-dim text-sm leading-relaxed">
                            {description || 'Take a quick tour to learn about the dashboard controls and features.'}
                        </p>
                    </div>

                    <div className="flex gap-3 w-full pt-4">
                        <button 
                            ref={skipTourRef}
                            onClick={onSkip}
                            className="flex-1 py-2.5 px-4 bg-app-bg text-app-dim font-medium rounded-lg hover:bg-app-card-hover transition-colors"
                        >
                            Skip Tour
                        </button>
                        
                        <button 
                            ref={startTourRef}
                            onClick={onStartTour}
                            className="flex-1 py-2.5 px-4 font-bold rounded-lg text-white transition-all shadow-lg bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
                        >
                            Start Tour
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
