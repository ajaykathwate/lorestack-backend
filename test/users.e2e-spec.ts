import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const testUser = {
    username: `e2e_user_${suffix}`,
    email: `e2e_user_${suffix}@example.com`,
    password: 'Password1',
  };

  // A second user to get a valid JWT (must have verified email)
  let accessToken: string;
  let createdUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

    prisma = app.get(PrismaService);
    await app.init();

    // Create user directly in DB with verified email to obtain a JWT
    const verifiedSuffix = `verified_${suffix}`;
    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash('Password1', 10);
    const verifiedUser = await prisma.user.create({
      data: {
        username: `e2e_${verifiedSuffix}`,
        email: `e2e_${verifiedSuffix}@example.com`,
        password: hashed,
        emailVerifiedAt: new Date(),
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: verifiedUser.email, password: 'Password1' });

    accessToken = loginRes.body.data.accessToken;

    // Clean up the verified helper user after suite
    await prisma.user.delete({ where: { id: verifiedUser.id } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [testUser.email] } },
    });
    await app.close();
  });

  describe('POST /api/v1/users', () => {
    it('creates a user (public endpoint)', () =>
      request(app.getHttpServer())
        .post('/api/v1/users')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          createdUserId = res.body.data.id;
          expect(res.body.data.email).toBe(testUser.email);
          expect(res.body.data.username).toBe(testUser.username);
          expect(res.body.data.password).toBeUndefined();
        }));

    it('rejects weak password', () =>
      request(app.getHttpServer())
        .post('/api/v1/users')
        .send({ ...testUser, email: 'other@x.com', username: 'otherone', password: 'short' })
        .expect(400));

    it('rejects duplicate user', () =>
      request(app.getHttpServer()).post('/api/v1/users').send(testUser).expect(409));
  });

  describe('GET /api/v1/users', () => {
    it('requires authentication', () =>
      request(app.getHttpServer()).get('/api/v1/users').expect(401));

    it('returns paginated list with valid JWT', () =>
      request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
        }));

    it('respects pagination params', () =>
      request(app.getHttpServer())
        .get('/api/v1/users?page=1&limit=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeLessThanOrEqual(1);
        }));

    it('rejects invalid pagination params', () =>
      request(app.getHttpServer())
        .get('/api/v1/users?page=0')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400));
  });

  describe('GET /api/v1/users/me', () => {
    it('requires authentication', () =>
      request(app.getHttpServer()).get('/api/v1/users/me').expect(401));

    it('returns current user with valid JWT', () =>
      request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.password).toBeUndefined();
        }));
  });

  describe('GET /api/v1/users/:id', () => {
    it('requires authentication', () =>
      request(app.getHttpServer()).get(`/api/v1/users/${createdUserId}`).expect(401));

    it('returns user by id with valid JWT', async () => {
      // createdUserId is set by the POST test above
      return request(app.getHttpServer())
        .get(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(createdUserId);
        });
    });

    it('returns 404 for unknown id', () =>
      request(app.getHttpServer())
        .get('/api/v1/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404));

    it('returns 400 for invalid uuid', () =>
      request(app.getHttpServer())
        .get('/api/v1/users/not-a-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400));
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('requires authentication', () =>
      request(app.getHttpServer())
        .patch(`/api/v1/users/${createdUserId}`)
        .send({ username: 'newname' })
        .expect(401));

    it('updates user with valid JWT', () =>
      request(app.getHttpServer())
        .patch(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: `updated_${suffix}` })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.username).toBe(`updated_${suffix}`);
        }));
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('requires authentication', () =>
      request(app.getHttpServer()).delete(`/api/v1/users/${createdUserId}`).expect(401));

    it('soft-deletes user with valid JWT', () =>
      request(app.getHttpServer())
        .delete(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200));

    it('returns 404 for already-deleted user', () =>
      request(app.getHttpServer())
        .get(`/api/v1/users/${createdUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404));
  });
});
