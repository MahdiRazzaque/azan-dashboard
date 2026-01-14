import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', isDestructive = false }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center isolate">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200">
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-full ${isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="text-xl font-bold text-white">{title}</h3>
                        <p className="text-zinc-400 text-sm leading-relaxed">
                            {message}
                        </p>
                    </div>

                    <div className="flex gap-3 w-full pt-4">
                        <button 
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 bg-zinc-800 text-zinc-300 font-medium rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => { onConfirm(); onClose(); }}
                            className={`flex-1 py-2.5 px-4 font-bold rounded-lg text-white transition-all shadow-lg ${
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
