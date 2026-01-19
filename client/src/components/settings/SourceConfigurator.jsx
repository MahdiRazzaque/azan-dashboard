import { Globe, MapPin, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useConstants } from '../../hooks/useConstants';

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
    onCalculationChange
}) {
    const { constants, loading: loadingConstants } = useConstants();

    const activeSource = source?.type || 'aladhan';

    const setSourceType = (type) => {
        if (disabledTypes.includes(type)) return;
        onChange({ ...source, type });
    };

    const handleMasjidIdChange = (id) => {
        onChange({ ...source, masjidId: id });
    };

    const renderOptions = (items) => {
        return items?.map(item => (
            <option key={item.id} value={item.id}>
                {item.label}
            </option>
        ));
    };

    if (loadingConstants) return <div className="p-4 text-center text-app-dim">Loading constants...</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4">
                 <button
                    type="button"
                    onClick={() => setSourceType('mymasjid')}
                    disabled={disabledTypes.includes('mymasjid')}
                    className={cn(
                        "flex-1 py-4 px-6 rounded-xl border-2 transition-all font-bold text-lg flex items-center justify-center gap-2 relative overflow-hidden",
                        activeSource === 'mymasjid'
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                            : "border-app-border bg-app-card text-app-dim hover:bg-app-card-hover text-app-text",
                        disabledTypes.includes('mymasjid') && "opacity-50 cursor-not-allowed grayscale"
                    )}
                 >
                    MyMasjid
                    {activeSource === 'mymasjid' && <CheckCircle className="absolute top-2 right-2 w-5 h-5 opacity-50" />}
                 </button>
                 
                 <button
                    type="button"
                    onClick={() => setSourceType('aladhan')}
                    disabled={disabledTypes.includes('aladhan')}
                    className={cn(
                        "flex-1 py-4 px-6 rounded-xl border-2 transition-all font-bold text-lg flex items-center justify-center gap-2 relative overflow-hidden",
                        activeSource === 'aladhan'
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : "border-app-border bg-app-card text-app-dim hover:bg-app-card-hover text-app-text",
                        disabledTypes.includes('aladhan') && "opacity-50 cursor-not-allowed grayscale"
                    )}
                 >
                    Aladhan.com
                    {activeSource === 'aladhan' && <CheckCircle className="absolute top-2 right-2 w-5 h-5 opacity-50" />}
                 </button>
            </div>

            {/* MyMasjid Configuration */}
            {activeSource === 'mymasjid' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-app-bg p-6 rounded-lg border border-app-border">
                     <label className="block text-sm font-medium text-app-dim mb-2">Masjid ID (GUID)</label>
                     <input 
                        className="w-full bg-app-card border border-app-border rounded p-3 text-app-text focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        value={source?.masjidId || ''}
                        onChange={e => handleMasjidIdChange(e.target.value)}
                        placeholder="e.g. 94f1c71b-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-app-dim mt-2">
                        You can find this ID in the URL when viewing your mosque on MyMasjid.ca or Masjidbox.
                    </p>
                </div>
            )}

            {/* Aladhan Configuration */}
            {activeSource === 'aladhan' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-app-bg p-6 rounded-lg border border-app-border">
                    {/* Coordinates */}
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

                </div>
            )}
        </div>
    );
}
