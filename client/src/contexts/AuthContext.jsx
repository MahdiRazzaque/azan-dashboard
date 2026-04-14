import { useState, useEffect } from "react";
import { AuthContext } from "@/hooks/useAuth";

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null = unknown/loading
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setConnectionError(false);
      // First check system status (is password set?)
      const statusRes = await fetch("/api/auth/status");

      if (!statusRes.ok) {
        // If we get a 500+ error, the server (or proxy) is likely failing to reach the backend
        if (statusRes.status >= 500) {
          setConnectionError(true);
        }
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      const statusData = await statusRes.json();

      if (statusData.requiresSetup) {
        setSetupRequired(true);
        setLoading(false);
        return;
      }

      setSetupRequired(false);

      // Only check auth token if setup is NOT required
      const res = await fetch("/api/auth/check");
      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      // TypeError typically indicates a network error/server unreachable
      // Also catch SyntaxError which happens if statusRes.json() tries to parse an HTML error page
      if (
        e.name === "TypeError" ||
        e.name === "SyntaxError" ||
        e.message?.includes("Failed to fetch")
      ) {
        setConnectionError(true);
      }
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (password) => {
    try {
      setConnectionError(false);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
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
      return { success: false, error: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout failed", e);
    }
    setIsAuthenticated(false);
  };

  const clearConnectionError = () => setConnectionError(false);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loading,
        login,
        logout,
        setupRequired,
        refreshAuth: checkStatus,
        connectionError,
        clearConnectionError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
