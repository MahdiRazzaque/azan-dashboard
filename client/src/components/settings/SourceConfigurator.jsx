import { Globe, MapPin, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useConstants } from '../../hooks/useConstants';

function cn(...inputs) { return twMerge(clsx(inputs)); }

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

    if (loadingConstants) return <div className="p-4 text-center text-zinc-500">Loading constants...</div>;

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
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750",
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
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750",
                        disabledTypes.includes('aladhan') && "opacity-50 cursor-not-allowed grayscale"
                    )}
                 >
                    Aladhan.com
                    {activeSource === 'aladhan' && <CheckCircle className="absolute top-2 right-2 w-5 h-5 opacity-50" />}
                 </button>
            </div>

            {/* MyMasjid Configuration */}
            {activeSource === 'mymasjid' && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-zinc-950 p-6 rounded-lg border border-zinc-800">
                     <label className="block text-sm font-medium text-zinc-300 mb-2">Masjid ID (GUID)</label>
                     <input 
                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-3 text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        value={source?.masjidId || ''}
                        onChange={e => handleMasjidIdChange(e.target.value)}
                        placeholder="e.g. 94f1c71b-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    />
                    <p className="text-xs text-zinc-500 mt-2">
                        You can find this ID in the URL when viewing your mosque on MyMasjid.ca or Masjidbox.
                    </p>
                </div>
            )}

            {/* Aladhan Configuration */}
            {activeSource === 'aladhan' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-zinc-950 p-6 rounded-lg border border-zinc-800">
                    {/* Coordinates */}
                    {showCoordinates && (
                        <div className="md:col-span-2 grid grid-cols-2 gap-4 border-b border-zinc-800 pb-6 mb-2">
                            <div className="col-span-2 mb-1 text-sm font-semibold text-zinc-400 uppercase tracking-wider">Coordinates</div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Latitude</label>
                                <input 
                                    type="number"
                                    step="any"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={locationData?.coordinates?.lat ?? ''}
                                    onChange={e => onLocationChange?.('lat', parseFloat(e.target.value))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">Longitude</label>
                                <input 
                                    type="number"
                                    step="any"
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={locationData?.coordinates?.long ?? ''}
                                    onChange={e => onLocationChange?.('long', parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                    )}

                     <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Calculation Method</label>
                        <select
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={calculationData?.method ?? ''}
                            onChange={e => onCalculationChange?.('method', parseInt(e.target.value))}
                        >
                            {renderOptions(constants.calculationMethods)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Madhab (Asr)</label>
                         <select 
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={calculationData?.madhab ?? ''}
                            onChange={e => onCalculationChange?.('madhab', parseInt(e.target.value))}
                        >
                            {renderOptions(constants.madhabs)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Latitude Adjustment</label>
                        <select
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={calculationData?.latitudeAdjustmentMethod ?? 0}
                            onChange={e => onCalculationChange?.('latitudeAdjustmentMethod', parseInt(e.target.value))}
                        >
                             {renderOptions(constants.latitudeAdjustments)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Midnight Mode</label>
                        <select
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
