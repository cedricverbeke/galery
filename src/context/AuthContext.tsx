import { createContext, useContext, useState, type ReactNode } from 'react';

const ADMIN_PASSWORD = '160678';
const STORAGE_KEY = 'declic_admin_session';

interface AuthContextValue {
  isAuthed: boolean;
  loading: boolean;
  unlock: (password: string) => boolean;
  lock: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState<boolean>(() => {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  });
  const loading = false;

  const unlock = (password: string) => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, '1');
      setIsAuthed(true);
      return true;
    }
    return false;
  };

  const lock = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsAuthed(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthed, loading, unlock, lock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
