import { createContext, useContext } from "react";

export const SettingsContext = createContext(null);

/**
 * Custom hook to access settings state and actions.
 * @returns {object} Settings context value with config, saveSettings, etc.
 */
export const useSettings = () => useContext(SettingsContext);
