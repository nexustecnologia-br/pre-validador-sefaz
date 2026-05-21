import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or invalid token'));
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  req.user = payload;
  next();
};
