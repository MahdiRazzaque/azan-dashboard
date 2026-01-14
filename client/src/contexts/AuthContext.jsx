import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = unknown/loading
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);
  
  const checkStatus = async () => {
    try {
        // First check system status (is password set?)
        const statusRes = await fetch('/api/auth/status');
        const statusData = await statusRes.json();
        
        if (statusData.requiresSetup) {
            setSetupRequired(true);
            setLoading(false);
            return;
        }

        setSetupRequired(false);

        // Only check auth token if setup is NOT required
        const res = await fetch('/api/auth/check');
        if (res.ok) {
            setIsAuthenticated(true);
        } else {
            setIsAuthenticated(false);
        }
    } catch (e) {
        setIsAuthenticated(false);
    } finally {
        setLoading(false);
    }
  };

  const login = async (password) => {
    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        if (res.ok) {
            setIsAuthenticated(true);
            return { success: true };
        } else {
            const data = await res.json();
            return { success: false, error: data.error };
        }
    } catch (e) {
        console.error("Login failed", e);
        return { success: false, error: 'Network error' };
    }
  };


  const logout = async () => {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
        console.error("Logout failed", e);
    }
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, login, logout, setupRequired, refreshAuth: checkStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
