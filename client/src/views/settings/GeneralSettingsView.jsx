import { useState, useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';
import { Globe, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import SourceConfigurator from '@/components/settings/SourceConfigurator';
import { useProviders } from '@/hooks/useProviders';

/**
 * A utility function for conditionally joining CSS classes using tailwind-merge and clsx.
 *
 * @param {...any} inputs - The class names or objects to merge.
 * @returns {string} The merged class string.
 */
function cn(...inputs) { return twMerge(clsx(inputs)); }

/**
 * A view component for configuring general system settings, such as the prayer 
 * time calculation source and location-specific details.
 *
 * @returns {JSX.Element} The rendered general settings view.
 */
export default function GeneralSettingsView() {
  const { 
    draftConfig, 
    updateSetting, 
    loading,
    isSectionDirty,
    systemHealth
  } = useSettings();
  
  const { providers } = useProviders();

  if (loading || !draftConfig) return <div className="p-8 text-center text-app-dim">Loading settings...</div>;

  const formData = draftConfig;

  const handleChange = (path, value) => {
    updateSetting(path, value);
  };

  const primarySource = formData.sources?.primary || { type: 'aladhan' };
  const backupSource = formData.sources?.backup || null;
  const backupEnabled = !!backupSource;

  const primaryMeta = providers.find(p => p.id === primarySource.type);
  const backupMeta = backupEnabled ? providers.find(p => p.id === backupSource.type) : null;
  const needsCoordinates = (primaryMeta?.requiresCoordinates) || (backupEnabled && backupMeta?.requiresCoordinates);

  // Health checks for sources
  const primaryHealthy = systemHealth?.primarySource?.healthy ?? true;
  const backupHealthy = systemHealth?.backupSource?.healthy ?? true;

  const handlePrimaryChange = (newSource) => {
      handleChange('sources.primary', newSource);
      
      // [REQ-005] Source Mutual Exclusion: If backup is same as new primary, reset backup
      if (backupEnabled && backupSource.type === newSource.type) {
          const alternativeProvider = providers.find(p => p.id !== newSource.type);
          if (alternativeProvider) {
              handleChange('sources.backup', { ...backupSource, type: alternativeProvider.id });
          } else {
              handleChange('sources.backup', null);
          }
      }
  };

  const handleBackupChange = (newSource) => {
      handleChange('sources.backup', { ...newSource, enabled: true });
  };

  const toggleBackup = (enabled) => {
      if (enabled) {
          const alternativeProvider = providers.find(p => p.id !== primarySource.type);
          if (alternativeProvider) {
              const type = alternativeProvider.id;
              const defaults = { type, enabled: true };
              
              // Apply defaults from metadata
              if (alternativeProvider.parameters) {
                  alternativeProvider.parameters.forEach(param => {
                      if (param.default !== undefined) {
                          defaults[param.key] = param.default;
                      }
                  });
              }
              
              handleChange('sources.backup', defaults);
          }
      } else {
          handleChange('sources.backup', null);
      }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-bold text-app-text">General Settings</h1>
                <p className="text-app-dim mt-1">Configure your prayer calculation source and location.</p>
            </div>
        </div>
        
        {/* Primary Prayer Source Section */}
        <section className="bg-app-card p-6 rounded-xl border border-app-border shadow-xl transition-all duration-300">
            <h2 className="text-xl font-semibold mb-6 text-emerald-400 border-b border-app-border pb-2 flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-500" /> 
                Primary Data Source
                {!primaryHealthy && (
                    <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" title={systemHealth.primarySource.message || 'Offline'} />
                )}
                {isSectionDirty('sources.primary') && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                )}
            </h2>
            
            <SourceConfigurator 
                source={primarySource}
                onChange={handlePrimaryChange}
                locationData={formData.location}
                onLocationChange={(field, val) => handleChange(`location.coordinates.${field}`, val)}
                showCoordinates={!!primaryMeta?.requiresCoordinates}
            />
        </section>

        {/* Backup Prayer Source Section */}
        <section className={cn(
            "bg-app-card rounded-xl border border-app-border shadow-xl transition-all duration-500 overflow-hidden",
            backupEnabled ? "p-6" : "p-6 max-h-[88px]"
        )}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-blue-400 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-blue-500" /> 
                    Backup Data Source
                    {!backupHealthy && backupEnabled && (
                        <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" title={systemHealth.backupSource.message || 'Offline'} />
                    )}
                    {isSectionDirty('sources.backup') && (
                        <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                    )}
                </h2>
                
                <label className="relative inline-flex items-center cursor-pointer">
                    <span className="sr-only">Enable backup data source</span>
                    <input 
                        type="checkbox" 
                        aria-label="Enable backup data source"
                        className="sr-only peer" 
                        checked={backupEnabled}
                        onChange={(e) => toggleBackup(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-app-card-hover peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-app-text after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-app-text after:border-app-dim after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            <div className={cn(
                "transition-all duration-500",
                backupEnabled ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
            )}>
                {backupEnabled && (
                    <SourceConfigurator 
                        source={backupSource}
                        onChange={handleBackupChange}
                        disabledTypes={[primarySource.type]}
                        locationData={formData.location}
                        onLocationChange={(field, val) => handleChange(`location.coordinates.${field}`, val)}
                        showCoordinates={!!backupMeta?.requiresCoordinates}
                        isBackup={true}
                        primarySourceType={primarySource.type}
                    />
                )}
            </div>
        </section>

        {/* Timezone Section */}
        <section className="bg-app-card p-6 rounded-xl border border-app-border shadow-xl">
             <h2 className="text-xl font-semibold mb-6 text-emerald-400 border-b border-app-border pb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5" /> 
                Localisation
                {isSectionDirty('location.timezone') && (
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]" />
                )}
            </h2>
            
            <div className="max-w-md">
                <label htmlFor="timezone-input" className="block text-sm font-medium text-app-dim mb-2">Timezone (IANA)</label>
                <input 
                    id="timezone-input"
                    className="w-full bg-app-bg border border-app-border rounded p-3 text-app-text focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={formData.location?.timezone || ''}
                    onChange={e => handleChange('location.timezone', e.target.value)}
                    placeholder="e.g. Europe/London"
                />
                <p className="text-xs text-app-dim mt-2">
                    Must match the standard IANA timezone database format.
                </p>
            </div>
        </section>
    </div>
  );
}
