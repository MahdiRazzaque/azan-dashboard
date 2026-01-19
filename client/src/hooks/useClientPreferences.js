import { createContext, useContext } from 'react';

export const ClientPreferencesContext = createContext();

/**
 * Custom hook to access client preferences.
 * @returns {object} Client preferences context value.
 */
export const useClientPreferences = () => {
  const context = useContext(ClientPreferencesContext);
  if (!context) {
    throw new Error('useClientPreferences must be used within a ClientPreferencesProvider');
  }
  return context;
};
