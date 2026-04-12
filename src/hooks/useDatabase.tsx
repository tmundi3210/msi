import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { initDatabase } from '../db/database';

interface DbContextValue {
  ready: boolean;
  error: string | null;
  /** Increment to force all data hooks to re-fetch */
  version: number;
  refresh: () => void;
}

const DbContext = createContext<DbContextValue>({
  ready: false,
  error: null,
  version: 0,
  refresh: () => {},
});

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    initDatabase()
      .then(() => setReady(true))
      .catch((e: Error) => setError(e.message));
  }, []);

  const refresh = useCallback(() => setVersion(v => v + 1), []);

  return (
    <DbContext.Provider value={{ ready, error, version, refresh }}>
      {children}
    </DbContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DbContext);
}
