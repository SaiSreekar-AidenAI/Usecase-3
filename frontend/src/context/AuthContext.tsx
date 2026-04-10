import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types';
import { checkEmail as apiCheckEmail, loginUser, fetchCurrentUser, logoutUser } from '../services/api';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  status: AuthStatus;
  checkEmail: (email: string) => Promise<{ requires_password: boolean; user_name: string }>;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  status: 'loading',
  checkEmail: async () => ({ requires_password: false, user_name: '' }),
  login: async () => {},
  logout: async () => {},
  isAdmin: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  // On mount: try to restore session via cookie (sent automatically)
  useEffect(() => {
    fetchCurrentUser()
      .then((u) => {
        setUser(u);
        setStatus('authenticated');
      })
      .catch(() => {
        setStatus('unauthenticated');
      });
  }, []);

  const checkEmail = useCallback(async (email: string) => {
    const result = await apiCheckEmail(email);
    return { requires_password: result.requires_password, user_name: result.user_name };
  }, []);

  const login = useCallback(async (email: string, password?: string) => {
    const result = await loginUser(email, password);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Proceed even if server call fails
    }
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, status, checkEmail, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}
