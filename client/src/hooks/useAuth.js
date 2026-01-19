import { createContext, useContext } from 'react';

export const AuthContext = createContext(null);

/**
 * Custom hook to access authentication state and actions.
 * @returns {object} Auth context value with isAuthenticated, login, logout, etc.
 */
export const useAuth = () => useContext(AuthContext);
