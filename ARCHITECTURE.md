# Lorestack Backend — Architecture Reference

> This document is the single source of truth for every architectural decision in the Lorestack backend.
> When in doubt about *why* something is built a certain way, start here.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Layered Architecture](#4-layered-architecture)
5. [Request Lifecycle](#5-request-lifecycle)
6. [Authentication System](#6-authentication-system)
7. [Role-Based Access Control (RBAC)](#7-role-based-access-control-rbac)
8. [Database Design](#8-database-design)
9. [Module Dependency Graph](#9-module-dependency-graph)
10. [Scheduling System](#10-scheduling-system)
11. [Email System](#11-email-system)
12. [API Design Conventions](#12-api-design-conventions)
13. [Security Hardening](#13-security-hardening)
14. [Error Handling](#14-error-handling)
15. [Configuration & Environment](#15-configuration--environment)
16. [Logging & Observability](#16-logging--observability)
17. [Development Toolchain](#17-development-toolchain)
18. [Known Trade-offs & Future Work](#18-known-trade-offs--future-work)

---

## 1. System Overview

Lorestack is a **company-first publishing platform** for startups, engineers, and independent authors. The backend is a NestJS REST API that serves a React frontend.

```
┌─────────────────────────────────────────────────────────┐
│                       Frontend (React)                   │
└────────────────────────┬────────────────────────────────┘
                         │  HTTPS  REST  JSON
┌────────────────────────▼────────────────────────────────┐
│              NestJS Backend  (this repo)                 │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │   Auth   │  │  Blogs   │  │Companies │  │  Tags  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Profiles │  │Discovery │  │  Users   │  │ Health │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                          │
│           Prisma ORM  ·  @nestjs/schedule                │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              PostgreSQL Database                         │
└─────────────────────────────────────────────────────────┘
         │                          │
┌────────▼───────┐        ┌─────────▼──────┐
│  Resend (Email)│        │  Google OAuth  │
└────────────────┘        └────────────────┘
```

**Key constraints that shaped every decision:**

- Auth is entirely hand-rolled — no Supabase, no Auth0, no third-party auth service
- `Platform Admin` role is set manually in the database — never via the app UI
- The `PermissionChecker` class is the only place where RBAC rules live

---

## 2. Tech Stack

| Layer | Technology | Version | Decision Rationale |
|---|---|---|---|
| Runtime | Node.js | ≥ 20 | LTS |
| Language | TypeScript | ^5.9 | Strict type safety across all layers |
| Framework | NestJS | ^11 | Module system, DI container, decorator-based conventions |
| ORM | Prisma | ^6.14 | Type-safe queries, migration tooling, Prisma Client codegen |
| Database | PostgreSQL | 15+ | ACID, native UUID, jsonb for audit metadata |
| Auth | Custom JWT | — | No Supabase — hand-rolled with bcrypt, refresh rotation |
| OAuth | passport-google-oauth20 | ^2.0 | Google sign-in; passport-jwt for JWT validation |
| Email | Resend | ^6 | Deliverability; React Email for templating |
| Scheduling | @nestjs/schedule | ^6 | In-process cron via node-cron (no Redis required for MVP) |
| Validation | class-validator + class-transformer | ^0.14 / ^0.5 | DTO-level input validation with decorators |
| Rate Limiting | @nestjs/throttler | ^6 | Global 100 req/min guard, per-endpoint overrides |
| Logging | nestjs-pino | ^4 | Structured JSON logs in production, pino-pretty in dev |
| Config | @nestjs/config + Joi | ^4 / ^18 | Schema-validated env vars, fail-fast on boot |
| API Docs | @nestjs/swagger | ^11 | Auto-generated from decorators |
| Health | @nestjs/terminus | ^11 | `/health` liveness probe |
| Security | helmet | ^8 | HTTP header hardening |
| Package Manager | pnpm | 10 | Disk-efficient, strict dependency isolation |

---

## 3. Project Structure

```
src/
├── app.module.ts              # Root module — registers all feature modules + global providers
├── main.ts                    # Bootstrap: versioning, pipes, helmet, swagger
│
├── config/                    # Config slices loaded via ConfigModule
│   ├── app.config.ts
│   ├── auth.config.ts         # JWT secrets, Google OAuth keys, bcrypt rounds
│   ├── database.config.ts
│   ├── mail.config.ts
│   ├── configuration.ts       # Aggregates all slices → { app, auth, database, mail }
│   └── env.validation.ts      # Joi schema — hard fails if required vars are missing
│
├── common/                    # Framework-agnostic cross-cutting concerns
│   ├── decorators/
│   │   ├── current-user.decorator.ts   # @CurrentUser() → JwtUser from request
│   │   ├── public.decorator.ts         # @Public() → skip JwtAuthGuard
│   │   └── roles.decorator.ts          # @Roles(PlatformRole.platform_admin)
│   ├── guards/
│   │   ├── jwt-auth.guard.ts           # Global guard — checks @Public() first
│   │   └── roles.guard.ts              # Must be applied with @UseGuards() explicitly
│   ├── middleware/
│   │   └── correlation-id.middleware.ts  # Adds X-Correlation-Id to every request
│   ├── interceptors/
│   │   └── transform.interceptor.ts     # Wraps all responses: { success, data, requestId }
│   ├── filters/
│   │   └── http-exception.filter.ts     # Normalises all errors to { success, error, requestId }
│   └── permissions/
│       └── permission-checker.ts        # Single source of truth for RBAC — zero I/O
│
├── database/
│   └── prisma/
│       ├── prisma.service.ts            # PrismaClient wrapper with lifecycle hooks
│       ├── prisma.module.ts             # Global module — shared across all feature modules
│       └── prisma.exceptions.ts         # mapPrismaError() — P2002 → ConflictException, etc.
│
├── shared/
│   └── logger/                          # AppLoggerModule (pino integration)
│
└── modules/
    ├── auth/                  # Registration, login, OAuth, token lifecycle
    ├── users/                 # Admin-only user management
    ├── author-profiles/       # Public profile pages + profile editing
    ├── blogs/                 # Blog CRUD, status machine, scheduler
    ├── companies/             # Company CRUD, memberships, invites, milestones
    ├── tags/                  # Tag system + admin approval
    ├── discovery/             # Public explore page
    ├── mail/                  # Email sending + React Email templates
    └── health/                # /health endpoint
```

---

## 4. Layered Architecture

Every feature module follows the same three-layer stack. Dependencies only flow downward.

```
┌─────────────────────────────────────────────┐
│           Controller (HTTP boundary)         │
│  - Parse params / body / query               │
│  - Call service                              │
│  - Return entity (entity class strips        │
│    sensitive fields)                         │
└──────────────────┬──────────────────────────┘
                   │ calls
┌──────────────────▼──────────────────────────┐
│           Service (Business logic)           │
│  - Orchestrates repositories                 │
│  - Calls PermissionChecker before writes     │
│  - Throws domain exceptions                  │
│  - Never imports other services' controllers │
└──────────────────┬──────────────────────────┘
                   │ calls
┌──────────────────▼──────────────────────────┐
│         Repository (Data access)             │
│  - Wraps Prisma calls                        │
│  - Returns raw Prisma types or typed result  │
│  - No business logic                         │
│  - No permission checks                      │
└──────────────────┬──────────────────────────┘
                   │ via PrismaService
┌──────────────────▼──────────────────────────┐
│              PostgreSQL                      │
└─────────────────────────────────────────────┘
```

**Why repositories instead of calling Prisma directly in services?**

Services would become untestable if they import Prisma directly. The repository is a thin adapter — swap it for a different data source without touching business logic.

---

## 5. Request Lifecycle

Every incoming HTTP request passes through these layers in order:

```
Incoming Request
      │
      ▼
CorrelationIdMiddleware          Attaches X-Correlation-Id header (UUID v4)
      │
      ▼
ThrottlerGuard (global)          100 req/min per IP — returns 429 if exceeded
      │
      ▼
JwtAuthGuard (global)            Validates Bearer token via JwtStrategy
      │                          Skipped if route has @Public() decorator
      ▼
RolesGuard (explicit)            Applied only on endpoints that need it
      │                          Reads @Roles() metadata, checks platformRole
      ▼
ValidationPipe                   Validates & transforms DTO via class-validator
      │                          Strips unknown properties (whitelist: true)
      ▼
Controller method
      │
      ▼
TransformInterceptor             Wraps response: { success: true, data: ..., requestId: ... }
      │
      ▼
HttpExceptionFilter (on error)   Normalises errors: { success: false, error: ..., requestId: ... }
```

**Guard execution order matters.** `ThrottlerGuard` runs before `JwtAuthGuard` — unauthenticated flood traffic is rate-limited before any DB lookup happens.

---

## 6. Authentication System

Authentication is entirely hand-rolled. No third-party auth service is used.

### 6.1 Auth Providers

| Provider | How | Password | Email Verified On |
|---|---|---|---|
| `LOCAL` | Email + password | bcrypt hash (12 rounds) | Email verification token |
| `GOOGLE` | Google OAuth 2.0 via passport | None (nullable) | Auto-set to `true` |

### 6.2 Registration Flow (LOCAL)

```
POST /v1/auth/register
  ├── Check email uniqueness → 409 if taken
  ├── bcrypt.hash(password, 12 rounds)
  ├── INSERT users (provider=LOCAL, isEmailVerified=false)
  ├── INSERT email_verification_tokens (SHA-256 hash, 24h expiry)
  ├── Resend → sendVerifyEmail()
  └── Return { message: 'Check your inbox...' }  (no tokens yet)

POST /v1/auth/verify-email?token=...
  ├── SHA-256 hash lookup in email_verification_tokens
  ├── Check usedAt=null AND expiresAt > now()
  ├── Transaction: mark token used + set isEmailVerified=true
  ├── Resend → sendWelcomeEmail()
  └── Return { message: 'Email verified successfully' }

POST /v1/auth/onboarding  (requires JWT, called after verification)
  ├── Check AuthorProfile does not already exist → 409 if it does
  ├── Generate unique username from displayName (slug + numeric suffix)
  ├── INSERT author_profiles
  └── Return AuthorProfileEntity
```

### 6.3 Login Flow (LOCAL)

```
POST /v1/auth/login
  ├── assertLoginAllowed() — check LoginAttempt.lockedUntil
  ├── findUnique by email → 401 if not found or deletedAt set
  ├── isActive check → 401 with suspension message
  ├── provider=LOCAL check → 401 if Google account tries email login
  ├── bcrypt.compare(password, hash) → recordFailedLogin() on mismatch
  ├── isEmailVerified check → 401 with verification prompt
  ├── resetLoginAttempt()
  ├── createAuthResponse() → accessToken + refreshToken
  └── AuthAuditLog: login_success
```

### 6.4 Google OAuth Flow

```
GET  /v1/auth/google            → Passport redirects to Google consent screen
GET  /v1/auth/google/callback   → Google redirects back with profile

handleGoogleCallback():
  ├── Look up user by email
  │   ├── Not found → INSERT user (provider=GOOGLE, isEmailVerified=true)
  │   ├── Found, no providerId → link account (update providerId)
  │   └── Found, has providerId → direct login
  ├── createAuthResponse()
  └── Return { ...tokens, onboardingRequired: !hasProfile }
```

### 6.5 Token Design

```
Access Token
  - JWT signed with HS256
  - Payload: { sub: userId, email, platformRole }
  - Expiry: configurable (default 15 min)
  - Stateless — no DB lookup on every request
    EXCEPT: JwtStrategy.validate() does ONE DB read per request
            to check isActive + deletedAt (enables instant suspension)

Refresh Token
  - Opaque 32-byte random string (base64url)
  - Stored as SHA-256(token) in refresh_tokens table
  - Expiry: configurable (default 7 days)
  - Rotation: each /auth/refresh issues a new token and revokes the old one
  - Reuse detection: if a revoked token is presented, ALL active tokens
    for that user are immediately revoked (stolen token protection)
```

**Why store only the hash?** If the database is compromised, raw tokens cannot be used.  
**Why is `replacedBy` tracked?** Creates a complete rotation chain for forensic analysis.

### 6.6 Login Lockout

```
LoginAttempt table (one row per identifier, keyed by SHA-256(email.toLowerCase()))

- 5 consecutive failures → lockedUntil = now() + 15 min
- Lockout scope: per identifier only (not per IP)
  Reason: IP-based lockout can be bypassed by rotating IPs. Identifier-scope
  ensures an attacker with multiple IPs cannot bypass the limit.
- ipAddress stored for audit — not used in lockout logic
- Successful login → row deleted (not just counter reset)
```

### 6.7 Auth Audit Log

Every significant auth event is recorded in `auth_audit_logs`:

| Event | When |
|---|---|
| `register` | Successful registration |
| `login_success` | Successful login |
| `login_failed` | Wrong password |
| `login_blocked_suspended` | Login attempt on suspended account |
| `login_blocked_unverified_email` | Login attempt before email verification |
| `google_register` | First Google login (new user) |
| `google_login` | Returning Google user |
| `google_account_linked` | Existing LOCAL account linked to Google |
| `refresh_token_rotated` | Successful token refresh |
| `refresh_token_reuse_detected` | Revoked token presented — all sessions killed |
| `logout` | Refresh token revoked |
| `password_changed` | Successful password change |
| `password_reset_completed` | Successful password reset |
| `forgot_password_requested` | Reset email triggered |
| `email_verified` | Email verification token consumed |
| `verification_email_requested` | Resend verification triggered |

---

## 7. Role-Based Access Control (RBAC)

The system has a **two-tier role hierarchy**. Both tiers are checked independently.

### 7.1 Two-Tier Model

```
Tier 1: PlatformRole (on users table)
  ┌──────────────────┬────────────────────────────────────────┐
  │ user             │ Every registered user. Default.         │
  │ platform_admin   │ Set manually in DB. Never via the UI.   │
  └──────────────────┴────────────────────────────────────────┘

Tier 2: CompanyRole (on company_memberships table — per-company, per-user)
  ┌──────────────────┬────────────────────────────────────────┐
  │ owner            │ Creator of the company. Non-transferable│
  │ author           │ Invited member. Write access to company │
  │                  │ blogs. Cannot edit others' blogs.       │
  └──────────────────┴────────────────────────────────────────┘
```

A single user can simultaneously be:
- An **Independent Author** (PlatformRole.user, no memberships)
- A **Company Owner** of Company A (CompanyRole.owner in company A's membership)
- A **Company Author** in Company B (CompanyRole.author in company B's membership)

### 7.2 PermissionChecker

**Location:** `src/common/permissions/permission-checker.ts`

This is a **pure class with zero I/O dependencies**. No database, no HTTP, no injected services. All RBAC rules live here exclusively.

```typescript
// How services use it:
const membership = await this.companiesRepo.findMembership(companyId, requester.sub);
const companyRole = membership?.role ?? null;  // null = not a member

if (!permissionChecker.canInviteAuthors(requester.platformRole, companyRole)) {
  throw new ForbiddenException('Only company owners can invite authors.');
}
```

The service fetches the membership from the DB, passes both roles as plain values to PermissionChecker, and gets a boolean back. **Zero inline `if (role === 'owner')` checks anywhere else in the codebase.**

### 7.3 Permissions Matrix

| Permission | Independent Author | Company Author | Company Owner | Platform Admin |
|---|---|---|---|---|
| Publish blog (own) | ✅ | ✅ | ✅ | ✅ |
| Publish blog under a company | ❌ | ✅ (member) | ✅ (member) | ✅ |
| Edit own blog | ✅ | ✅ | ✅ | ✅ |
| Edit **any** blog under their company | ❌ | ❌ | ✅ | ✅ |
| Archive own blog | ✅ | ✅ | ✅ | ✅ |
| Archive **any** company blog | ❌ | ❌ | ✅ | ✅ |
| Create a company | ✅ | ✅ | ✅ | ✅ |
| Edit company profile | ❌ | ❌ | ✅ (own) | ✅ |
| Invite authors to company | ❌ | ❌ | ✅ (own) | ✅ |
| Remove authors from company | ❌ | ❌ | ✅ (own) | ✅ |
| Add company milestone | ❌ | ❌ | ✅ (own) | ✅ |
| List all users (`GET /users`) | ❌ | ❌ | ❌ | ✅ |
| Approve tags | ❌ | ❌ | ❌ | ✅ |
| Suspend user accounts | ❌ | ❌ | ❌ | ✅ |

### 7.4 Guard Wiring

```
JwtAuthGuard — registered as APP_GUARD (global)
  Runs on every request.
  Reads @Public() decorator — if present, skips validation entirely.
  Populates request.user = { sub, email, platformRole }

RolesGuard — must be explicitly applied with @UseGuards(RolesGuard)
  Only used on endpoints requiring platformRole checks (e.g., admin-only).
  Reads @Roles(...roles) metadata, compares with request.user.platformRole.
  Does NOT handle company roles — that's done in service methods.
```

**Why is RolesGuard not global?** Company-role checks require DB context (fetching the membership) — they cannot be checked at the guard level without adding DB queries to every request. Service-level checks are the right place for compound (platform + company) role decisions.

---

## 8. Database Design

### 8.1 Tables Summary

| Table | Domain | Purpose |
|---|---|---|
| `users` | Identity | Account identity. Provider, status, platform role. |
| `author_profiles` | Profile | Public display data. 1:1 with users. Created at onboarding. |
| `refresh_tokens` | Auth | Stored SHA-256 hashes. Rotation chain tracked via `replacedBy`. |
| `password_reset_tokens` | Auth | 1-hour expiry. Single-use (`usedAt`). |
| `email_verification_tokens` | Auth | 24-hour expiry. Single-use (`usedAt`). |
| `login_attempts` | Auth | Per-identifier lockout state. Deleted on successful login. |
| `auth_audit_logs` | Auth | Immutable event log. `userId` nullable (pre-auth events). |
| `companies` | Company | Company profile. Aggregate root for memberships, blogs, milestones. |
| `company_memberships` | Company | Per-company, per-user role. Composite unique `(companyId, userId)`. |
| `company_invites` | Company | Email-based invite with 7-day expiry token. |
| `blogs` | Content | Full blog state. `companyId` nullable for independent authors. |
| `blog_tags` | Content | Join table. Composite PK `(blogId, tagId)`. Max 5 per blog (service-enforced). |
| `tags` | Content | Platform-wide topics. `blogCount` is a denormalised cached count. |
| `company_milestones` | Timeline | Build-in-Public entries. Owner-write-only. |
| `seo_metadata` | SEO | Polymorphic cached SEO output. One row per entity. |
| `slug_redirects` | Routing | 301 redirect mappings. Append-only. |

### 8.2 Key Design Decisions

**`users` and `author_profiles` are separate tables**

Identity (email, password, provider) ≠ public profile (username, bio, social links). The `AuthorProfile` is created at onboarding, after email verification. A user with no profile cannot yet be searched by username.

**`password` is nullable on `users`**

Google OAuth users have no password. `String?` rather than an empty string sentinel avoids a whole class of auth bugs.

**`isEmailVerified Boolean` not `emailVerifiedAt DateTime?`**

A boolean is semantically correct — verified is a state, not an event. The event is captured in `auth_audit_logs`. Using a timestamp as a boolean would require `!= null` checks everywhere.

**`isActive Boolean` + `deletedAt DateTime?` co-exist**

`isActive = false` = suspended (reversible, by admin)  
`deletedAt IS NOT NULL` = deleted (irreversible, data retained for billing/legal)  
These are different states and must not be collapsed into one field.

**`LoginAttempt.identifierHash` is unique (not `identifierHash + ipAddress`)**

A composite unique on `(identifierHash, ipAddress)` means an attacker with multiple IP addresses bypasses the lockout entirely. Locking per identifier is the correct scope — one account, one lockout window.

**`tag.blogCount` is a denormalised counter**

Counting `blog_tags` rows on every page load would require a full table scan on a hot path. The counter is maintained synchronously in `BlogsService` (publish/archive/unarchive) and in `BlogSchedulerService` (cron publish). A reconciliation job is planned for Phase 2.

### 8.3 Critical Database Indexes

```sql
-- Auth hot paths
idx on refresh_tokens(userId)
idx on refresh_tokens(expiresAt)
idx on login_attempts(lockedUntil)
idx on auth_audit_logs(userId, event, createdAt)

-- Blog query patterns
idx on blogs(authorId)
idx on blogs(companyId)
idx on blogs(status)                         -- explore page filter
idx on blogs(status, scheduledAt)            -- cron job query
idx on blogs(authorId, status)               -- my published blogs
idx on blogs(companyId, status)              -- company published blogs

-- Tag discovery
idx on tags(isApproved)                      -- filter unapproved from dropdown

-- Company access patterns
idx on company_memberships(companyId)
idx on company_memberships(userId)
unique on company_memberships(companyId, userId) -- named: uq_company_memberships_company_user
idx on company_invites(token)
idx on company_invites(companyId, invitedEmail)
```

---

## 9. Module Dependency Graph

```
AppModule
├── ConfigModule (global)
├── PrismaModule (global)
├── MailModule
├── AuthModule
│   └── imports: UsersModule (for user lookups)
├── UsersModule
├── AuthorProfilesModule
│   └── imports: BlogsModule (for author's published blogs listing)
├── BlogsModule ◄──────────────────────────────────┐
│   └── imports: TagsModule                        │
│   └── imports: CompaniesModule (forwardRef) ─────┤ circular
├── CompaniesModule ───────────────────────────────┘
│   └── imports: MailModule
│   └── imports: BlogsModule (forwardRef)
├── TagsModule
├── DiscoveryModule
│   └── imports: BlogsModule
├── HealthModule
├── ScheduleModule
└── ThrottlerModule
```

### 9.1 The BlogsModule ↔ CompaniesModule Circular Dependency

**Why it exists:**
- `BlogsService` needs `CompaniesRepository` to check if the requester is a company member/owner before editing a company blog
- `CompaniesService` needs `BlogsRepository` to list published blogs for a company's public page

**How it is resolved:**

```typescript
// blogs.module.ts
@Module({
  imports: [TagsModule, forwardRef(() => CompaniesModule)],
  exports: [BlogsService, BlogsRepository],
})

// companies.module.ts
@Module({
  imports: [MailModule, forwardRef(() => BlogsModule)],
  exports: [CompaniesService, CompaniesRepository],
})
```

Both the module `imports` AND the constructor injection must use `forwardRef`:

```typescript
// In BlogsService constructor:
@Inject(forwardRef(() => CompaniesRepository))
private readonly companiesRepo: CompaniesRepository,

// In CompaniesService constructor:
@Inject(forwardRef(() => BlogsRepository))
private readonly blogsRepo: BlogsRepository,
```

**Why only repositories are injected cross-module (not services)?**

Injecting one service into another creates a deeper coupling and risks infinite circular loops. Repositories are simple data-access objects — injecting them cross-module is a deliberate MVP trade-off, documented here. In Phase 2, a shared domain event system would eliminate this coupling entirely.

---

## 10. Scheduling System

Blog scheduling uses **`@nestjs/schedule`** (in-process, no Redis required for MVP).

### 10.1 Architecture

```
@nestjs/schedule (wraps node-cron)
         │
         └── BlogSchedulerService
               @Cron(CronExpression.EVERY_MINUTE)
               publishDueBlogs()
```

### 10.2 Scheduled Publishing Flow

```
Every minute:
  1. SELECT blogs WHERE status='scheduled' AND scheduledAt <= now()
  2. For each due blog:
     a. UPDATE status='published', publishedAt=now(), scheduledAt=null
     b. INCREMENT tag.blogCount for each attached tag
     c. On any error: UPDATE status='publish_failed'
        (author can see the failure in their dashboard and republish manually)
  3. Log results via NestJS Logger
```

### 10.3 Why `@nestjs/schedule` and not BullMQ?

| | @nestjs/schedule | BullMQ (Redis) |
|---|---|---|
| Infrastructure | None | Redis instance required |
| Durability | Lost if server restarts during a tick | Persisted in Redis queue |
| Horizontal scaling | Runs on every instance (needs distributed lock) | Redis handles distribution |
| MVP fit | ✅ Simple, zero infra | ❌ Overkill for MVP |

For Phase 2 (horizontal scaling), migrate to BullMQ with a distributed lock or use `pg_notify` to trigger workers from the database itself.

### 10.4 Blog Status Machine

```
                    ┌──────────────────────────────────────────┐
                    │                  DRAFT                    │
                    │  (default on creation)                    │
                    └──┬────────────────┬───────────────────────┘
                       │ publish        │ schedule
                       ▼                ▼
                  PUBLISHED         SCHEDULED
                       │                │ (cron fires)
                       │ ◄──────────────┘
                       │
                       │ archive         ┌──────────────────┐
                       ▼                 │   PUBLISH_FAILED  │
                   ARCHIVED              │  (cron error)     │
                       │                 └──────────────────┘
                       │ unarchive
                       ▼
                  PUBLISHED  (restore)
```

**Rules:**
- Only `draft` or `scheduled` blogs can be published
- Only `published` or `scheduled` blogs can be archived (drafts must be deleted)
- Archived blogs can be unarchived (restores to `published`, re-increments tag counts)
- `publish_failed` requires manual intervention — author must re-schedule or publish manually
- Blog title is required before publishing or scheduling (enforced in service)
- Slug auto-regeneration on title change only applies to `draft` status (published slugs are immutable)

---

## 11. Email System

### 11.1 Stack

| Layer | Technology | Purpose |
|---|---|---|
| Transport | Resend API | Deliverability, webhooks, domain reputation |
| Templating | React Email + @react-email/render | Type-safe, testable email templates |
| Dev preview | `pnpm email:dev` | Live preview server at localhost:3001 |

### 11.2 Resend Provider Pattern

```typescript
// resend.provider.ts — factory provider
{
  provide: RESEND_CLIENT,
  useFactory: (configService: ConfigService) => {
    const apiKey = configService.get('mail.resendApiKey');
    return apiKey ? new Resend(apiKey) : null;
  },
}
```

If `RESEND_API_KEY` is not set (local dev without email), the provider returns `null` and `MailService` silently logs the email content instead of sending — no crashes in development.

### 11.3 Email Templates

| Template | Trigger | File |
|---|---|---|
| Verify Email | Registration | `src/modules/mail/templates/verify-email.tsx` |
| Welcome | Email verified | `src/modules/mail/templates/welcome-email.tsx` |
| Forgot Password | `/auth/forgot-password` | `src/modules/mail/templates/forgot-password.tsx` |
| Company Invite | Owner invites author | Inline HTML (no React template yet) |

### 11.4 Email Anti-Enumeration

Both `forgotPassword()` and `resendVerification()` always return a generic success message regardless of whether the email exists in the system:

```
"If the account exists, password reset instructions will be sent."
```

The check happens inside — emails are only sent to real accounts — but the response is identical either way.

---

## 12. API Design Conventions

### 12.1 Versioning

All routes are URI-versioned with `/v1/` prefix via NestJS `@Controller({ version: '1' })`.

### 12.2 Response Envelope

Every response (success and error) is wrapped by `TransformInterceptor` / `HttpExceptionFilter`:

```json
// Success
{
  "success": true,
  "data": { ... },
  "requestId": "a3f1bc92-..."
}

// Error
{
  "success": false,
  "error": {
    "statusCode": 409,
    "message": "An account with this email already exists.",
    "error": "Conflict"
  },
  "requestId": "a3f1bc92-..."
}
```

The `requestId` is the `X-Correlation-Id` header value from `CorrelationIdMiddleware`.

### 12.3 Route Ordering Rule

In NestJS, routes within the same controller are matched in declaration order. Static routes must always be declared **before** parameterised routes to prevent shadowing:

```typescript
// CORRECT — static 'me' before '/:id'
@Get('me')     findMe() { ... }
@Get(':id')    findById() { ... }

// WRONG — ':id' would match 'me' first
@Get(':id')    findById() { ... }
@Get('me')     findMe() { ... }   // never reached
```

Affected routes in this codebase:
- `GET /v1/blogs/me` before `GET /v1/blogs/:slug`
- `GET /v1/tags/trending` before `GET /v1/tags/:slug`
- `GET /v1/author-profiles/:username/blogs` before `GET /v1/author-profiles/:username`
- `GET /v1/companies/mine` before `GET /v1/companies/:handle`
- `GET /v1/companies/invites/:token/accept` before `GET /v1/companies/:handle`

### 12.4 Public vs Protected Endpoints

The global `JwtAuthGuard` protects everything by default. To make an endpoint public:

```typescript
@Get('explore')
@Public()      // ← this decorator skips JwtAuthGuard
async explore() { ... }
```

### 12.5 Input Validation

All DTOs use `class-validator` with `ValidationPipe` configured globally:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,        // strip unknown properties
  forbidNonWhitelisted: true,
  transform: true,        // auto-transform types (string → number for query params)
}));
```

Email fields use `@Transform(({ value }) => value.toLowerCase().trim())` to normalise before validation.

---

## 13. Security Hardening

| Measure | Implementation | Why |
|---|---|---|
| HTTP headers | `helmet()` in `main.ts` | XSS, clickjacking, MIME sniffing protection |
| Rate limiting | `ThrottlerGuard` — 100 req/min global | Brute-force + DDoS mitigation |
| Login lockout | 5 failures → 15 min ban, per identifier | Credential stuffing defence |
| Password hashing | bcrypt, 12 rounds | Industry standard; cost factor configurable |
| Token storage | SHA-256 hashes only in DB | Compromised DB cannot yield usable tokens |
| Refresh token reuse | Entire user's session killed on reuse | Stolen token detection |
| JWT live check | `JwtStrategy.validate()` hits DB on every request | Enables instant suspension without waiting for token expiry |
| Input whitelist | `whitelist: true` on `ValidationPipe` | Strips undeclared properties before processing |
| Soft delete | `deletedAt` field; data never physically removed | Audit trail + accidental deletion recovery |
| Anti-enumeration | `forgotPassword` + `resendVerification` always return 200 | Email existence not revealed |
| Google-only accounts | Cannot set password via `/auth/change-password` | Prevents auth confusion attacks |
| Self-invite blocked | `inviteAuthor` checks `dto.email !== requester.email` | Privilege escalation prevention |
| Existing member check | `inviteAuthor` + `acceptInvite` both check membership | Clean error instead of DB constraint crash |

---

## 14. Error Handling

### 14.1 Prisma Error Mapping

`mapPrismaError()` in `src/database/prisma/prisma.exceptions.ts` translates Prisma error codes to NestJS HTTP exceptions:

| Prisma Code | Maps To | Scenario |
|---|---|---|
| `P2002` | `409 ConflictException` | Unique constraint violation (email, slug, handle) |
| `P2025` | `404 NotFoundException` | Record not found on update/delete |
| Others | Re-thrown as-is | Unexpected DB errors surface as 500 |

All `try/catch` blocks in services that write data end with `mapPrismaError(error)`:

```typescript
try {
  return await this.repo.create({ ... });
} catch (error) {
  mapPrismaError(error);  // throws appropriate HTTP exception or re-throws
}
```

### 14.2 Domain Exceptions

Services throw typed NestJS exceptions. Controllers never handle errors — they propagate to `HttpExceptionFilter`.

```
NotFoundException      → 404  (entity not found)
ConflictException      → 409  (duplicate email, handle, pending invite)
ForbiddenException     → 403  (permission check failed)
UnauthorizedException  → 401  (bad credentials, expired token, suspended)
BadRequestException    → 400  (business rule violation, invalid state transition)
```

---

## 15. Configuration & Environment

Config is split into four namespaced slices, merged at boot:

```
app.*      PORT, NODE_ENV, FRONTEND_URL, APP_BASE_URL
auth.*     JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN_DAYS,
           PASSWORD_HASH_ROUNDS, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
           GOOGLE_CALLBACK_URL
database.* DATABASE_URL
mail.*     RESEND_API_KEY, MAIL_FROM, APP_BASE_URL, FRONTEND_URL
```

**Validation on boot** — `src/config/env.validation.ts` uses Joi. If a required variable is missing or has the wrong type, the process exits immediately with a clear error. No runtime surprises from missing config.

```typescript
DATABASE_URL: Joi.string().required(),
JWT_SECRET: Joi.string().min(32).required(),
RESEND_API_KEY: Joi.string().optional(),  // optional — dev can skip email
```

---

## 16. Logging & Observability

### 16.1 Structured Logging

`nestjs-pino` provides structured JSON logging. In development, `pino-pretty` formats output for readability. In production, raw JSON is emitted for log aggregators (Datadog, Loki, CloudWatch).

### 16.2 Correlation IDs

`CorrelationIdMiddleware` generates a UUID for every request and attaches it to:
- `req.correlationId` (for downstream logging)
- `X-Correlation-Id` response header (for client-side debugging)
- The response envelope `requestId` field

### 16.3 What Gets Logged

| System | What | Where |
|---|---|---|
| Auth events | All login/register/token events | `auth_audit_logs` table + Logger |
| Cron job | Publish count, individual blog slugs, failures | `BlogSchedulerService` Logger |
| Mail | Sent/skipped/failed per email type | `MailService` Logger |
| Prisma | Slow queries (configure via PrismaService) | Logger |
| HTTP | Every request (method, url, status, latency) | pino-http auto-instrumentation |

---

## 17. Development Toolchain

| Tool | Purpose | Command |
|---|---|---|
| `pnpm run start:dev` | NestJS hot-reload dev server | — |
| `pnpm run build` | Production build + path alias resolution | — |
| `pnpm run prisma:migrate` | Create + apply a new migration | — |
| `pnpm run prisma:generate` | Regenerate Prisma Client after schema changes | — |
| `pnpm run prisma:studio` | Browse DB via Prisma Studio GUI | — |
| `pnpm run email:dev` | React Email preview server on port 3001 | — |
| `pnpm run lint` | ESLint check | — |
| `pnpm run format` | Prettier format all files | — |
| `pnpm run test:e2e` | Run E2E test suite | — |
| Husky + lint-staged | Pre-commit: ESLint + Prettier on staged files | automatic |

### 17.1 Path Aliases

TypeScript path aliases (`@common/*`, `@modules/*`, `@database/*`) are resolved at compile time by `tsc-alias` (run after `nest build`). The aliases are defined in `tsconfig.json` and mirrored in `tsconfig.build.json`.

---

## 18. Known Trade-offs & Future Work

These are documented decisions, not deficiencies. Each has a recommended upgrade path.

### 18.1 In-Process Cron (no queue)

**Current:** `@nestjs/schedule` runs inside the NestJS process.  
**Risk:** If the server crashes mid-tick, a blog's status is half-updated. Multi-instance deployments would run the cron on every instance.  
**Fix for Phase 2:** Migrate to BullMQ (Redis-backed) or use `SELECT ... FOR UPDATE SKIP LOCKED` with a distributed lock for safe multi-instance scheduling.

### 18.2 Cross-Module Repository Injection

**Current:** `BlogsService` injects `CompaniesRepository` (and vice versa) via `forwardRef`.  
**Risk:** Couples two domain boundaries at the data-access layer.  
**Fix for Phase 2:** Introduce an in-process domain event bus. `BlogPublishedEvent` / `BlogArchivedEvent` decouple tag counts and any future side effects from the service call.

### 18.3 `DiscoveryController` Accesses Repositories Directly

**Current:** `DiscoveryController` injects `BlogsRepository` directly (bypasses service layer).  
**Acceptable because:** Explore page is pure read-only — no business logic, no permission checks, no mutations.  
**Fix for Phase 2:** Introduce `DiscoveryService` to add caching, query composition, and eventually personalisation logic.

### 18.4 `tag.blogCount` Synchronous Denormalisation

**Current:** `blogCount` is updated in-process, synchronously, in `BlogsService` and `BlogSchedulerService`.  
**Risk:** Any code path that bypasses these (e.g. direct DB writes, a missed `archive` code path) causes count drift.  
**Fix for Phase 2:** Event-driven handlers + a periodic reconciliation job (`SELECT COUNT(*) FROM blog_tags GROUP BY tagId`).

### 18.5 Company Invite Email — Inline HTML

**Current:** `sendCompanyInviteEmail()` uses a raw HTML string, not a React Email template.  
**Fix:** Add a `CompanyInviteEmail` React Email template consistent with other email templates.

### 18.6 No Refresh Token Cleanup Job

**Current:** Expired refresh tokens accumulate in `refresh_tokens` indefinitely.  
**Fix for Phase 2:** A nightly cron that `DELETE FROM refresh_tokens WHERE expiresAt < now() - interval '7 days'`.

### 18.7 `@MinDate(new Date())` in `ScheduleBlogDto`

**Current:** The minimum date validator on `scheduledAt` captures `new Date()` at class-load time, not per-request.  
**Impact:** Minimal in practice (class is loaded seconds after boot), but technically incorrect.  
**Fix:** Use a custom validator that calls `new Date()` at validation time.

---

*Last updated: May 2026*  
*Maintained by: Lorestack Engineering*
