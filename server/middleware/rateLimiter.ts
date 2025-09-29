import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

export class RateLimiter {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup() {
    const now = Date.now();
    Object.keys(this.store).forEach(key => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  private getKey(req: Request): string {
    // Use IP address or user ID if authenticated
    const userId = (req as any).user?.id;
    return userId || req.ip || req.connection.remoteAddress || 'unknown';
  }

  createLimiter(windowMs: number, maxRequests: number) {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.getKey(req);
      const now = Date.now();
      
      if (!this.store[key] || this.store[key].resetTime < now) {
        this.store[key] = {
          count: 1,
          resetTime: now + windowMs
        };
        return next();
      }

      if (this.store[key].count >= maxRequests) {
        const resetTime = Math.ceil((this.store[key].resetTime - now) / 1000);
        
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString()
        });

        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: resetTime
        });
      }

      this.store[key].count++;
      
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': (maxRequests - this.store[key].count).toString(),
        'X-RateLimit-Reset': Math.ceil((this.store[key].resetTime - now) / 1000).toString()
      });

      next();
    };
  }

  // General rate limiter - 100 requests per 15 minutes
  get middleware() {
    return this.createLimiter(15 * 60 * 1000, 100);
  }

  // AI requests - 20 requests per 5 minutes
  get aiLimiter() {
    return this.createLimiter(5 * 60 * 1000, 20);
  }

  // Guest users - 10 requests per 10 minutes
  get guestLimiter() {
    return (req: Request, res: Response, next: NextFunction) => {
      const isGuest = (req as any).user?.isGuest;
      
      if (isGuest) {
        return this.createLimiter(10 * 60 * 1000, 10)(req, res, next);
      }
      
      next();
    };
  }

  // Premium users - higher limits
  get premiumLimiter() {
    return (req: Request, res: Response, next: NextFunction) => {
      const isGuest = (req as any).user?.isGuest;
      
      if (isGuest) {
        return this.createLimiter(5 * 60 * 1000, 5)(req, res, next);
      }
      
      // Premium users get higher limits
      return this.createLimiter(5 * 60 * 1000, 50)(req, res, next);
    };
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}