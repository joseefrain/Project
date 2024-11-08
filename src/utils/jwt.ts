import * as jwt from 'jsonwebtoken';
import { SignOptions, JwtPayload } from 'jsonwebtoken';
import { Types } from 'mongoose'; // Para manejar ObjectId

const jwtOptions: SignOptions = {
  expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  algorithm: (process.env.JWT_ALGORITHM as jwt.Algorithm) || 'HS256',
};

export interface CustomJwtPayload extends JwtPayload {
  id: Types.ObjectId;
  username: string;
  role: string;
}

export const generateToken = (payload: CustomJwtPayload): string => {
  const secretKey = process.env.JWT_SECRET || 'defaultSecretKey';

  if (!secretKey || secretKey === 'defaultSecretKey') {
    throw new Error('Secret key not set in environment variables');
  }

  return jwt.sign(payload, secretKey, jwtOptions);
};

export const verifyToken = (token: string): CustomJwtPayload | null => {
  const secretKey = process.env.JWT_SECRET || 'defaultSecretKey';
  try {
    return jwt.verify(token, secretKey) as CustomJwtPayload;
  } catch (err) {
    console.error('Token verification failed:', err);
    return null;
  }
};
