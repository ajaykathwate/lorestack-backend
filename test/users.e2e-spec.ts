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

  let accessToken: string;
  let adminToken: string;
  let verifiedUserId: string;

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

    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash('Password1', 10);

    // Verified regular user
    const user = await prisma.user.create({
      data: { email: `e2e_user_${suffix}@example.com`, password: hashed, isEmailVerified: true },
    });
    verifiedUserId = user.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `e2e_user_${suffix}@example.com`, password: 'Password1' });
    accessToken = loginRes.body.data.accessToken as string;

    // Admin user
    const admin = await prisma.user.create({
      data: {
        email: `e2e_admin_${suffix}@example.com`,
        password: hashed,
        isEmailVerified: true,
        platformRole: 'platform_admin',
      },
    });

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: `e2e_admin_${suffix}@example.com`, password: 'Password1' });
    adminToken = adminLogin.body.data.accessToken as string;

    // Clean up admin user after tokens obtained — it stays in DB for auth but won't affect tests
    void admin; // referenced to avoid lint warning
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        email: {
          in: [`e2e_user_${suffix}@example.com`, `e2e_admin_${suffix}@example.com`],
        },
      },
    });
    await app.close();
  });

  describe('GET /api/v1/users', () => {
    it('requires authentication', () =>
      request(app.getHttpServer()).get('/api/v1/users').expect(401));

    it('rejects regular user — admin only', () =>
      request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403));

    it('returns paginated list for platform_admin', () =>
      request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
        }));

    it('respects pagination params', () =>
      request(app.getHttpServer())
        .get('/api/v1/users?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeLessThanOrEqual(1);
        }));

    it('rejects invalid pagination params', () =>
      request(app.getHttpServer())
        .get('/api/v1/users?page=0')
        .set('Authorization', `Bearer ${adminToken}`)
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
          expect(res.body.data.isEmailVerified).toBe(true);
          expect(res.body.data.platformRole).toBeDefined();
          expect(res.body.data.provider).toBeDefined();
        }));
  });

  describe('GET /api/v1/users/:id', () => {
    it('requires authentication', () =>
      request(app.getHttpServer()).get(`/api/v1/users/${verifiedUserId}`).expect(401));

    it('returns user by id with valid JWT', () =>
      request(app.getHttpServer())
        .get(`/api/v1/users/${verifiedUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(verifiedUserId);
          expect(res.body.data.password).toBeUndefined();
        }));

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
        .patch(`/api/v1/users/${verifiedUserId}`)
        .send({ email: 'new@example.com' })
        .expect(401));

    it('rejects update of another user by non-admin', async () => {
      const other = await prisma.user.create({
        data: { email: `e2e_other_${suffix}@example.com`, isEmailVerified: true },
      });

      await request(app.getHttpServer())
        .patch(`/api/v1/users/${other.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: `other_updated_${suffix}@example.com` })
        .expect(403);

      await prisma.user.delete({ where: { id: other.id } });
    });

    it('allows user to update their own account', () =>
      request(app.getHttpServer())
        .patch(`/api/v1/users/${verifiedUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: `e2e_user_${suffix}@example.com` })
        .expect(200));
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('requires authentication', () =>
      request(app.getHttpServer()).delete(`/api/v1/users/${verifiedUserId}`).expect(401));

    it('rejects deletion of another user by non-admin', async () => {
      const other = await prisma.user.create({
        data: { email: `e2e_del_other_${suffix}@example.com`, isEmailVerified: true },
      });

      await request(app.getHttpServer())
        .delete(`/api/v1/users/${other.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);

      await prisma.user.delete({ where: { id: other.id } });
    });

    it('soft-deletes own account', () =>
      request(app.getHttpServer())
        .delete(`/api/v1/users/${verifiedUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200));

    it('returns 404 for already-deleted user', () =>
      request(app.getHttpServer())
        .get(`/api/v1/users/${verifiedUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404));
  });
});
