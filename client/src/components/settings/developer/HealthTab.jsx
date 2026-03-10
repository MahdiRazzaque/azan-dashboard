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
 * A React component that provides a dedicated health monitoring dashboard.
 * Displays real-time status of system services, prayer sources, and outputs
 * with controls for automated daily checks and manual refreshes.
 *
 * @param {Object} props - The component properties.
 * @param {Object} props.config - The application configuration object.
 * @param {Object} props.systemHealth - The current health status of system services.
 * @param {Function} props.refreshHealth - Callback to trigger a manual refresh.
 * @param {Function} props.refresh - Callback to refresh current configuration.
 * @returns {JSX.Element} The rendered health tab.
 */
export default function HealthTab({ config, systemHealth, refreshHealth, refresh }) {
    const [systemServices, setSystemServices] = useState([]);
    const [outputs, setOutputs] = useState([]);
    const [refreshing, setRefreshing] = useState(null);
    const [feedback, setFeedback] = useState({});

    useEffect(() => {
        // Fetch system services registry to dynamically build System section
        fetch('/api/system/services/registry')
            .then(res => res.json())
            .then(data => setSystemServices(data))
            .catch(err => {
                console.error("Failed to fetch system services registry", err);
                // Fallback to hardcoded list if registry unavailable
                setSystemServices([
                    { id: 'api', label: 'API Server' },
                    { id: 'tts', label: 'TTS Service' }
                ]);
            });

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
                // Trigger context refresh to update UI with backend health data
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
                {systemServices.map(service => (
                    <HealthRow 
                        key={service.id}
                        id={service.id}
                        label={service.label}
                        status={service.id === 'api' ? 'online' : (systemHealth[service.id]?.healthy ? 'online' : 'offline')}
                        lastChecked={systemHealth[service.id]?.lastChecked}
                        canToggle={true}
                        enabled={healthChecks[service.id] === true}
                        onToggle={(val) => handleToggle(service.id, val)}
                        onRefresh={() => handleForceRefresh(service.id)}
                        refreshing={refreshing === service.id}
                        feedback={feedback[service.id]}
                        systemHealth={systemHealth}
                    />
                ))}
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
                    lastChecked={systemHealth.primarySource?.lastChecked}
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
                        lastChecked={systemHealth.backupSource?.lastChecked}
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
                        lastChecked={systemHealth[output.id]?.lastChecked}
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
 * 
 * @param {Object} props - The component properties.
 * @param {string} props.title - The title of the card.
 * @param {JSX.Element} props.icon - The icon to display alongside the title.
 * @param {React.ReactNode} props.children - The child components to render within the card.
 * @returns {JSX.Element} The rendered health card.
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
 * 
 * @param {Object} props - The component properties.
 * @param {string} props.label - The display name of the service.
 * @param {string} props.status - The current operational status (e.g., 'online', 'offline').
 * @param {string|null} props.lastChecked - ISO timestamp of this service's last health check, or null if never checked.
 * @param {boolean} props.enabled - Whether automated monitoring is active for this row.
 * @param {boolean} [props.canToggle=true] - Whether the user can enable/disable monitoring.
 * @param {Function} props.onToggle - Callback when the toggle switch is flipped.
 * @param {Function} props.onRefresh - Callback when the manual refresh button is clicked.
 * @param {boolean} props.refreshing - Whether a background refresh is currently in progress.
 * @param {string} props.feedback - Transient message to display after an action.
 * @param {string} props.id - Unique identifier for the service.
 * @param {Object} props.systemHealth - The full system health state object.
 * @returns {JSX.Element} The rendered health row.
 */
function HealthRow({ label, status, lastChecked, enabled, canToggle = true, onToggle, onRefresh, refreshing, feedback, id, systemHealth }) {
    const isMonitored = enabled && status !== 'disabled';
    
    // Get health data from systemHealth (persisted in backend cache)
    const healthData = systemHealth?.[id];
    const message = healthData?.message || '';
    
    // Detect if a health check has been performed (not just initialised or monitoring disabled)
    const uncheckedMessages = ['Initialising...', 'Monitoring Disabled'];
    const hasBeenChecked = healthData && !uncheckedMessages.includes(message);
    
    // Detect configuration warnings vs true offline status
    const configWarnings = ['Token Missing', 'No API Key', 'HTTPS Base URL required', 'Not Configured'];
    const isConfigIssue = message && configWarnings.some(w => message.includes(w));
    
    // Determine the display status - use actual health data if checked
    let displayStatus;
    if (status === 'disabled') {
        displayStatus = 'disabled';
    } else if (hasBeenChecked) {
        // A health check has been performed - show actual result
        displayStatus = isConfigIssue ? 'config-warning' : (healthData.healthy ? 'online' : 'offline');
    } else if (isMonitored) {
        displayStatus = status;
    } else {
        displayStatus = 'not-monitored';
    }
    
    // Determine display message
    const getDisplayMessage = () => {
        if (status === 'disabled') return 'Output Strategy Disabled';
        if (hasBeenChecked) {
            // Show actual health result
            if (isConfigIssue) return message;
            return healthData.healthy ? 'Healthy / Online' : 'Unreachable / Offline';
        }
        if (isMonitored) {
            return isConfigIssue ? message : (status === 'online' ? 'Healthy / Online' : 'Unreachable / Offline');
        }
        return 'Automated Monitoring Disabled';
    };
    
    // Show last checked time if a check has been performed
    const showLastChecked = lastChecked && (isMonitored || hasBeenChecked);
    
    return (
        <div className="flex items-center justify-between p-3 bg-app-card rounded border border-app-border">
            <div className="flex items-center gap-4">
                <StatusIndicator status={displayStatus} />
                <div>
                    <div className="font-medium text-app-text">{label}</div>
                    <div className="text-xs text-app-dim">
                        {getDisplayMessage()}
                        {showLastChecked && ` • Last Checked: ${new Date(lastChecked).toLocaleTimeString()}`}
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {feedback && <span className="text-[10px] font-bold text-emerald-500 animate-pulse">{feedback}</span>}
                
                {canToggle ? (
                    <div className={cn('flex items-center gap-2 px-2 border-r border-app-border/50', status === 'disabled' && 'opacity-50')}>
                        <span className="text-[10px] font-bold uppercase text-app-dim">Daily Check</span>
                        <Toggle checked={enabled} onChange={onToggle} disabled={status === 'disabled'} />
                    </div>
                ) : (
                    <div className="flex items-center gap-1 text-app-dim opacity-50 px-2 border-r border-app-border/50">
                        <Lock className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase">Fixed</span>
                    </div>
                )}
                
                <button 
                    onClick={onRefresh}
                    disabled={refreshing || status === 'disabled'}
                    title="Force Refresh Health"
                    className={cn(
                        'p-1.5 hover:bg-app-card-hover rounded text-app-dim transition-colors',
                        refreshing && 'text-emerald-500',
                        status === 'disabled' && 'opacity-50 cursor-not-allowed hover:bg-transparent'
                    )}
                >
                    <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
                </button>
            </div>
        </div>
    );
}

/**
 * Visual indicator for service status.
 * 
 * @param {Object} props - The component properties.
 * @param {string} props.status - The status key to determine which icon to render.
 * @returns {JSX.Element} The status icon component.
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
 * 
 * @param {Object} props - The component properties.
 * @param {boolean} props.checked - Whether the toggle is currently in the 'on' state.
 * @param {Function} props.onChange - Callback triggered when the toggle is clicked.
 * @param {boolean} [props.disabled=false] - Whether the toggle is disabled.
 * @returns {JSX.Element} The rendered toggle switch.
 */
function Toggle({ checked, onChange, disabled = false }) {
    return (
        <button 
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange(!checked)}
            className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none border-transparent',
                checked ? 'bg-emerald-600' : 'bg-app-border',
                disabled && 'cursor-not-allowed'
            )}
        >
            <span
                className={cn(
                    'inline-block h-3 w-3 transform rounded-full bg-white transition duration-200 ease-in-out',
                    checked ? 'translate-x-5' : 'translate-x-1'
                )}
            />
        </button>
    );
}
