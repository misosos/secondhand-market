"use client";

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LoginResponse, PublicUser } from "@secondhand/types";
import { api, clearTokens, getAccessToken, setTokens } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";

export interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<PublicUser>;
  signup: (username: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await api.get<PublicUser>("/users/me");
      setUser(me);
    } catch {
      // Access + refresh both dead — quietly fall back to signed-out
      // instead of bouncing the visitor off whatever page they're on.
      clearTokens();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.post<LoginResponse>("/auth/login", { username, password }, { skipAuth: true });
    setTokens(result);
    setUser(result.user);
    return result.user;
  }, []);

  const signup = useCallback(async (username: string, password: string) => {
    return api.post<PublicUser>("/auth/signup", { username, password }, { skipAuth: true });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Already logged out server-side or token expired — proceed to
      // clear local state regardless.
    }
    clearTokens();
    disconnectSocket();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, signup, logout, refreshUser }),
    [user, isLoading, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
