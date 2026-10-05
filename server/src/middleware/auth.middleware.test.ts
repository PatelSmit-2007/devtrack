import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { requireAuth } from './auth.middleware';

const app = express();
app.use(express.json());

app.get('/protected', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({ userId: req.user });
});

describe('auth.middleware', () => {
  let validToken: string;
  let expiredToken: string;

  beforeAll(() => {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not defined.');
    }

    const secret = process.env.JWT_SECRET;

    validToken = jwt.sign({ sub: 'test-user-id' }, secret, { expiresIn: '1h' });
    
    // Set the 'exp' claim to 1 hour in the past to create an expired token
    expiredToken = jwt.sign(
      { sub: 'test-user-id', exp: Math.floor(Date.now() / 1000) - 3600 },
      secret
    );
  });

  it('returns 401 { error: "Authentication required" } if Authorization header is missing', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it('returns 401 { error: "Authentication required" } if Authorization header is not Bearer', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Basic some_token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it('returns 401 { error: "Authentication required" } if Bearer token is missing', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  it('returns 401 { error: "Invalid or expired token" } if JWT is invalid', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('returns 401 { error: "Invalid or expired token" } if JWT is expired', async () => {
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid or expired token' });
  });

  it('returns 200 { userId: "test-user-id" } if JWT is valid', async () => {
    const res = await request(app).get('/protected').set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: 'test-user-id' });
  });
});
