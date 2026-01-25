import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => twMerge(clsx(inputs));

export const AutomationStatusCell = ({ status, time, details }) => {
    let color = 'bg-app-card text-app-dim border-app-border'; // Disabled/Unknown
    let label = status;
    let title = status;

    if (status === 'PASSED') {
        color = 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50';
        label = time ? new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Done';
    } else if (status === 'UPCOMING') {
        color = 'bg-blue-900/30 text-blue-400 border-blue-800/50';
        label = time ? new Date(time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Pending';
    }

    if (details) {
        title = `Type: ${details.type}\nSource: ${details.source}\nTargets: ${details.targets}`;
    }

    return (
        <div 
            className={cn(
                "px-2 py-1 rounded text-xs font-mono border text-center whitespace-nowrap overflow-hidden text-ellipsis",
                color
            )}
            title={title}
        >
            {label}
        </div>
    );
};

export const TTSStatusCell = ({ status, detail }) => {
    let color = 'bg-app-card text-app-dim border-app-border'; // Disabled/Unknown
    let label = status;
    let title = detail || status;

    if (status === 'GENERATED') {
        color = 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50';
        label = 'Ready';
        if (detail) title = `Generated: ${new Date(detail).toLocaleString()}`;
    } else if (status === 'MISMATCH') {
        color = 'bg-amber-900/30 text-amber-400 border-amber-800/50';
        label = 'Mismatch';
        title = 'Template changed - Regeneration Required';
    } else if (status === 'MISSING' || status === 'ERROR') {
         color = 'bg-red-900/30 text-red-400 border-red-800/50';
    } else if (status === 'CUSTOM_FILE' || status === 'URL') {
         color = 'bg-indigo-900/30 text-indigo-400 border-indigo-800/50';
         label = status === 'URL' ? 'URL' : 'File';
    }

    return (
        <div 
            className={cn(
                "px-2 py-1 rounded text-xs font-mono border text-center whitespace-nowrap overflow-hidden text-ellipsis",
                color
            )}
            title={title}
        >
            {label}
        </div>
    );
};
