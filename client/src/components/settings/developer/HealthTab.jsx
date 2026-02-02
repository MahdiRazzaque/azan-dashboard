import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle, XCircle, ShieldAlert, Circle, Lock } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge tailwind classes.
 * 
 * @param {...any} inputs - Class names or objects.
 * @returns {string} Merged class names.
 */
function cn(...inputs) { return twMerge(clsx(inputs)); }

/**
 * A React component that provides a dedicated Health monitoring dashboard.
 * Displays real-time status of system services, prayer sources, and outputs
 * with controls for automated daily checks and manual refreshes.
 *
 * @param {Object} props - The component properties.
 * @param {Object} props.config - The application configuration object.
 * @param {Object} props.systemHealth - The current health status of system services.
 * @param {Function} props.refreshHealth - Callback to trigger a manual refresh.
 * @returns {JSX.Element} The rendered health tab.
 */
export default function HealthTab({ config, systemHealth, refreshHealth, refresh }) {
    const [outputs, setOutputs] = useState([]);
    const [refreshing, setRefreshing] = useState(null);
    const [feedback, setFeedback] = useState({});

    useEffect(() => {
        // Fetch output registry to dynamically build Output section
        fetch('/api/system/outputs/registry')
            .then(res => res.json())
            .then(data => setOutputs(data))
            .catch(err => console.error("Failed to fetch output registry", err));
    }, []);

    /**
     * Toggles automated health monitoring for a specific service.
     * 
     * @param {string} serviceId - The unique identifier of the service.
     * @param {boolean} enabled - Whether monitoring should be enabled.
     */
    const handleToggle = async (serviceId, enabled) => {
        try {
            const res = await fetch('/api/system/health/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceId, enabled })
            });
            if (res.ok) {
                // Re-fetch config to update healthChecks in the UI
                if (refresh) await refresh();
            }
        } catch (e) {
            console.error("[HealthTab] Toggle failed", e);
        }
    };

    /**
     * Forces a fresh network-based health check for a specific target.
     * 
     * @param {string} target - The service or strategy ID to refresh.
     */
    const handleForceRefresh = async (target) => {
        setRefreshing(target);
        try {
            const res = await fetch('/api/system/health/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target })
            });
            
            if (res.ok) {
                setFeedback(prev => ({ ...prev, [target]: 'Refreshed' }));
                // Trigger context refresh to update UI with NEW health data
                await refreshHealth(target);
            } else {
                setFeedback(prev => ({ ...prev, [target]: 'Failed' }));
            }
        } catch (e) {
            setFeedback(prev => ({ ...prev, [target]: 'Network Error' }));
        } finally {
            setRefreshing(null);
            setTimeout(() => setFeedback(prev => ({ ...prev, [target]: null })), 3000);
        }
    };

    if (!config) return null;

    const healthChecks = config.system?.healthChecks || {};

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* System Section */}
            <HealthCard 
                title="System Services" 
                icon={<Activity className="w-5 h-5 text-blue-500" />}
            >
                <HealthRow 
                    id="api"
                    label="API Server" 
                    status="online" // API is always online if we can see this
                    lastChecked={systemHealth.lastChecked}
                    canToggle={true}
                    enabled={healthChecks.api === true}
                    onToggle={(val) => handleToggle('api', val)}
                    onRefresh={() => handleForceRefresh('api')}
                    refreshing={refreshing === 'api'}
                    feedback={feedback.api}
                    systemHealth={systemHealth}
                />
                <HealthRow 
                    id="tts"
                    label="TTS Service" 
                    status={systemHealth.tts?.healthy ? 'online' : 'offline'}
                    lastChecked={systemHealth.lastChecked}
                    canToggle={true}
                    enabled={healthChecks.tts === true}
                    onToggle={(val) => handleToggle('tts', val)}
                    onRefresh={() => handleForceRefresh('tts')}
                    refreshing={refreshing === 'tts'}
                    feedback={feedback.tts}
                    systemHealth={systemHealth}
                />
            </HealthCard>

            {/* Prayer Sources Section */}
            <HealthCard 
                title="Prayer Sources" 
                icon={<Activity className="w-5 h-5 text-emerald-500" />}
            >
                <HealthRow 
                    id="primarySource"
                    label={`Primary: ${config.sources.primary?.type || 'Not Set'}`}
                    status={systemHealth.primarySource?.healthy ? 'online' : 'offline'}
                    lastChecked={systemHealth.lastChecked}
                    enabled={healthChecks.primarySource === true}
                    onToggle={(val) => handleToggle('primarySource', val)}
                    onRefresh={() => handleForceRefresh('primarySource')}
                    refreshing={refreshing === 'primarySource'}
                    feedback={feedback.primarySource}
                    systemHealth={systemHealth}
                />
                {config.sources.backup && (
                    <HealthRow 
                        id="backupSource"
                        label={`Backup: ${config.sources.backup?.type}`}
                        status={config.sources.backup.enabled === false ? 'disabled' : (systemHealth.backupSource?.healthy ? 'online' : 'offline')}
                        lastChecked={systemHealth.lastChecked}
                        enabled={healthChecks.backupSource === true}
                        onToggle={(val) => handleToggle('backupSource', val)}
                        onRefresh={() => handleForceRefresh('backupSource')}
                        refreshing={refreshing === 'backupSource'}
                        feedback={feedback.backupSource}
                        systemHealth={systemHealth}
                    />
                )}
            </HealthCard>

            {/* Outputs Section */}
            <HealthCard 
                title="Audio Outputs" 
                icon={<Activity className="w-5 h-5 text-purple-500" />}
            >
                {outputs.filter(o => !o.hidden).map(output => (
                    <HealthRow 
                        key={output.id}
                        id={output.id}
                        label={output.label}
                        status={config.automation?.outputs?.[output.id]?.enabled === false ? 'disabled' : (systemHealth[output.id]?.healthy ? 'online' : 'offline')}
                        lastChecked={systemHealth.lastChecked}
                        enabled={healthChecks[output.id] === true}
                        onToggle={(val) => handleToggle(output.id, val)}
                        onRefresh={() => handleForceRefresh(output.id)}
                        refreshing={refreshing === output.id}
                        feedback={feedback[output.id]}
                        systemHealth={systemHealth}
                    />
                ))}
                {outputs.length === 0 && (
                    <div className="py-8 text-center text-app-dim text-sm italic">
                        Loading registered output strategies...
                    </div>
                )}
            </HealthCard>
        </div>
    );
}

/**
 * A card container for health items.
 */
function HealthCard({ title, icon, children }) {
    return (
        <div className="bg-app-card/40 border border-app-border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-app-text mb-4 flex items-center gap-2">
                {icon} {title}
            </h3>
            <div className="space-y-3">
                {children}
            </div>
        </div>
    );
}

/**
 * A single row in the health dashboard representing one service.
 */
function HealthRow({ label, status, lastChecked, enabled, canToggle = true, onToggle, onRefresh, refreshing, feedback, id, systemHealth }) {
    const isMonitored = enabled && status !== 'disabled';
    
    // Detect configuration warnings vs true offline status
    const message = systemHealth?.[id]?.message || '';
    const configWarnings = ['Token Missing', 'No API Key', 'HTTPS Base URL required', 'Not Configured'];
    const isConfigIssue = message && configWarnings.some(w => message.includes(w));
    const displayStatus = isConfigIssue ? 'config-warning' : (isMonitored ? status : (status === 'disabled' ? 'disabled' : 'not-monitored'));
    
    return (
        <div className="flex items-center justify-between p-3 bg-app-card rounded border border-app-border">
            <div className="flex items-center gap-4">
                <StatusIndicator status={displayStatus} />
                <div>
                    <div className="font-medium text-app-text">{label}</div>
                    <div className="text-xs text-app-dim">
                        {status === 'disabled' ? 'Output Strategy Disabled' : (isMonitored ? (isConfigIssue ? message : (status === 'online' ? 'Healthy / Online' : 'Unreachable / Offline')) : 'Automated Monitoring Disabled')}
                        {lastChecked && isMonitored && ` • Last Checked: ${new Date(lastChecked).toLocaleTimeString()}`}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {feedback && <span className="text-[10px] font-bold text-emerald-500 animate-pulse">{feedback}</span>}
                
                {canToggle ? (
                    <div className="flex items-center gap-2 px-2 border-r border-app-border/50">
                        <span className="text-[10px] font-bold uppercase text-app-dim">Daily Check</span>
                        <Toggle checked={enabled} onChange={onToggle} />
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-app-dim opacity-50 px-2 border-r border-app-border/50">
                        <Lock className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase">Fixed</span>
                    </div>
                )}
                
                <button 
                    onClick={onRefresh}
                    disabled={refreshing}
                    title="Force Refresh Health"
                    className={cn("p-1.5 hover:bg-app-card-hover rounded text-app-dim transition-colors", refreshing && "text-emerald-500")}
                >
                    <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                </button>
            </div>
        </div>
    );
}

/**
 * Visual indicator for service status.
 */
function StatusIndicator({ status }) {
    switch (status) {
        case 'online': return <CheckCircle className="w-5 h-5 text-emerald-500" />;
        case 'offline': return <XCircle className="w-5 h-5 text-red-500" />;
        case 'config-warning': return <ShieldAlert className="w-5 h-5 text-amber-500" />;
        case 'disabled': return <ShieldAlert className="w-5 h-5 text-amber-500 opacity-50" />;
        case 'not-monitored':
        default: return <Circle className="w-5 h-5 text-app-dim" />;
    }
}

/**
 * A reusable toggle switch component.
 */
function Toggle({ checked, onChange }) {
    return (
        <button 
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none border-transparent",
                checked ? "bg-emerald-600" : "bg-app-border"
            )}
        >
            <span
                className={cn(
                    "inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out",
                    checked ? "translate-x-5" : "translate-x-1"
                )}
            />
        </button>
    );
}
