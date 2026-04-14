import { WifiOff, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * ConnectionErrorView component displayed when the backend server is unreachable.
 *
 * @returns {JSX.Element} The rendered connection error view.
 */
export default function ConnectionErrorView() {
  const { refreshAuth } = useAuth();

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-app-card border border-app-border rounded-2xl shadow-2xl p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <WifiOff className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-app-text mb-2">
          Server Unreachable
        </h1>
        <p className="text-app-dim mb-8">
          We&apos;re having trouble connecting to the Azan Dashboard server.
          Please ensure the backend service is running and try again.
        </p>

        <button
          onClick={() => refreshAuth()}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.98]"
        >
          <RefreshCw className="w-5 h-5" />
          Retry Connection
        </button>

        <div className="mt-6 pt-6 border-t border-app-border">
          <p className="text-[10px] text-app-dim uppercase tracking-widest font-bold">
            Azan Dashboard v2 • System Error
          </p>
        </div>
      </div>
    </div>
  );
}
