import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../index';

const JWT_SECRET = process.env.JWT_SECRET || 'mominai-secret-key';

export type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string;
    isGuest?: boolean;
  };
};

export class AuthMiddleware {
  async protect(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // For guest users, just use the decoded info
      if (decoded.isGuest) {
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          isGuest: true
        };
        return next();
      }

      // For regular users, fetch from database
      const user = await db.getUserById(decoded.userId);
      req.user = {
        id: user.id,
        email: user.email,
        isGuest: false
      };

      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  }

  optional(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        isGuest: decoded.isGuest || false
      };
    } catch (error) {
      // Invalid token, but continue without user
    }

    next();
  }

  requirePremium(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (req.user?.isGuest) {
      return res.status(403).json({ 
        error: 'Premium feature requires account registration',
        code: 'GUEST_LIMITATION'
      });
    }

    // In a real app, you'd check premium status here
    next();
  }

  adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    // In a real app, you'd check admin status
    if (req.user?.email !== 'admin@mominai.com') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  }
}