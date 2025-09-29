import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { safeLocalStorage, logError } from '../utils/errorHandler';

/**
 * A custom React hook that provides a state variable that persists in localStorage.
 * @param key The key to use in localStorage.
 * @param initialState The initial state value if nothing is in localStorage.
 * @returns A stateful value, and a function to update it.
 */
function usePersistentState<T>(key: string, initialState: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      if (!key || typeof key !== 'string') {
        logError(new Error('Invalid localStorage key provided'), 'usePersistentState');
        return initialState;
      }
      
      return safeLocalStorage.getItem(key, initialState);
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), 'usePersistentState initialization');
      return initialState;
    }
  });

  useEffect(() => {
    try {
      if (!key || typeof key !== 'string') {
        logError(new Error('Invalid localStorage key provided'), 'usePersistentState effect');
        return;
      }
      
      const success = safeLocalStorage.setItem(key, state);
      if (!success) {
        console.warn(`Failed to persist state for key "${key}"`);
      }
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), 'usePersistentState effect');
    }
  }, [key, state]);

  return [state, setState];
}

export default usePersistentState;