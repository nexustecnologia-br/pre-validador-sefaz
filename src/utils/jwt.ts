import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'dev-secret-key';
const expiresIn = process.env.JWT_EXPIRE_IN || '24h';

export const generateToken = (payload: any) => {
  return jwt.sign(payload, secret as string, { expiresIn } as any);
};

export const verifyToken = (token: string) => {
  try {
    return jwt.verify(token, secret as string);
  } catch (error) {
    return null;
  }
};

export const generateRefreshToken = (payload: any) => {
  return jwt.sign(payload, secret as string, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE_IN || '30d'
  } as any);
};
