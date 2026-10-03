import request from 'supertest';
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
