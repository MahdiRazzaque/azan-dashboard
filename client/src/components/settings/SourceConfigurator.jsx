import { Globe, MapPin, CheckCircle, Loader2, AlertTriangle, ClockCheck } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useProviders } from '@/hooks/useProviders';
import { useSettings } from '@/hooks/useSettings';
import DynamicField from './DynamicField';

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 *
 * @param {...any} inputs - The class names or objects to merge.
 * @returns {string} The merged class string.
 */
function cn(...inputs) { return twMerge(clsx(inputs)); }

/**
 * A configuration component for selecting and customising prayer time data sources,
 * including location settings and calculation methods.
 *
 * @param {object} props - The component props.
 * @param {object} props.source - The current source configuration.
 * @param {Function} props.onChange - Callback function for when the source type changes.
 * @param {Array} [props.disabledTypes=[]] - A list of source types that should be disabled.
 * @param {boolean} [props.showCoordinates=true] - Whether to show coordinate input fields.
 * @param {object} [props.locationData={}] - Current location-related data (city, country, etc.).
 * @param {Function} props.onLocationChange - Callback function for location data changes.
 * @param {boolean} [props.isBackup=false] - Whether this is a backup source configuration.
 * @param {string} [props.primarySourceType=''] - The ID of the primary source provider.
 * @returns {JSX.Element} The rendered source configurator component.
 */
export default function SourceConfigurator({ 
    source, 
    onChange, 
    disabledTypes = [], 
    showCoordinates = true,
    locationData = {},
    onLocationChange,
    isBackup = false,
    primarySourceType = ''
}) {
    const { providers, loading: loadingProviders } = useProviders();
    const { systemHealth } = useSettings();

    const activeProviderId = source?.type || 'aladhan';
    const activeProvider = providers.find(p => p.id === activeProviderId);

    const setSourceType = (type) => {
        if (disabledTypes.includes(type)) return;
        
        const newProvider = providers.find(p => p.id === type);
        const newSource = { type };
        
        // Apply defaults from the new provider's metadata
        if (newProvider && newProvider.parameters) {
            newProvider.parameters.forEach(param => {
                if (param.default !== undefined) {
                    newSource[param.key] = param.default;
                }
            });
        }
        
        // Preserve common fields like 'enabled' if they exist in current source
        if (source?.enabled !== undefined) {
            newSource.enabled = source.enabled;
        }

        onChange(newSource);
    };

    const handleParamChange = (key, value) => {
        onChange({ ...source, [key]: value });
    };

    if (loadingProviders) {
        return (
            <div className="p-8 flex items-center justify-center gap-2 text-app-dim">
                <Loader2 className="animate-spin w-5 h-5" />
                <span>Loading provider information...</span>
            </div>
        );
    }

    // Health check for provider icons
    const isProviderOffline = (id) => {
        const healthKey = isBackup ? 'backupSource' : 'primarySource';
        // Only show offline warning if this provider is actually the one active in the slot
        if (id !== activeProviderId) return false;
        
        const health = systemHealth?.[healthKey];
        return health && !health.healthy;
    };

    const getProviderErrorMessage = () => {
        const healthKey = isBackup ? 'backupSource' : 'primarySource';
        return systemHealth?.[healthKey]?.message || 'Offline';
    };

    // [REQ-005] Enforce source mutual exclusion for backup
    const filteredProviders = isBackup 
        ? providers.filter(p => p.id !== primarySourceType)
        : providers;

    const getBrandingClasses = (provider, isActive) => {
        const isOffline = isProviderOffline(provider.id);
        
        if (!isActive) return "border-app-border bg-app-card text-app-dim hover:bg-app-card-hover text-app-text";
        
        const color = provider.branding?.accentColor || 'emerald';
        const colorMap = {
            blue: isOffline ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-blue-500 bg-blue-500/10 text-blue-400",
            emerald: isOffline ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-emerald-500 bg-emerald-500/10 text-emerald-400",
            indigo: isOffline ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-indigo-500 bg-indigo-500/10 text-indigo-400",
            rose: isOffline ? "border-amber-500 bg-amber-500/10 text-amber-500" : "border-rose-500 bg-rose-500/10 text-rose-400",
            amber: "border-amber-500 bg-amber-500/10 text-amber-400"
        };
        return colorMap[color] || colorMap.emerald;
    };

    const getIconColorClass = (provider) => {
        const isOffline = isProviderOffline(provider.id);
        if (isOffline) return "text-amber-500";

        const color = provider.branding?.accentColor || 'emerald';
        const colorMap = {
            blue: "text-blue-500",
            emerald: "text-emerald-500",
            indigo: "text-indigo-500",
            rose: "text-rose-500",
            amber: "text-amber-500"
        };
        return colorMap[color] || colorMap.emerald;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
                {filteredProviders.map(provider => (
                    <button
                        key={provider.id}
                        type="button"
                        onClick={() => setSourceType(provider.id)}
                        disabled={disabledTypes.includes(provider.id)}
                        className={cn(
                            "flex-1 py-4 px-6 rounded-xl border-2 transition-all font-bold text-lg flex items-center justify-center gap-2 relative overflow-hidden",
                            getBrandingClasses(provider, activeProviderId === provider.id),
                            disabledTypes.includes(provider.id) && "opacity-50 cursor-not-allowed grayscale"
                        )}
                    >
                        {provider.label}
                        {activeProviderId === provider.id && (
                            <CheckCircle className={cn(
                                "absolute bottom-2 right-2 w-5 h-5 opacity-50",
                                getIconColorClass(provider)
                            )} />
                        )}
                        {isProviderOffline(provider.id) && (
                            <AlertTriangle 
                                className="absolute top-2 right-2 w-5 h-5 text-amber-500 animate-pulse" 
                                title={getProviderErrorMessage()} 
                            />
                        )}
                        {provider.capabilities?.providesIqamah && (
                            <span 
                                data-testid="iqamah-badge"
                                title="This source provides Iqamah times"
                                className={cn(
                                    "absolute top-1 z-10",
                                    isProviderOffline(provider.id) ? "right-7" : "right-2"
                                )}
                            >
                                <ClockCheck 
                                    className={cn(
                                        "w-5 h-5 opacity-70",
                                        getIconColorClass(provider)
                                    )}
                                />
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Provider Parameters */}
            {activeProvider && activeProvider.parameters.length > 0 && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-app-bg p-6 rounded-lg border border-app-border space-y-4">
                    {activeProvider.parameters.map(param => (
                        <DynamicField 
                            key={param.key} 
                            param={param} 
                            value={source?.[param.key]} 
                            onChange={(val) => handleParamChange(param.key, val)} 
                        />
                    ))}
                </div>
            )}

            {/* Global Calculation Settings (Shown if coordinates are requested by parent) */}
            {showCoordinates && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-app-bg p-6 rounded-lg border border-app-border">
                    {/* Coordinates (Always hardcoded as they are shared/global) */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 border-b border-app-border pb-6 mb-2">
                        <div className="col-span-2 mb-1 text-sm font-semibold text-app-dim uppercase tracking-wider">Coordinates</div>
                        <div>
                            <label className="block text-xs text-app-dim mb-1">Latitude</label>
                            <input 
                                type="number"
                                step="any"
                                className="w-full bg-app-card border border-app-border rounded p-2.5 text-app-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={locationData?.coordinates?.lat ?? ''}
                                onChange={e => onLocationChange?.('lat', parseFloat(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-app-dim mb-1">Longitude</label>
                            <input 
                                type="number"
                                step="any"
                                className="w-full bg-app-card border border-app-border rounded p-2.5 text-app-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={locationData?.coordinates?.long ?? ''}
                                onChange={e => onLocationChange?.('long', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
