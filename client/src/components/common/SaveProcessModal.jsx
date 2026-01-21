import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertTriangle, XCircle, ArrowRight, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 *
 * @param {...any} inputs - The class names or objects to merge.
 * @returns {string} The merged class string.
 */
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * A modal component that displays the real-time progress and final outcome of 
 * a server-side saving or data processing operation.
 *
 * @param {object} props - The component props.
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {Function} props.onClose - Function to call when closing the modal.
 * @param {string} props.status - The current status string from the parent.
 * @param {object} props.result - The final result object from the server.
 * @param {object} props.processStatus - The real-time process status updates.
 * @returns {JSX.Element|null} The rendered modal or null if not open.
 */
export default function SaveProcessModal({ isOpen, onClose, status, result, processStatus }) {
  const navigate = useNavigate();
  if (!isOpen) return null;

  // status: 'processing', 'success', 'warning', 'error'
  // derived from result + internal logic if result is null

  let visualState = 'processing';
  if (result) {
    if (result.success) {
      visualState = result.warning ? 'warning' : 'success';
    } else {
      visualState = 'error';
    }
  }

  const isProcessing = visualState === 'processing';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className={cn(
        "relative bg-app-card border text-center rounded-2xl shadow-2xl p-8 max-w-md w-full flex flex-col items-center transition-all duration-300 transform scale-100",
        visualState === 'processing' ? "border-blue-500/30" : 
        visualState === 'success' ? "border-emerald-500/50" :
        visualState === 'warning' ? "border-amber-500/50" :
        "border-red-500/50"
      )}>
        
        {/* Icon Area */}
        <div className="mb-6 relative">
            <div className={cn(
                "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
                visualState === 'processing' ? "bg-blue-500/10" :
                visualState === 'success' ? "bg-emerald-500/10" :
                visualState === 'warning' ? "bg-amber-500/10" :
                "bg-red-500/10"
            )}>
                {visualState === 'processing' && <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />}
                {visualState === 'success' && <CheckCircle className="w-10 h-10 text-emerald-500 animate-in zoom-in spin-in-12" />}
                {visualState === 'warning' && <AlertTriangle className="w-10 h-10 text-amber-500 animate-in zoom-in" />}
                {visualState === 'error' && <XCircle className="w-10 h-10 text-red-500 animate-in zoom-in" />}
            </div>
            
            {/* Ping animation behind icon for processing */}
            {visualState === 'processing' && (
                <div className="absolute inset-0 rounded-full border border-blue-500/50 animate-ping opacity-20"></div>
            )}
        </div>

        {/* Status Text - Large */}
        <h2 className={cn(
            "text-xl font-bold mb-2 transition-colors",
            visualState === 'processing' ? "text-blue-100" :
            visualState === 'success' ? "text-emerald-100" :
            visualState === 'warning' ? "text-amber-100" :
            "text-red-100"
        )}>
            {visualState === 'processing' ? (processStatus || "Saving Configuration...") :
             visualState === 'success' ? "Configuration Saved" :
             visualState === 'warning' ? "Saved with Warnings" :
             "Configuration Not Saved"}
        </h2>

        {visualState === 'warning' && (
            <p className="text-app-dim text-sm mb-4 px-4">
                The configuration was saved, but some issues were detected (e.g. offline services or storage limits).
            </p>
        )}

        {/* Subtext (Processing) */}
        {visualState === 'processing' && (
            <p className="text-app-dim text-sm animate-pulse">
                {processStatus ? "This process involves generating audio files and may take a moment." : "Please wait while we update the system..."}
            </p>
        )}

        {/* Details / Warnings / Errors List */}
        {!isProcessing && result && (
            <div className="w-full mt-6 animate-in fade-in slide-in-from-bottom-2">
                {(result.warning || result.error) && (
                     <div className={cn(
                         "text-left rounded-lg p-4 text-sm max-h-40 overflow-y-auto border",
                         visualState === 'warning' ? "bg-amber-500/10 border-amber-500/20 text-amber-200" :
                         "bg-red-500/10 border-red-500/20 text-red-200"
                     )}>
                         <p className="font-semibold mb-2 flex items-center gap-2">
                             {visualState === 'warning' ? 'System Warnings:' : 'Validation Errors:'}
                         </p>
                         <ul className="space-y-1 list-disc list-inside opacity-90">
                             {/* Handle both warningsList (array) and plain string error */}
                             {result.warningsList && result.warningsList.length > 0 ? (
                                 result.warningsList.map((msg, i) => <li key={i}>{msg}</li>)
                             ) : (
                                 <li>{result.error || result.warning || 'Unknown Issue'}</li>
                             )}
                         </ul>
                     </div>
                )}
                
                {visualState === 'success' && !result.warning && (
                    <p className="text-app-dim text-sm">
                        System updated successfully. All cache generated.
                    </p>
                )}
            </div>
        )}

        {/* Actions */}
        {!isProcessing && (
            <div className="mt-8 flex flex-col w-full gap-2 animate-in fade-in fill-mode-forwards delay-100">
                {visualState === 'warning' && (
                     <button 
                        onClick={() => { onClose(); navigate('/settings/developer'); }}
                        className="w-full bg-app-card hover:bg-app-card-hover text-app-dim py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                     >
                        <ExternalLink className="w-4 h-4" />
                        Go to System Health
                     </button>
                )}
                
                <button
                    onClick={onClose}
                    className={cn(
                        "w-full py-2.5 rounded-lg text-sm font-bold transition-all shadow-lg flex items-center justify-center gap-2",
                        visualState === 'success' ? "bg-emerald-600 hover:bg-emerald-500 text-app-text shadow-emerald-900/20" :
                        visualState === 'warning' ? "bg-amber-600 hover:bg-amber-500 text-black shadow-amber-900/20" :
                        "bg-app-card hover:bg-app-card-hover text-app-text"
                    )}
                >
                    {visualState === 'success' ? 'Great, Close' : 'Close'}
                    <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        )}
      </div>
    </div>
  );
}
