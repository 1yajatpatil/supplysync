import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, loginApi, registerApi, logoutApi, getMeApi, demoLoginApi } from '../api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  authError: string | null;
  openAuthModal: (mode?: 'login' | 'register', pendingAction?: () => void) => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loginAsDemoEvaluator: () => Promise<boolean>;
  requireAuth: (action: () => void) => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Restore authenticated session on page load
  useEffect(() => {
    async function checkAuthSession() {
      try {
        const data = await getMeApi();
        setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }
    checkAuthSession();
  }, []);

  const openAuthModal = (mode: 'login' | 'register' = 'login', pending?: () => void) => {
    setAuthModalMode(mode);
    setAuthError(null);
    if (pending) {
      setPendingAction(() => pending);
    }
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
    setAuthError(null);
    setPendingAction(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const data = await loginApi(email, password);
      setUser(data.user);
      setIsAuthModalOpen(false);

      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      return true;
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please check your credentials.');
      return false;
    }
  };

  const register = async (email: string, password: string, name?: string): Promise<boolean> => {
    setAuthError(null);
    try {
      const data = await registerApi(email, password, name);
      setUser(data.user);
      setIsAuthModalOpen(false);

      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      return true;
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed.');
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutApi();
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      setUser(null);
    }
  };

  const loginAsDemoEvaluator = async (): Promise<boolean> => {
    setAuthError(null);
    try {
      const data = await demoLoginApi();
      setUser(data.user);
      setIsAuthModalOpen(false);

      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
      return true;
    } catch (err: any) {
      setAuthError(err.message || 'Demo evaluator login failed.');
      return false;
    }
  };

  const requireAuth = (action: () => void) => {
    if (user) {
      action();
    } else {
      openAuthModal('login', action);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthModalOpen,
        authModalMode,
        authError,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        logout,
        loginAsDemoEvaluator,
        requireAuth,
        clearAuthError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
