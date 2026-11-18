import React, { useState, useCallback } from "react";
import { authApi, setAuthToken, type User } from "@/lib/api";
import { AuthContext } from "@/hooks/use-auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // In-memory authentication state only.
  // No localStorage, no sessionStorage, no token in URL.
  // On page refresh, state resets to null intentionally per Phase 2 design.
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setToken(data.accessToken);
    setAuthToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const data = await authApi.register({ name, email, password });
      setToken(data.accessToken);
      setAuthToken(data.accessToken);
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      setToken(null);
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

