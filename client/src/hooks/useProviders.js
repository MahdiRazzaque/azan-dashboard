import { useContext } from 'react';
import { SettingsContext } from '@/hooks/useSettings';

/**
 * Hook to consume cached prayer provider metadata from SettingsContext.
 * 
 * @returns {Object} An object containing providers, loading state, and refresh function.
 */
export function useProviders() {
    const { providers, providersLoading, fetchProviders } = useContext(SettingsContext);
    return { 
        providers, 
        loading: providersLoading, 
        refresh: fetchProviders 
    };
}
