import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import projectRoutes from './project.routes';

const app = express();
app.use(express.json());
app.use('/projects', projectRoutes);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}

async function withAuthUser(testFn: (userId: string, token: string) => Promise<void>) {
  const user = await prisma.user.create({
    data: {
      email: `test-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: 'hashed-password',
      name: 'Test User',
    },
  });
  const token = jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '1h' });

  try {
    await testFn(user.id, token);
  } finally {
    await prisma.project.deleteMany({
      where: { ownerId: user.id },
    });
    await prisma.user.deleteMany({
      where: { id: user.id },
    });
  }
}

describe('Project Routes', () => {
  describe('POST /', () => {
    it('should return 401 without Authorization header', async () => {
      const response = await request(app).post('/projects').send({ name: 'Test' });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Authentication required' });
    });

    it('should return 401 with invalid JWT', async () => {
      const response = await request(app)
        .post('/projects')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Test' });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Invalid or expired token' });
    });

    it('should return 400 if name is missing', async () => {
      await withAuthUser(async (userId, token) => {
        const response = await request(app)
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send({});
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Project name is required' });
      });
    });

    it('should return 400 if name is empty', async () => {
      await withAuthUser(async (userId, token) => {
        const response = await request(app)
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: '' });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Project name is required' });
      });
    });

    it('should return 400 if name is whitespace only', async () => {
      await withAuthUser(async (userId, token) => {
        const response = await request(app)
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: '   ' });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Project name is required' });
      });
    });

    it('should return 400 if name is not a string', async () => {
      await withAuthUser(async (userId, token) => {
        const response = await request(app)
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 123 });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Project name is required' });
      });
    });

    it('should return 400 if description is not a string', async () => {
      await withAuthUser(async (userId, token) => {
        const response = await request(app)
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Valid Name', description: 123 });
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'Description must be a string' });
      });
    });

    it('should create a valid project with only name', async () => {
      await withAuthUser(async (userId, token) => {
        const response = await request(app)
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'My New Project' });
        
        expect(response.status).toBe(201);
        expect(response.body.name).toBe('My New Project');
        expect(response.body.ownerId).toBe(userId);
        expect(response.body.id).toBeDefined();
        expect(response.body.description).toBeNull();
        
        // Database verification
        const projectInDb = await prisma.project.findUnique({
          where: { id: response.body.id },
        });
        expect(projectInDb).not.toBeNull();
        expect(projectInDb?.name).toBe('My New Project');
        expect(projectInDb?.ownerId).toBe(userId);
        expect(projectInDb?.description).toBeNull();
      });
    });

    it('should trim name and description', async () => {
      await withAuthUser(async (userId, token) => {
        const response = await request(app)
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: '  Spaced Name  ', description: '  Spaced Description  ' });
        
        expect(response.status).toBe(201);
        expect(response.body.name).toBe('Spaced Name');
        expect(response.body.description).toBe('Spaced Description');
      });
    });

    it('should set ownerId from token even if provided in body', async () => {
      await withAuthUser(async (userId, token) => {
        const fakeOwnerId = '00000000-0000-0000-0000-000000000000';
        const response = await request(app)
          .post('/projects')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: 'Secure Project', ownerId: fakeOwnerId });
        
        expect(response.status).toBe(201);
        expect(response.body.ownerId).toBe(userId);
        expect(response.body.ownerId).not.toBe(fakeOwnerId);
      });
    });
  });
});
