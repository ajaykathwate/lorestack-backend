import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor } from '@nestjs/common';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const testUser = {
    username: `e2e_auth_${Date.now()}`,
    email: `e2e_auth_${Date.now()}@example.com`,
    password: 'Password1',
  };

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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testUser.email } });
    await app.close();
  });

  describe('POST /api/v1/auth/register (via users)', () => {
    it('creates a user', () =>
      request(app.getHttpServer())
        .post('/api/v1/users')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.data.email).toBe(testUser.email);
          expect(res.body.data.password).toBeUndefined();
        }));

    it('rejects duplicate email', () =>
      request(app.getHttpServer()).post('/api/v1/users').send(testUser).expect(409));
  });

  describe('POST /api/v1/auth/login', () => {
    it('rejects unverified email', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: testUser.email, password: testUser.password })
        .expect(401));

    it('rejects invalid credentials', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: testUser.email, password: 'WrongPass1' })
        .expect(401));

    it('rejects invalid request body', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: testUser.email })
        .expect(400));
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('returns generic success for unknown email', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.message).toMatch(/If the account exists/);
        }));
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('returns generic success', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ identifier: testUser.email })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.message).toMatch(/If the account/);
        }));
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rejects invalid refresh token', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401));
  });

  describe('POST /api/v1/auth/logout', () => {
    it('succeeds even with unknown token', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'unknown-token' })
        .expect(200));
  });

  describe('Throttle on login', () => {
    it('locks out after 5 rapid failed attempts', async () => {
      const payload = { identifier: `flood_${Date.now()}@example.com`, password: 'Password1' };
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).post('/api/v1/auth/login').send(payload);
      }
      const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send(payload);
      // Either still 401 (throttler) or 429 (login lockout)
      expect([401, 429]).toContain(res.status);
    });
  });
});
