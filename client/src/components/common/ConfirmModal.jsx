import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

/**
 * A standardised confirmation modal component used for destructive actions or important decisions.
 *
 * @param {object} props - The component props.
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {Function} props.onClose - Function to call when closing the modal (e.g., via backdrop click).
 * @param {Function} props.onConfirm - Function to call when the primary action is confirmed.
 * @param {Function} props.onCancel - Function to call when the action is cancelled.
 * @param {Function} [props.onRetry] - Optional function to call for retrying an operation.
 * @param {string} [props.retryText] - The label for the retry button.
 * @param {string} props.title - The title text for the modal.
 * @param {string} props.message - The informative message displayed in the modal body.
 * @param {string} [props.confirmText='Confirm'] - The label for the confirmation button.
 * @param {string} [props.cancelText='Cancel'] - The label for the cancellation button.
 * @param {boolean} [props.isDestructive=false] - Whether the action is destructive (e.g., delete), affecting styling.
 * @returns {JSX.Element|null} The rendered modal or null if not open.
 */
export default function ConfirmModal({ isOpen, onClose, onConfirm, onCancel, onRetry, retryText, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDestructive = false }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center isolate">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="bg-app-card border border-app-border rounded-xl shadow-2xl w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-app-dim hover:text-app-text transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-full ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-app-text">{title}</h3>
                        <p className="text-app-dim text-sm leading-relaxed">
                            {message}
                        </p>
                    </div>

                    <div className="flex gap-3 w-full pt-4">
                        <button 
                            onClick={onCancel || onClose}
                            className="flex-1 py-2.5 px-4 bg-app-bg text-app-dim font-medium rounded-lg hover:bg-app-card-hover transition-colors"
                        >
                            {cancelText}
                        </button>
                        
                        {/* Retry Button */}
                        {onRetry && (
                            <button 
                                onClick={onRetry}
                                className="flex-1 py-2.5 px-4 bg-app-bg text-app-dim font-medium rounded-lg hover:bg-app-card-hover transition-colors border border-app-border"
                            >
                                {retryText || 'Retry'}
                            </button>
                        )}

                        <button 
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`flex-1 py-2.5 px-4 font-bold rounded-lg text-app-text transition-all shadow-lg ${
                                isDestructive 
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-900/20' 
                                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'
                            }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
