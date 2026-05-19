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

- `AuthModule`: login, access-token issuing, refresh-token scaffold, forgot-password scaffold, Passport JWT strategy, and protected route example.
- `UsersModule`: simple CRUD for users with DTO validation, repository separation, bcrypt password hashing, and password-safe API responses.
- `PrismaModule`: shared Prisma client with connect/disconnect lifecycle support.

## Auth Flow

1. Create a user with `POST /api/v1/users`.
2. Log in with `POST /api/v1/auth/login` using either email or username in `identifier`.
3. Send `Authorization: Bearer <accessToken>` to protected routes such as `GET /api/v1/auth/profile` or `GET /api/v1/users/me`.
4. Use `POST /api/v1/auth/refresh` with the returned refresh token to obtain a fresh access token.

Forgot-password is intentionally only scaffolded with a generic response. It does not send email or persist reset tokens, keeping this starter focused on auth foundations without business-specific infrastructure.

## Environment

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lorestack?schema=public
DOCKER_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lorestack?schema=public
JWT_SECRET=change-me-in-production-with-at-least-32-characters
JWT_EXPIRES_IN=15m
```

## Notes

- Passwords are hashed with bcrypt before storage.
- API responses pass through a global response interceptor.
- Errors pass through a global exception filter.
- Helmet, CORS, request logging, validation, rate limiting, API versioning, and Swagger are configured in `main.ts`/`AppModule`.
