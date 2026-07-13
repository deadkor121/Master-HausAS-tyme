import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clearAuth, login, register, restoreSession, type AuthRole, type AuthUser } from './auth';

type AuthContextValue = {
  user: AuthUser | null;
  isReady: boolean;
  loginUser: (email: string, password: string) => Promise<AuthUser>;
  registerUser: (payload: { email: string; password: string; fullName: string; role: AuthRole }) => Promise<AuthUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    restoreSession()
      .then(setUser)
      .finally(() => setIsReady(true));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isReady,
    loginUser: async (email, password) => {
      const nextUser = await login(email, password);
      setUser(nextUser);
      return nextUser;
    },
    registerUser: async (payload) => {
      const nextUser = await register(payload);
      setUser(nextUser);
      return nextUser;
    },
    logout: () => {
      clearAuth();
      setUser(null);
    }
  }), [user, isReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
