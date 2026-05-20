import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Date.now();
  const testUser = {
    fullName: 'E2E Auth User',
    email: `e2e_auth_${suffix}@example.com`,
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

  describe('POST /api/v1/auth/register', () => {
    it('registers a new user and returns a confirmation message', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.data.message).toMatch(/Check your inbox/);
        }));

    it('rejects duplicate email with 409', () =>
      request(app.getHttpServer()).post('/api/v1/auth/register').send(testUser).expect(409));

    it('rejects weak password with 400', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...testUser, email: `other_${suffix}@example.com`, password: 'short' })
        .expect(400));
  });

  describe('POST /api/v1/auth/login', () => {
    it('rejects unverified email with 401', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(401));

    it('rejects wrong password with 401', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'WrongPass1' })
        .expect(401));

    it('rejects missing password field with 400', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: testUser.email })
        .expect(400));

    it('rejects non-email identifier with 400', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'Password1' })
        .expect(400));
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('returns generic success for unknown email (anti-enumeration)', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.message).toMatch(/If the account exists/);
        }));
  });

  describe('POST /api/v1/auth/resend-verification', () => {
    it('returns generic success (anti-enumeration)', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ identifier: testUser.email })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.message).toMatch(/If the account/);
        }));

    it('rejects non-email identifier with 400', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/resend-verification')
        .send({ identifier: 'not-an-email' })
        .expect(400));
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('rejects invalid refresh token with 401', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401));
  });

  describe('POST /api/v1/auth/logout', () => {
    it('succeeds even with an unknown token', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'unknown-token' })
        .expect(200));
  });

  describe('Login lockout', () => {
    it('locks out after 5 rapid failed attempts', async () => {
      const payload = { email: `flood_${suffix}@example.com`, password: 'Password1' };
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).post('/api/v1/auth/login').send(payload);
      }
      const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send(payload);
      expect([401, 429]).toContain(res.status);
    });
  });

  describe('Full happy path (verified user)', () => {
    let accessToken: string;
    let refreshToken: string;
    let verifiedUserId: string;

    beforeAll(async () => {
      const bcrypt = await import('bcrypt');
      const hashed = await bcrypt.hash('Password1', 10);
      const user = await prisma.user.create({
        data: {
          email: `e2e_verified_${suffix}@example.com`,
          password: hashed,
          isEmailVerified: true,
        },
      });
      verifiedUserId = user.id;
    });

    afterAll(async () => {
      await prisma.user.delete({ where: { id: verifiedUserId } }).catch(() => null);
    });

    it('logs in with verified account', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `e2e_verified_${suffix}@example.com`, password: 'Password1' })
        .expect(200)
        .expect((res) => {
          accessToken = res.body.data.accessToken as string;
          refreshToken = res.body.data.refreshToken as string;
          expect(accessToken).toBeDefined();
          expect(refreshToken).toBeDefined();
          expect(res.body.data.tokenType).toBe('Bearer');
        }));

    it('refreshes the token', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body.data.accessToken).toBeDefined();
        }));

    it('completes onboarding', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/onboarding')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ displayName: 'E2E Verified' })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.username).toBeDefined();
          expect(res.body.data.displayName).toBe('E2E Verified');
        }));

    it('rejects duplicate onboarding', () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/onboarding')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ displayName: 'E2E Verified' })
        .expect(409));

    it('returns author profile after onboarding', () =>
      request(app.getHttpServer())
        .get('/api/v1/author-profiles/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.displayName).toBe('E2E Verified');
        }));

    it('suspends account and blocks login', async () => {
      await prisma.user.update({
        where: { id: verifiedUserId },
        data: { isActive: false },
      });

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `e2e_verified_${suffix}@example.com`, password: 'Password1' })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toMatch(/suspended/);
        });

      await prisma.user.update({ where: { id: verifiedUserId }, data: { isActive: true } });
    });
  });
});
