import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { prisma } from './lib/prisma';
import app from './app';

describe('GET /health', () => {
  it('should return 200 and status ok', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});

describe('POST /api/projects', () => {
  let testUserId: string;
  let testUserToken: string;
  const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined');
}

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `app-test-${Date.now()}@example.com`,
        passwordHash: 'hashed',
        name: 'App Test User',
      },
    });
    testUserId = user.id;
    testUserToken = jwt.sign({ sub: testUserId }, JWT_SECRET, { expiresIn: '1h' });
  });

  afterAll(async () => {
    if (testUserId) {
      await prisma.project.deleteMany({ where: { ownerId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
  });

  it('should create a project via the mounted router', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ name: 'Integration Test Project' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Integration Test Project');
    expect(response.body.ownerId).toBe(testUserId);
    expect(response.body.id).toBeDefined();

    const projectInDb = await prisma.project.findUnique({
      where: { id: response.body.id },
    });
    expect(projectInDb).not.toBeNull();
    expect(projectInDb?.name).toBe('Integration Test Project');
    expect(projectInDb?.ownerId).toBe(testUserId);
  });
});
