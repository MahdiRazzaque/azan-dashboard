import { Globe, MapPin, CheckCircle, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useConstants } from '@/hooks/useConstants';
import { useProviders } from '@/hooks/useProviders';
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
 * @param {object} [props.calculationData={}] - Current calculation method settings.
 * @param {Function} props.onLocationChange - Callback function for location data changes.
 * @param {Function} props.onCalculationChange - Callback function for calculation data changes.
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
    calculationData = {},
    onLocationChange,
    onCalculationChange,
    isBackup = false,
    primarySourceType = ''
}) {
    const { constants, loading: loadingConstants } = useConstants();
    const { providers, loading: loadingProviders } = useProviders();

    const activeProviderId = source?.type || 'aladhan';
    const activeProvider = providers.find(p => p.id === activeProviderId);

    const setSourceType = (type) => {
        if (disabledTypes.includes(type)) return;
        onChange({ ...source, type });
    };

    const handleParamChange = (key, value) => {
        onChange({ ...source, [key]: value });
    };

    const renderOptions = (items) => {
        return items?.map(item => (
            <option key={item.id} value={item.id}>
                {item.label}
            </option>
        ));
    };

    if (loadingConstants || loadingProviders) {
        return (
            <div className="p-8 flex items-center justify-center gap-2 text-app-dim">
                <Loader2 className="animate-spin w-5 h-5" />
                <span>Loading provider information...</span>
            </div>
        );
    }

    // [REQ-005] Enforce source mutual exclusion for backup
    const filteredProviders = isBackup 
        ? providers.filter(p => p.id !== primarySourceType)
        : providers;

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
                            activeProviderId === provider.id
                                ? (provider.id === 'aladhan' ? "border-blue-500 bg-blue-500/10 text-blue-400" : "border-emerald-500 bg-emerald-500/10 text-emerald-400")
                                : "border-app-border bg-app-card text-app-dim hover:bg-app-card-hover text-app-text",
                            disabledTypes.includes(provider.id) && "opacity-50 cursor-not-allowed grayscale"
                        )}
                    >
                        {provider.label}
                        {activeProviderId === provider.id && (
                            <CheckCircle className={cn(
                                "absolute top-2 right-2 w-5 h-5 opacity-50",
                                provider.id === 'aladhan' ? "text-blue-500" : "text-emerald-500"
                            )} />
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

            {/* Global Calculation Settings (Shown only for providers requiring coordinates and not providing dynamic fields for them) */}
            {activeProvider?.requiresCoordinates && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-app-bg p-6 rounded-lg border border-app-border">
                    {/* Coordinates (Always hardcoded as they are shared/global) */}
                    {showCoordinates && (
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
                    )}

                    {/* Hardcoded Calculation Settings (Only if not provided dynamically) */}
                    {!activeProvider.parameters.some(p => p.key === 'method') && (
                        <div>
                            <label className="block text-sm font-medium text-app-dim mb-2">Calculation Method</label>
                            <select
                                className="w-full bg-app-card border border-app-border rounded p-2.5 text-app-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={calculationData?.method ?? ''}
                                onChange={e => onCalculationChange?.('method', parseInt(e.target.value))}
                            >
                                {renderOptions(constants.calculationMethods)}
                            </select>
                        </div>
                    )}
                    
                    {!activeProvider.parameters.some(p => p.key === 'madhab') && (
                        <div>
                            <label className="block text-sm font-medium text-app-dim mb-2">Madhab (Asr)</label>
                            <select 
                                className="w-full bg-app-card border border-app-border rounded p-2.5 text-app-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={calculationData?.madhab ?? ''}
                                onChange={e => onCalculationChange?.('madhab', parseInt(e.target.value))}
                            >
                                {renderOptions(constants.madhabs)}
                            </select>
                        </div>
                    )}

                    {!activeProvider.parameters.some(p => p.key === 'latitudeAdjustmentMethod') && (
                        <div>
                            <label className="block text-sm font-medium text-app-dim mb-2">Latitude Adjustment</label>
                            <select
                                className="w-full bg-app-card border border-app-border rounded p-2.5 text-app-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={calculationData?.latitudeAdjustmentMethod ?? 0}
                                onChange={e => onCalculationChange?.('latitudeAdjustmentMethod', parseInt(e.target.value))}
                            >
                                {renderOptions(constants.latitudeAdjustments)}
                            </select>
                        </div>
                    )}

                    {!activeProvider.parameters.some(p => p.key === 'midnightMode') && (
                        <div>
                            <label className="block text-sm font-medium text-app-dim mb-2">Midnight Mode</label>
                            <select
                                className="w-full bg-app-card border border-app-border rounded p-2.5 text-app-text focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={calculationData?.midnightMode ?? 0}
                                onChange={e => onCalculationChange?.('midnightMode', parseInt(e.target.value))}
                            >
                                {renderOptions(constants.midnightModes)}
                            </select>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
