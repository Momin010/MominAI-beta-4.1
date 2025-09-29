// Global error handling utilities
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// Error logging utility
export const logError = (error: Error, context?: string) => {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    context: context || 'Unknown',
    message: error.message,
    stack: error.stack,
    name: error.name,
  };
  
  console.error('Application Error:', errorInfo);
  
  // In production, you might want to send this to an error tracking service
  // Example: Sentry, LogRocket, etc.
};

// Global error boundary handler
export const handleGlobalError = (error: Error, errorInfo?: any) => {
  logError(error, 'Global Error Boundary');
  
  // You could also show a user-friendly error message here
  // or redirect to an error page
};

// Async error wrapper
export const asyncErrorHandler = <T extends any[], R>(
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), fn.name);
      throw error;
    }
  };
};

// Safe JSON parse with error handling
export const safeJsonParse = <T = any>(jsonString: string, fallback: T): T => {
  try {
    if (!jsonString || typeof jsonString !== 'string') {
      return fallback;
    }
    return JSON.parse(jsonString);
  } catch (error) {
    logError(new Error(`JSON parse failed: ${error instanceof Error ? error.message : 'Unknown error'}`), 'safeJsonParse');
    return fallback;
  }
};

// Safe localStorage operations
export const safeLocalStorage = {
  getItem: (key: string, fallback: any = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (error) {
      logError(new Error(`localStorage getItem failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`), 'safeLocalStorage.getItem');
      return fallback;
    }
  },
  
  setItem: (key: string, value: any): boolean => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      logError(new Error(`localStorage setItem failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`), 'safeLocalStorage.setItem');
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      logError(new Error(`localStorage removeItem failed for key "${key}": ${error instanceof Error ? error.message : 'Unknown error'}`), 'safeLocalStorage.removeItem');
      return false;
    }
  }
};