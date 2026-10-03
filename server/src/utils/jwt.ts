import jwt, { SignOptions } from 'jsonwebtoken';

export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not defined.');
  }

  const expiresIn = (process.env.JWT_EXPIRES_IN || '1d') as SignOptions['expiresIn'];

  return jwt.sign({ sub: userId }, secret, { expiresIn });
};
