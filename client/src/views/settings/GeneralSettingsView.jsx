import { useState, useEffect } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { Save, Globe, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) { return twMerge(clsx(inputs)); }

export default function GeneralSettingsView() {
  const { 
    draftConfig, 
    updateSetting, 
    saveSettings, 
    saving, 
    loading,
    isSectionDirty
  } = useSettings();
  
  const [errorObj, setErrorObj] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (loading || !draftConfig) return <div className="p-8 text-center text-zinc-500">Loading settings...</div>;

  const formData = draftConfig;

  const handleChange = (path, value) => {
    // Clear messages on edit
    if (successMsg) setSuccessMsg(null);
    if (errorObj) setErrorObj(null);
    updateSetting(path, value);
  };

  const handleSave = async () => {
      setErrorObj(null);
      setSuccessMsg(null);
      const result = await saveSettings();
      if (!result.success) {
          setErrorObj(result.error || "Validation failed");
      } else {
          setSuccessMsg("Settings verified and saved successfully.");
          setTimeout(() => setSuccessMsg(null), 3000);
      }
  };

  const activeSource = formData.sources?.primary?.type || 'aladhan';

  const setSource = (type) => {
      handleChange('sources.primary.type', type);
  };

  const isDirty = isSectionDirty('location') || isSectionDirty('sources');

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-white">General Settings</h1>
                <p className="text-zinc-400 mt-1">Configure your prayer calculation source and location.</p>
            </div>
            
            <button 
                onClick={handleSave} 
                disabled={saving}
                className={cn(
                    "flex items-center gap-2 px-6 py-2.5 rounded-lg disabled:opacity-50 transition-all font-bold shadow-lg active:scale-95",
                    isDirty 
                        ? "bg-orange-500 hover:bg-orange-400 text-white shadow-orange-900/20" 
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20"
                )}
            >
                <Save className="w-4 h-4" />
                {saving ? 'Validating & Saving...' : (isDirty ? 'Unsaved Changes' : 'Save Changes')}
            </button>
        </div>

        {errorObj && (
             <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3 text-red-200">
                 <AlertTriangle className="w-5 h-5 shrink-0" />
                 <span>{errorObj}</span>
             </div>
        )}
        
        {successMsg && (
             <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-lg p-4 flex items-center gap-3 text-emerald-200">
                 <CheckCircle className="w-5 h-5 shrink-0" />
                 <span>{successMsg}</span>
             </div>
        )}

        {/* Prayer Source Section */}
        <section className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl">
            <h2 className="text-xl font-semibold mb-6 text-emerald-400 border-b border-zinc-800 pb-2 flex items-center gap-2">
                <Globe className="w-5 h-5" /> 
                Prayer Data Source
                {isSectionDirty('sources') && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                )}
            </h2>
            
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                 <button
                    onClick={() => setSource('mymasjid')}
                    className={cn(
                        "flex-1 py-4 px-6 rounded-xl border-2 transition-all font-bold text-lg flex items-center justify-center gap-2 relative overflow-hidden",
                        activeSource === 'mymasjid'
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750"
                    )}
                 >
                    MyMasjid
                    {activeSource === 'mymasjid' && <CheckCircle className="absolute top-2 right-2 w-5 h-5 opacity-50" />}
                 </button>
                 
                 <button
                    onClick={() => setSource('aladhan')}
                    className={cn(
                        "flex-1 py-4 px-6 rounded-xl border-2 transition-all font-bold text-lg flex items-center justify-center gap-2 relative overflow-hidden",
                        activeSource === 'aladhan'
                            ? "border-blue-500 bg-blue-500/10 text-blue-400"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-750"
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
                        value={formData.sources?.primary?.masjidId || ''}
                        onChange={e => handleChange('sources.primary.masjidId', e.target.value)}
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
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 border-b border-zinc-800 pb-6 mb-2">
                        <div className="col-span-2 mb-1 text-sm font-semibold text-zinc-400 uppercase tracking-wider">Coordinates</div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Latitude</label>
                            <input 
                                type="number"
                                step="0.0001"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={formData.location?.coordinates?.lat ?? ''}
                                onChange={e => handleChange('location.coordinates.lat', parseFloat(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-500 mb-1">Longitude</label>
                            <input 
                                type="number"
                                step="0.0001"
                                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                value={formData.location?.coordinates?.long ?? ''}
                                onChange={e => handleChange('location.coordinates.long', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>

                     <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Calculation Method</label>
                        <select
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={formData.calculation?.method || ''}
                            onChange={e => handleChange('calculation.method', e.target.value)}
                        >
                            <option value="3">Muslim World League</option>
                            <option value="2">ISNA (North America)</option>
                            <option value="4">Umm Al-Qura (Makkah)</option>
                            <option value="1">Egyptian General Authority</option>
                            <option value="5">Moonsighting Committee</option>
                            <option value="12">France (UOIF)</option>
                            <option value="13">Turkey (Diyanet)</option>
                            <option value="0">Jafari / Shia Ithna-Ashari</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Madhab (Asr)</label>
                         <select 
                            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2.5 text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={formData.calculation?.madhab || ''}
                            onChange={e => handleChange('calculation.madhab', e.target.value)}
                        >
                            <option value="shafi">Shafi (Standard)</option>
                            <option value="hanafi">Hanafi</option>
                        </select>
                    </div>
                </div>
            )}
        </section>

        {/* Timezone Section */}
        <section className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 shadow-xl">
             <h2 className="text-xl font-semibold mb-6 text-emerald-400 border-b border-zinc-800 pb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5" /> 
                Localization
                {isSectionDirty('location') && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                )}
            </h2>
            
            <div className="max-w-md">
                <label className="block text-sm font-medium text-zinc-300 mb-2">Timezone (IANA)</label>
                <input 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-3 text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.location?.timezone || ''}
                    onChange={e => handleChange('location.timezone', e.target.value)}
                    placeholder="e.g. Europe/London"
                />
                <p className="text-xs text-zinc-500 mt-2">
                    Must match the standard IANA timezone database format.
                </p>
            </div>
        </section>
    </div>
  );
}
