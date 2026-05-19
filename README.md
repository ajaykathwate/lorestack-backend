# Lorestack Backend

Production-grade NestJS starter with a modular feature-based architecture, PostgreSQL, Prisma, JWT auth, Swagger, Docker, and User CRUD.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm start:dev
```

Swagger is available at `http://localhost:3000/docs`. Versioned API routes are under `http://localhost:3000/api/v1`.

## Docker

```bash
cp .env.example .env
docker compose up --build
```

The compose stack starts the NestJS app and PostgreSQL. The app runs pending Prisma migrations before starting.

## One-Command Docker Workflow

```bash
make restart
```

`make restart` stops existing services, clears local build cache, rebuilds the API image without Docker cache, starts PostgreSQL, runs pending Prisma migrations, and starts the API service.

On Windows without `make`, run the same workflow directly:

```powershell
.\scripts\app.ps1 restart
```

For local development with hot reload, run PostgreSQL in Docker and NestJS on your machine:

```bash
make dev
```

Equivalent PowerShell command:

```powershell
.\scripts\app.ps1 dev
```

## Commands

```bash
pnpm start:dev
pnpm build
pnpm start:prod
pnpm lint
pnpm lint:fix
pnpm format
pnpm test
pnpm test:e2e
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:studio
pnpm prisma:seed
```

## Architecture

The project uses strict feature modules under `src/modules`. Cross-cutting framework concerns live under `src/common`, environment configuration lives under `src/config`, and database integration lives under `src/database/prisma`.

Current modules:

- `AuthModule`: login, access-token issuing, hashed refresh-token rotation, forgot password, email verification, password change, login-attempt protection, auth audit logs, Passport JWT strategy, and protected route examples.
- `MailModule`: centralized transactional email notifications using Resend and React Email templates.
- `HealthModule`: health and basic process metrics endpoints.
- `UsersModule`: simple CRUD for users with DTO validation, repository separation, bcrypt password hashing, and password-safe API responses.
- `PrismaModule`: shared Prisma client with connect/disconnect lifecycle support.

## Auth Flow

1. Create a user with `POST /api/v1/users`.
2. Verify the account email with `POST /api/v1/auth/verify-email`.
3. Log in with `POST /api/v1/auth/login` using either email or username in `identifier`.
4. Send `Authorization: Bearer <accessToken>` to protected routes such as `GET /api/v1/auth/profile` or `GET /api/v1/users/me`.
5. Use `POST /api/v1/auth/refresh` with the returned refresh token to obtain a fresh access token. Refresh tokens are stored hashed, rotated on use, and revoked on password changes.

Available auth endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/auth/profile`

Forgot-password and email verification use persisted hashed one-time tokens and Resend-backed email notifications when mail environment variables are configured.

## Email Notifications

Transactional email is centralized in `src/modules/mail`.

Required production variables:

```env
RESEND_API_KEY=
MAIL_FROM=Lorestack <noreply@example.com>
APP_BASE_URL=http://localhost:3000
```

Templates live in `src/modules/mail/templates`, and reusable React Email components live in `src/modules/mail/components`.

Preview templates locally:

```bash
pnpm email:dev
```

Example service usage:

```ts
await this.mailService.sendWelcomeEmail(user.email, user.username);
await this.mailService.sendVerifyEmail(user.email, user.username, verificationUrl);
await this.mailService.sendForgotPasswordEmail(user.email, user.username, resetUrl);
```

The mail module intentionally handles transactional email only. It does not include queues, marketing emails, newsletters, cron jobs, or Redis.

## Environment

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lorestack?schema=public
DOCKER_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lorestack?schema=public
JWT_SECRET=change-me-in-production-with-at-least-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN_DAYS=7
RESEND_API_KEY=
MAIL_FROM=Lorestack <noreply@example.com>
APP_BASE_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

## Notes

- Passwords are hashed with bcrypt before storage.
- API responses pass through a global response interceptor.
- Errors pass through a global exception filter.
- Helmet, CORS, request logging, validation, rate limiting, API versioning, and Swagger are configured in `main.ts`/`AppModule`.
