import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../app';
import { prisma } from '../lib/prisma';

describe('POST /api/auth/register', () => {
  beforeEach(async () => {
    // Clean users from the TEST database before every test
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should register a new user', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'test@example.com',
      password: 'Password123',
      name: 'Test User',
    });

    expect(response.status).toBe(201);

    expect(response.body.user).toEqual(
      expect.objectContaining({
        email: 'test@example.com',
        name: 'Test User',
      }),
    );

    expect(response.body.user).not.toHaveProperty('passwordHash');

    const user = await prisma.user.findUnique({
      where: {
        email: 'test@example.com',
      },
    });

    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe('Password123');
  });

  it('should reject a duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: 'Password123',
      name: 'First User',
    });

    const response = await request(app).post('/api/auth/register').send({
      email: 'duplicate@example.com',
      password: 'Password456',
      name: 'Second User',
    });

    expect(response.status).toBe(409);

    expect(response.body).toEqual({
      error: 'Email is already registered',
    });
  });

  it('should reject an invalid email', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'Password123',
      name: 'Test User',
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Invalid email format',
    });
  });

  it('should reject a password shorter than 8 characters', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'short@example.com',
      password: '1234567',
      name: 'Test User',
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Password must be at least 8 characters',
    });
  });

  it('should reject missing required fields', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'missing@example.com',
    });

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      error: 'Email, password, and name are required',
    });
  });

  it('should normalize email and name', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: '  USER@EXAMPLE.COM  ',
      password: 'Password123',
      name: '  Test User  ',
    });

    expect(response.status).toBe(201);

    expect(response.body.user.email).toBe('user@example.com');
    expect(response.body.user.name).toBe('Test User');
  });
});

describe('POST /api/auth/login', () => {
  const testUser = {
    email: 'login@example.com',
    password: 'LoginPassword123',
    name: 'Login Test User',
  };

  beforeEach(async () => {
    await prisma.user.deleteMany();
    await request(app).post('/api/auth/register').send(testUser);
  });


  it('should login successfully with correct credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(0);
    expect(response.body.user).toEqual(
      expect.objectContaining({
        email: testUser.email,
        name: testUser.name,
      })
    );
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('should return a valid JWT token with the correct subject', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(response.status).toBe(200);

    const token = response.body.token;
    
    const dbUser = await prisma.user.findUnique({
      where: { email: testUser.email },
    });

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as jwt.JwtPayload;

    expect(decoded.sub).toBe(dbUser?.id);
  });

  it('should reject login with incorrect password', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'WrongPassword123',
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Invalid email or password',
    });
  });

  it('should reject login with unknown email', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'unknown@example.com',
      password: testUser.password,
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: 'Invalid email or password',
    });
  });

  it('should reject invalid email format', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'not-an-email',
      password: testUser.password,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Invalid email format',
    });
  });

  it('should reject missing credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: testUser.email,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Email and password are required',
    });
  });
});
