import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { IError } from '../interface/gen';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Authentication token missing' });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(500).json({
      message: 'An error occurred during token validation',
      error: (error as IError).message,
    });
  }
};
