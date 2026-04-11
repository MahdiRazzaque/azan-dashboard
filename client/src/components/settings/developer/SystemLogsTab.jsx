/**
 * A React component that displays live system logs in a scrollable, terminal-style view.
 * Logs are colour-coded based on their severity level and ordered by timestamp.
 *
 * @param {Object} props - The component properties.
 * @param {Array} props.logs - An array of log objects to display.
 * @returns {JSX.Element} The rendered system logs tab.
 */
export default function SystemLogsTab({ logs }) {
    return (
        <div className="bg-app-bg border border-app-border rounded-xl overflow-hidden font-mono text-sm shadow-xl animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-4 py-3 bg-app-card border-b border-app-border">
                 <span className="text-app-dim text-xs font-bold uppercase tracking-wider">Live System Logs</span>
                 <div className="flex gap-2">
                     <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                     <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                     <span className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50" />
                 </div>
            </div>
            <div className="h-[500px] overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-app-border scrollbar-track-transparent">
                {logs && logs.length > 0 ? [...logs].reverse().map((log) => (
                    <div key={`${log.timestamp}-${log.level}-${log.message}`} className="flex gap-3 text-app-text hover:bg-app-card-hover px-2 py-1 rounded -mx-2 group">
                        <span className="text-app-dim/60 shrink-0 select-none text-[10px] mt-1 group-hover:text-app-dim transition-colors">
                            {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`text-[10px] font-bold mt-1 w-12 text-center rounded border h-fit py-0.5 shrink-0 ${
                            log.level === 'ERROR' ? 'text-red-400 bg-red-400/10 border-red-400/20' : 
                            log.level === 'WARN' ? 'text-amber-400 bg-amber-400/10 border-amber-400/20' : 
                            'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                        }`}>
                            {log.level}
                        </span>
                        <span className="break-all leading-relaxed">{log.message}</span>
                    </div>
                )) : (
                    <div className="text-app-dim italic text-xs p-2 text-center h-full flex items-center justify-center">
                        No logs received yet...
                    </div>
                )}
            </div>
        </div>
    );
}
