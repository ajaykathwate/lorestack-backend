# API Testing Guide — Postman

Base URL: `http://localhost:3001`  
All endpoints are versioned under `/api/v1/`.

---

## Setup

### Postman Environment Variables

Create a Postman environment called **Lorestack Local** with these variables:

| Variable            | Initial Value                   | Description                              |
| ------------------- | ------------------------------- | ---------------------------------------- |
| `base_url`          | `http://localhost:3001/api/v1`  | Base URL                                 |
| `access_token`      | _(empty)_                       | Set automatically after login            |
| `refresh_token`     | _(empty)_                       | Set automatically after login            |
| `user_id`           | _(empty)_                       | Set after login or register              |
| `admin_token`       | _(empty)_                       | Set after logging in as admin            |
| `company_handle`    | _(empty)_                       | Set after creating a company             |
| `company_id`        | _(empty)_                       | Set after creating a company             |
| `blog_slug`         | _(empty)_                       | Set after creating a blog                |
| `blog_id`           | _(empty)_                       | Set after creating a blog                |
| `invite_token`      | _(empty)_                       | Set from DB after sending an invite      |
| `invite_id`         | _(empty)_                       | Set from DB after sending an invite      |
| `author_profile_id` | _(empty)_                       | Set from `GET /author-profiles/me`       |

### Auto-capture tokens (Login test script)

Add this to the **Tests** tab of any login request to auto-fill the env variables:

```javascript
const res = pm.response.json();
if (res.data?.accessToken) {
  pm.environment.set('access_token', res.data.accessToken);
  pm.environment.set('refresh_token', res.data.refreshToken);
}
```

Auto-capture company after creation (add to **Tests** tab of `POST /companies`):

```javascript
const res = pm.response.json();
if (res.data?.handle) {
  pm.environment.set('company_handle', res.data.handle);
  pm.environment.set('company_id', res.data.id);
}
```

Auto-capture blog after creation (add to **Tests** tab of `POST /blogs`):

```javascript
const res = pm.response.json();
if (res.data?.slug) {
  pm.environment.set('blog_slug', res.data.slug);
  pm.environment.set('blog_id', res.data.id);
}
```

---

## Auth Endpoints

### 1. Register

**`POST {{base_url}}/auth/register`**

No auth required.

**Headers**

```
Content-Type: application/json
```

**Body**

```json
{
  "fullName": "Ajay Kathwate",
  "email": "ajay@example.com",
  "password": "Password1"
}
```

**Expected: 201**

```json
{
  "data": {
    "message": "Check your inbox to verify your email."
  }
}
```

**Error cases**

| Scenario         | Change                    | Expected                |
| ---------------- | ------------------------- | ----------------------- |
| Duplicate email  | Same email twice          | `409 Conflict`          |
| Weak password    | `"password": "short"`     | `400 Bad Request`       |
| Missing password | Remove `password` field   | `400 Bad Request`       |
| Invalid email    | `"email": "not-an-email"` | `400 Bad Request`       |
| Rate limited     | Send 6+ times in 60s      | `429 Too Many Requests` |

---

### 2. Verify Email

**`POST {{base_url}}/auth/verify-email`**

No auth required. Token comes from the email link — check server logs or query:

```sql
SELECT token FROM email_verification_tokens ORDER BY created_at DESC LIMIT 1;
```

**Body**

```json
{
  "token": "<token-from-email-link>"
}
```

**Expected: 200**

```json
{
  "data": {
    "message": "Email verified successfully."
  }
}
```

**Error cases**

| Scenario              | Expected           |
| --------------------- | ------------------ |
| Expired token (> 24h) | `401 Unauthorized` |
| Already-used token    | `401 Unauthorized` |
| Garbage token         | `401 Unauthorized` |

---

### 3. Login

**`POST {{base_url}}/auth/login`**

No auth required.

**Body**

```json
{
  "email": "ajay@example.com",
  "password": "Password1"
}
```

**Expected: 200**

```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

Add the test script from Setup to auto-capture tokens.

**Error cases**

| Scenario            | Change                      | Expected                           |
| ------------------- | --------------------------- | ---------------------------------- |
| Email not found     | Unknown email               | `401` with `"No account found..."` |
| Wrong password      | Bad password                | `401` with `"Incorrect password."` |
| Unverified email    | Login before verifying      | `401` with verify prompt           |
| Suspended account   | Admin sets `isActive=false` | `401` with `"suspended"`           |
| Google-only account | Try password login          | `401` with Google prompt           |
| Missing password    | Remove field                | `400 Bad Request`                  |
| Rate limited        | 6+ attempts in 60s          | `429 Too Many Requests`            |

---

### 4. Google OAuth

**`GET {{base_url}}/auth/google`**

Open this URL in a browser — Postman cannot handle the OAuth redirect.

```
http://localhost:3001/api/v1/auth/google
```

Google redirects to the callback which returns the same token shape as login. The callback URL is handled automatically by Passport — do not call it manually.

---

### 5. Onboarding (Create Author Profile)

**`POST {{base_url}}/auth/onboarding`**

Requires JWT. Call after email verification (or immediately after Google OAuth). Can only be completed once.

This endpoint accepts **`multipart/form-data`** — use the **Body → form-data** tab in Postman (not raw JSON).

**Headers**

```
Authorization: Bearer {{access_token}}
```

> Do **not** set `Content-Type` manually — Postman sets it automatically with the correct boundary for form-data.

**Form-data fields**

| Key           | Type | Required | Notes                                                                                        |
| ------------- | ---- | -------- | -------------------------------------------------------------------------------------------- |
| `displayName` | Text | Yes      | Min 2 chars, max 100                                                                         |
| `username`    | Text | No       | 3–50 chars, lowercase letters/numbers/hyphens/underscores, must start with letter or number. Auto-generated from `displayName` if omitted. |
| `avatar`      | File | No       | JPEG, PNG, WebP, or GIF. Max 5 MB. Upload the image file here.                              |

**Expected: 201**

```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "displayName": "Ajay Kathwate",
    "username": "ajay-kathwate",
    "bio": null,
    "avatarUrl": "/uploads/avatars/3f9a...b1.png",
    "expertiseTags": [],
    "createdAt": "2026-05-20T..."
  }
}
```

`avatarUrl` is `null` when no file is uploaded. When uploaded, the URL is relative to the API server (e.g. `http://localhost:3001/uploads/avatars/<filename>`).

`username` is auto-generated from `displayName` (lowercased, hyphenated) when not supplied. Collisions append `-1`, `-2`, etc.

**Error cases**

| Scenario                        | Expected                                   |
| ------------------------------- | ------------------------------------------ |
| No auth header                  | `401 Unauthorized`                         |
| Already onboarded               | `409 Conflict`                             |
| `displayName` missing / < 2 chars | `400 Bad Request`                        |
| `username` already taken        | `409 Conflict`                             |
| `username` has uppercase / spaces | `400 Bad Request`                        |
| File is not an image            | `400 Bad Request`                          |
| File > 5 MB                     | `400 Bad Request` / `413 Payload Too Large`|

---

### 6. Refresh Token

**`POST {{base_url}}/auth/refresh`**

**Body**

```json
{
  "refreshToken": "{{refresh_token}}"
}
```

**Expected: 200** — new access + refresh token pair. Update `{{refresh_token}}` in env after each refresh (rotation is active).

**Error cases**

| Scenario                       | Expected                                                   |
| ------------------------------ | ---------------------------------------------------------- |
| Reused token                   | `401` — triggers revocation of ALL tokens for that user    |
| Expired token                  | `401 Unauthorized`                                         |
| Garbage token                  | `401 Unauthorized`                                         |

---

### 7. Logout

**`POST {{base_url}}/auth/logout`**

**Body**

```json
{
  "refreshToken": "{{refresh_token}}"
}
```

**Expected: 200** — always succeeds even if token is already revoked (no information leakage).

---

### 8. Forgot Password

**`POST {{base_url}}/auth/forgot-password`**

**Body**

```json
{
  "email": "ajay@example.com"
}
```

**Expected: 200** — same response regardless of whether the email exists (anti-enumeration).

Token valid for 60 minutes. Find it with:

```sql
SELECT token FROM password_reset_tokens ORDER BY created_at DESC LIMIT 1;
```

---

### 9. Reset Password

**`POST {{base_url}}/auth/reset-password`**

**Body**

```json
{
  "token": "<token-from-reset-email>",
  "password": "NewPassword1"
}
```

**Expected: 200** — all existing refresh tokens are revoked on success.

**Error cases**

| Scenario               | Expected           |
| ---------------------- | ------------------ |
| Expired token          | `401 Unauthorized` |
| Already-used token     | `401 Unauthorized` |
| Password < 8 chars     | `400 Bad Request`  |
| Google-only account    | `400 Bad Request`  |

---

### 10. Resend Verification Email

**`POST {{base_url}}/auth/resend-verification`**

**Body**

```json
{
  "email": "ajay@example.com"
}
```

**Expected: 200** — same response regardless of email existence. Rate limited to 3/60s.

---

### 11. Change Password

**`POST {{base_url}}/auth/change-password`**

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body**

```json
{
  "currentPassword": "Password1",
  "newPassword": "NewPassword2"
}
```

**Expected: 200** — all refresh tokens revoked on success.

---

## Users Endpoints

### 12. Get Current User (Me)

**`GET {{base_url}}/users/me`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": {
    "id": "uuid",
    "email": "ajay@example.com",
    "provider": "LOCAL",
    "isEmailVerified": true,
    "isActive": true,
    "platformRole": "user",
    "createdAt": "2026-05-20T..."
  }
}
```

`password`, `providerId`, `deletedAt`, `passwordChangedAt` are never returned.

---

### 13. Get User by ID

**`GET {{base_url}}/users/:id`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Error cases**

| Scenario       | Expected           |
| -------------- | ------------------ |
| Unknown UUID   | `404 Not Found`    |
| Non-UUID param | `400 Bad Request`  |

---

### 14. List All Users (Admin only)

**`GET {{base_url}}/users?page=1&limit=20`**

Requires `platform_admin` role — regular users get `403`.

**Headers**

```
Authorization: Bearer {{admin_token}}
```

---

### 15. Update User

**`PATCH {{base_url}}/users/:id`**

Users can update their own account only. Platform admins can update any.

**Body**

```json
{
  "email": "newemail@example.com"
}
```

**Error cases**

| Scenario                        | Expected           |
| ------------------------------- | ------------------ |
| Updating another user's account | `403 Forbidden`    |
| Email already taken             | `409 Conflict`     |

---

### 16. Delete User

**`DELETE {{base_url}}/users/:id`**

Soft-delete — `deletedAt` is set, row is not removed.

**Error cases**

| Scenario                        | Expected           |
| ------------------------------- | ------------------ |
| Deleting another user's account | `403 Forbidden`    |

---

## Author Profiles Endpoints

### 17. Get Own Profile

**`GET {{base_url}}/author-profiles/me`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

Returns `404` if onboarding has not been completed.

---

### 18. Update Own Profile

**`PATCH {{base_url}}/author-profiles/me`**

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body — full example**

```json
{
  "displayName": "Ajay K",
  "username": "ajay-k",
  "bio": "I write about distributed systems and scaling startups.",
  "avatarUrl": "https://example.com/avatar.png",
  "expertiseTags": ["TypeScript", "NestJS", "PostgreSQL"],
  "twitterHandle": "ajaykathwate",
  "linkedinUrl": "https://linkedin.com/in/ajay",
  "githubHandle": "ajaykathwate",
  "websiteUrl": "https://ajay.dev"
}
```

All fields are optional — send only what you want to change.

**Error cases**

| Scenario                     | Expected           |
| ---------------------------- | ------------------ |
| Username already taken       | `409 Conflict`     |
| `bio` > 300 chars            | `400 Bad Request`  |

---

### 19. Get Profile by Username (Public)

**`GET {{base_url}}/author-profiles/:username`**

No auth required.

```
GET {{base_url}}/author-profiles/ajay-kathwate
```

---

### 19a. Get Profile by ID (Public)

**`GET {{base_url}}/author-profiles/by-id/:id`**

Lookup by UUID — useful when the frontend has the `authorId` from a blog response but not the username.

```
GET {{base_url}}/author-profiles/by-id/{{author_profile_id}}
```

**Error cases**

| Scenario        | Expected        |
| --------------- | --------------- |
| Unknown UUID    | `404 Not Found` |

---

## Companies Endpoints

All write endpoints require JWT unless marked public.

### 20. Create Company

**`POST {{base_url}}/companies`**

Any authenticated user can create a company. Creator is automatically made Owner.

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body — minimal**

```json
{
  "name": "Acme Corp",
  "handle": "acme-corp",
  "tagline": "Building the future of developer tooling"
}
```

**Body — full**

```json
{
  "name": "Acme Corp",
  "handle": "acme-corp",
  "tagline": "Building the future of developer tooling",
  "websiteUrl": "https://acme.com",
  "logoUrl": "https://cdn.example.com/logo.png",
  "coverImageUrl": "https://cdn.example.com/cover.png",
  "industry": "dev_tools",
  "stage": "early_stage",
  "techStack": ["TypeScript", "NestJS", "PostgreSQL"],
  "galleryImages": [
    "https://cdn.example.com/office.png",
    "https://cdn.example.com/team.png"
  ],
  "founderSocialLink": "https://twitter.com/founder",
  "isPublic": true
}
```

**Expected: 201**

```json
{
  "data": {
    "id": "uuid",
    "createdByUserId": "uuid",
    "name": "Acme Corp",
    "handle": "acme-corp",
    "tagline": "Building the future of developer tooling",
    "industry": "dev_tools",
    "stage": "early_stage",
    "techStack": ["TypeScript", "NestJS", "PostgreSQL"],
    "galleryImages": ["https://cdn.example.com/office.png", "https://cdn.example.com/team.png"],
    "isPublic": true,
    "createdAt": "2026-05-20T...",
    "updatedAt": "2026-05-20T..."
  }
}
```

**Error cases**

| Scenario             | Change                           | Expected           |
| -------------------- | -------------------------------- | ------------------ |
| Handle taken         | Duplicate handle                 | `409 Conflict`     |
| Invalid handle chars | `"handle": "Acme Corp"`          | `400 Bad Request`  |
| Handle too short     | `"handle": "a"`                  | `400 Bad Request`  |
| Missing name         | Remove `name`                    | `400 Bad Request`  |
| Missing tagline      | Remove `tagline`                 | `400 Bad Request`  |
| Not authenticated    | No auth header                   | `401 Unauthorized` |
| Invalid industry     | `"industry": "invalid_value"`    | `400 Bad Request`  |

---

### 20a. List All Public Companies (Public, Paginated)

**`GET {{base_url}}/companies?page=1&limit=20`**

No auth required. Returns all companies with `isPublic: true`, newest first. Used for the companies directory page.

**Query params (all optional)**

| Param   | Default | Max  |
| ------- | ------- | ---- |
| `page`  | `1`     | —    |
| `limit` | `20`    | `50` |

**Example**

```
GET {{base_url}}/companies
GET {{base_url}}/companies?page=2&limit=10
```

**Expected: 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "name": "Acme Corp",
        "handle": "acme-corp",
        "tagline": "Building the future of developer tooling",
        "logoUrl": "https://cdn.example.com/logo.png",
        "industry": "dev_tools",
        "stage": "early_stage",
        "isPublic": true,
        "createdAt": "2026-05-20T..."
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 7, "hasNextPage": false }
  }
}
```

---

### 21. Get My Companies

**`GET {{base_url}}/companies/mine`**

Returns all companies the authenticated user is a member of (any role).

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "handle": "acme-corp",
      "name": "Acme Corp",
      ...
    }
  ]
}
```

---

### 22. Get Company by Handle (Public)

**`GET {{base_url}}/companies/:handle`**

No auth required.

```
GET {{base_url}}/companies/acme-corp
```

**Error cases**

| Scenario           | Expected        |
| ------------------ | --------------- |
| Handle not found   | `404 Not Found` |

---

### 23. Update Company

**`PATCH {{base_url}}/companies/:handle`**

Requires Owner role or Platform Admin. Company Authors get `403`.

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body — partial update**

```json
{
  "tagline": "New tagline here",
  "stage": "growth",
  "techStack": ["TypeScript", "NestJS", "Redis"],
  "galleryImages": [
    "https://cdn.example.com/office.png",
    "https://cdn.example.com/team.png",
    "https://cdn.example.com/product.png"
  ]
}
```

Note: `handle` cannot be changed via this endpoint (omitted from `UpdateCompanyDto`).

`galleryImages` replaces the entire array on each update — send the full desired list, not a delta. Send `[]` to clear all gallery images.

**Error cases**

| Scenario            | Expected           |
| ------------------- | ------------------ |
| Not owner           | `403 Forbidden`    |
| Company not found   | `404 Not Found`    |

---

### 24. Get Company Members (Public)

**`GET {{base_url}}/companies/:handle/members`**

No auth required. Returns members with denormalized profile data.

**Expected: 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "role": "owner",
      "joinedAt": "2026-05-20T...",
      "displayName": "Ajay Kathwate",
      "username": "ajay-kathwate",
      "avatarUrl": null
    }
  ]
}
```

---

### 25. Remove Member

**`DELETE {{base_url}}/companies/:handle/members/:userId`**

Requires Owner role. Returns `204 No Content` on success.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Error cases**

| Scenario                     | Expected                |
| ---------------------------- | ----------------------- |
| Not owner                    | `403 Forbidden`         |
| Member not in company        | `404 Not Found`         |
| Removing original creator    | `400 Bad Request`       |

---

### 26. Invite Author

**`POST {{base_url}}/companies/:handle/invites`**

Requires Owner role. Sends an invite email and creates a `CompanyInvite` row. Returns `204 No Content`.

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body**

```json
{
  "email": "newauthor@example.com"
}
```

Find the invite token in the DB to use in the next two endpoints:

```sql
SELECT token FROM company_invites ORDER BY id DESC LIMIT 1;
```

**Error cases**

| Scenario                    | Expected           |
| --------------------------- | ------------------ |
| Not owner                   | `403 Forbidden`    |
| Pending invite exists       | `409 Conflict`     |
| Email already a member      | `409 Conflict`     |
| Inviting yourself           | `409 Conflict`     |

---

### 27. Accept Invite

**`POST {{base_url}}/companies/invites/:token/accept`**

Requires JWT. The authenticated user's email must match the invite's `invitedEmail`. Creates a `CompanyMembership(author)` row.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — returns the company object.

**Error cases**

| Scenario                 | Expected           |
| ------------------------ | ------------------ |
| Token not found          | `404 Not Found`    |
| Token expired (> 7 days) | `400 Bad Request`  |
| Email mismatch           | `403 Forbidden`    |
| Already accepted/declined| `400 Bad Request`  |

---

### 28. Decline Invite

**`POST {{base_url}}/companies/invites/:token/decline`**

Requires JWT. Returns `204 No Content`.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Error cases**

| Scenario                 | Expected          |
| ------------------------ | ----------------- |
| Token expired            | `400 Bad Request` |
| Email mismatch           | `403 Forbidden`   |
| Already used             | `400 Bad Request` |

---

### 29. Add Milestone

**`POST {{base_url}}/companies/:handle/milestones`**

Requires Owner role.

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body — minimal**

```json
{
  "type": "launch",
  "headline": "Launched public beta",
  "milestoneDate": "2026-03-15"
}
```

**Body — full**

```json
{
  "type": "user_milestone",
  "headline": "Reached 10,000 users",
  "description": "Organic growth from Product Hunt launch. Zero paid ads.",
  "impactMetric": "10k active users",
  "milestoneDate": "2026-04-01"
}
```

Valid `type` values: `launch`, `user_milestone`, `infra_update`, `funding`, `feature_release`, `bug_fixed`, `partnership`, `hiring`, `experiment`, `other`

**Expected: 201**

```json
{
  "data": {
    "id": "uuid",
    "companyId": "uuid",
    "type": "user_milestone",
    "headline": "Reached 10,000 users",
    "impactMetric": "10k active users",
    "milestoneDate": "2026-04-01T00:00:00.000Z",
    "createdAt": "2026-05-20T..."
  }
}
```

**Error cases**

| Scenario             | Expected           |
| -------------------- | ------------------ |
| Not owner            | `403 Forbidden`    |
| Missing `headline`   | `400 Bad Request`  |
| Missing `type`       | `400 Bad Request`  |
| Invalid `type`       | `400 Bad Request`  |
| `headline` > 100 chars | `400 Bad Request` |

---

### 30. Get Milestones (Public)

**`GET {{base_url}}/companies/:handle/milestones`**

No auth required. Returns milestones newest-first.

```
GET {{base_url}}/companies/acme-corp/milestones
```

---

## Blogs Endpoints

### 31. Create Draft Blog

**`POST {{base_url}}/blogs`**

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body — minimal (draft)**

```json
{
  "title": "How We Scaled to 100k Users",
  "articleType": "scaling_story"
}
```

**Body — full**

```json
{
  "title": "How We Scaled to 100k Users",
  "body": "# Introduction\n\nWe started with a monolith...",
  "articleType": "scaling_story",
  "companyId": "{{company_id}}",
  "summary": "A story about scaling our SaaS from zero to 100k.",
  "coverImageUrl": "https://cdn.example.com/cover.png",
  "seoTitleOverride": "Scaling to 100k Users | Acme Blog",
  "seoDescOverride": "Learn how we scaled our infrastructure step by step.",
  "tags": ["TypeScript", "NestJS", "Scaling"]
}
```

Valid `articleType` values: `engineering_blog`, `architecture_deep_dive`, `case_study`, `scaling_story`, `failure_postmortem`, `ai_experiment`, `founder_note`, `tutorial`, `opinion_essay`, `project_showcase`, `open_source_release`, `other`

**Expected: 201**

```json
{
  "data": {
    "id": "uuid",
    "authorId": "uuid",
    "companyId": "uuid",
    "title": "How We Scaled to 100k Users",
    "slug": "how-we-scaled-to-100k-users",
    "body": "...",
    "articleType": "scaling_story",
    "status": "draft",
    "publishedAt": null,
    "scheduledAt": null,
    "tags": [
      { "id": "uuid", "name": "TypeScript", "slug": "typescript", "isApproved": false }
    ],
    "createdAt": "2026-05-20T...",
    "updatedAt": "2026-05-20T..."
  }
}
```

Slug is auto-generated from the title (lowercase-hyphenated). Collisions append `-2`, `-3`.  
New tag names are created as `isApproved: false`.  
`readingTimeMinutes` is computed from word count (`words / 200`, min 1). Updated on every `PATCH` that changes `body`.

**Error cases**

| Scenario                        | Expected           |
| ------------------------------- | ------------------ |
| Missing `title`                 | `400 Bad Request`  |
| Missing `articleType`           | `400 Bad Request`  |
| Invalid `articleType`           | `400 Bad Request`  |
| `title` > 150 chars             | `400 Bad Request`  |
| `summary` > 300 chars           | `400 Bad Request`  |
| `seoTitleOverride` > 60 chars   | `400 Bad Request`  |
| `seoDescOverride` > 160 chars   | `400 Bad Request`  |
| More than 5 tags                | `400 Bad Request`  |
| `companyId` not a member of     | `403 Forbidden`    |
| `companyId` not found           | `404 Not Found`    |
| Not authenticated               | `401 Unauthorized` |

---

### 32. Get My Blogs (Paginated)

**`GET {{base_url}}/blogs/me?page=1&limit=20`**

Returns ALL of the authenticated user's blogs (drafts, published, archived, scheduled), paginated.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Query params (all optional)**

| Param   | Default | Max |
| ------- | ------- | --- |
| `page`  | `1`     | —   |
| `limit` | `20`    | `50`|

**Expected: 200**

```json
{
  "data": {
    "data": [ ...blog summary objects... ],
    "meta": { "page": 1, "limit": 20, "total": 5, "hasNextPage": false }
  }
}
```

Summaries omit `body`, `seoTitleOverride`, and `seoDescOverride`.

---

### 32a. Get My Blog Stats

**`GET {{base_url}}/blogs/me/stats`**

Returns blog counts broken down by status for the authenticated user.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": {
    "draft": 2,
    "published": 5,
    "scheduled": 1,
    "archived": 0
  }
}
```

---

### 32b. Get Own Blog by Slug — Any Status (Owner only)

**`GET {{base_url}}/blogs/me/:slug`**

Returns the full blog regardless of status (`draft`, `scheduled`, `published`, `archived`). Only the blog's author can access this. Used by the draft editor to load existing content.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Example**

```
GET {{base_url}}/blogs/me/how-we-scaled-to-100k-users
```

**Expected: 200** — full `BlogEntity` including `body`, `seoTitleOverride`, `seoDescOverride` (same shape as section 33).

```json
{
  "data": {
    "id": "uuid",
    "authorId": "uuid",
    "title": "How We Scaled to 100k Users",
    "slug": "how-we-scaled-to-100k-users",
    "body": "# Introduction\n\nFull content here...",
    "status": "draft",
    "seoTitleOverride": null,
    "seoDescOverride": null,
    "tags": [...],
    "publishedAt": null,
    "scheduledAt": null,
    "createdAt": "2026-05-20T...",
    "updatedAt": "2026-05-20T..."
  }
}
```

**Difference from `GET /blogs/:slug` (section 33):** That endpoint is public but only returns `published` blogs. This endpoint requires auth, returns **any status**, and only works if the blog belongs to the authenticated user.

**Error cases**

| Scenario                          | Expected           |
| --------------------------------- | ------------------ |
| Slug not found                    | `404 Not Found`    |
| Blog belongs to a different user  | `404 Not Found`    |
| No auth header                    | `401 Unauthorized` |

---

### 33. Get Published Blog by Slug (Public)

**`GET {{base_url}}/blogs/:slug`**

No auth required. Only returns blogs with `status: "published"`.

```
GET {{base_url}}/blogs/how-we-scaled-to-100k-users
```

**Error cases**

| Scenario                    | Expected        |
| --------------------------- | --------------- |
| Slug not found              | `404 Not Found` |
| Blog exists but not published | `404 Not Found` |

---

### 34. Update Blog

**`PATCH {{base_url}}/blogs/:slug`**

Blog author or company owner can edit. All fields are optional.

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body**

```json
{
  "title": "Updated Title",
  "body": "# Updated content\n\nNew body here...",
  "summary": "Updated summary.",
  "tags": ["TypeScript", "PostgreSQL"]
}
```

Note: the slug is **never** changed on update — it is fixed at creation time for all statuses. This ensures URLs are stable even when drafts are renamed.

**Error cases**

| Scenario                        | Expected           |
| ------------------------------- | ------------------ |
| Not author or company owner     | `403 Forbidden`    |
| Blog not found                  | `404 Not Found`    |
| More than 5 tags                | `400 Bad Request`  |

---

### 35. Delete Draft Blog

**`DELETE {{base_url}}/blogs/:slug`**

Permanent deletion. Only the author can delete. Only drafts can be deleted (published/archived blogs must be archived via `POST /:slug/archive`).

Returns `204 No Content`.

**Error cases**

| Scenario                        | Expected           |
| ------------------------------- | ------------------ |
| Not author                      | `403 Forbidden`    |
| Blog not in draft status        | `400 Bad Request`  |

---

### 36. Publish Blog

**`POST {{base_url}}/blogs/:slug/publish`**

Transitions `draft` or `scheduled` → `published`. Sets `publishedAt` to now. Increments `blogCount` on all attached tags.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — blog with `"status": "published"` and `publishedAt` set.

**Error cases**

| Scenario                      | Expected           |
| ----------------------------- | ------------------ |
| Blog already published        | `400 Bad Request`  |
| Blog has no title             | `400 Bad Request`  |
| Not author or company owner   | `403 Forbidden`    |

---

### 37. Schedule Blog

**`POST {{base_url}}/blogs/:slug/schedule`**

Sets blog to `scheduled` status with a future publish datetime.

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body**

```json
{
  "scheduledAt": "2026-07-01T09:00:00.000Z",
  "scheduledTimezone": "Asia/Kolkata"
}
```

`scheduledAt` must be in the future. `scheduledTimezone` defaults to `UTC` if omitted.

**Expected: 200** — blog with `"status": "scheduled"` and `scheduledAt` set.

**Error cases**

| Scenario                      | Expected           |
| ----------------------------- | ------------------ |
| `scheduledAt` in the past     | `400 Bad Request`  |
| Blog already published        | `400 Bad Request`  |
| Blog has no title             | `400 Bad Request`  |
| Not author or company owner   | `403 Forbidden`    |

---

### 38. Archive Blog

**`POST {{base_url}}/blogs/:slug/archive`**

Hides the blog from all public endpoints. Author or company owner can archive. Decrements `blogCount` on tags if blog was `published`.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — blog with `"status": "archived"`.

**Error cases**

| Scenario                    | Expected           |
| --------------------------- | ------------------ |
| Blog already archived       | `400 Bad Request`  |
| Blog is a draft             | `400 Bad Request`  |
| Not author or company owner | `403 Forbidden`    |

---

### 39. Unarchive Blog

**`POST {{base_url}}/blogs/:slug/unarchive`**

Restores archived blog back to `published`. Re-increments tag `blogCount`.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — blog with `"status": "published"`.

**Error cases**

| Scenario            | Expected           |
| ------------------- | ------------------ |
| Blog not archived   | `400 Bad Request`  |
| Not author or owner | `403 Forbidden`    |

---

## Tags Endpoints

All tags endpoints are public (no auth required).

### 40. List Approved Tags

**`GET {{base_url}}/tags`**

Returns all approved tags ordered by `blogCount` descending. Use for the tag autocomplete in the blog editor.

**Expected: 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "TypeScript",
      "slug": "typescript",
      "description": null,
      "blogCount": 42,
      "isApproved": true,
      "createdAt": "2026-05-20T..."
    }
  ]
}
```

---

### 41. Get Tag by Slug

**`GET {{base_url}}/tags/:slug`**

```
GET {{base_url}}/tags/typescript
```

**Error cases**

| Scenario       | Expected        |
| -------------- | --------------- |
| Slug not found | `404 Not Found` |

---

### 42. Approve Tag (Admin only)

**`POST {{base_url}}/tags/:id/approve`**

Requires `platform_admin` role. Marks a tag as approved so it appears in the `GET /tags` autocomplete for blog editors.

New tags created inline by authors have `isApproved: false` and are hidden from autocomplete until approved here.

**Headers**

```
Authorization: Bearer {{admin_token}}
```

**Path param:** the tag's UUID (get from `GET /tags` response or DB query below)

```sql
SELECT id, name, is_approved FROM tags ORDER BY created_at DESC;
```

**Expected: 200**

```json
{
  "data": {
    "id": "uuid",
    "name": "TypeScript",
    "slug": "typescript",
    "blogCount": 3,
    "isApproved": true,
    "createdAt": "2026-05-20T..."
  }
}
```

**Error cases**

| Scenario           | Expected           |
| ------------------ | ------------------ |
| Regular user token | `403 Forbidden`    |
| No auth            | `401 Unauthorized` |
| Invalid UUID param | `400 Bad Request`  |
| Tag not found      | `404 Not Found`    |

---

## Discovery Endpoints

All discovery endpoints are public (no auth required).

### 43. Explore — Browse All Published Blogs (Paginated)

**`GET {{base_url}}/explore`**

Filterable, paginated listing of all published blogs. Response shape changed to include `meta` for pagination.

**Query params (all optional)**

| Param       | Type     | Values                                  | Example              |
| ----------- | -------- | --------------------------------------- | -------------------- |
| `type`      | enum     | Any `ArticleType` value                 | `?type=tutorial`     |
| `tag`       | string   | Tag slug                                | `?tag=typescript`    |
| `companyId` | UUID     | Company UUID                            | `?companyId=uuid`    |
| `dateRange` | string   | `week`, `month`, `6months`, `all`       | `?dateRange=month`   |
| `sort`      | string   | `newest` (default), `oldest`            | `?sort=oldest`       |
| `page`      | number   | Default `1`                             | `?page=2`            |
| `limit`     | number   | Default `20`, max `50`                  | `?limit=10`          |

**Example requests**

```
GET {{base_url}}/explore
GET {{base_url}}/explore?type=tutorial&tag=typescript&sort=oldest
GET {{base_url}}/explore?dateRange=week&type=case_study
GET {{base_url}}/explore?companyId=some-uuid&page=2&limit=10
```

**Expected: 200**

```json
{
  "data": {
    "data": [ ...blog summary objects... ],
    "meta": { "page": 1, "limit": 20, "total": 47, "hasNextPage": true }
  }
}
```

**Error cases**

| Scenario                  | Expected          |
| ------------------------- | ----------------- |
| Invalid `type` enum value | `400 Bad Request` |
| Invalid `companyId` UUID  | `400 Bad Request` |
| `limit` > 50              | `400 Bad Request` |

---

### 43a. Trending Blogs

**`GET {{base_url}}/explore/trending?limit=5`**

Returns the most-viewed published blogs from the past 7 days. Used for the homepage trending section.

```
GET {{base_url}}/explore/trending
GET {{base_url}}/explore/trending?limit=10
```

**Expected: 200** — array of blog summary objects ordered by view count descending.

---

### 44. Trending Tags

**`GET {{base_url}}/tags/trending`**

Returns top 10 approved tags by `blogCount`. Use for homepage tag pills.

**Expected: 200** — array of up to 10 tag objects.

---

## Author Published Blogs Endpoint

### 45. Get Author's Published Blogs (Public, Paginated)

**`GET {{base_url}}/author-profiles/:username/blogs?page=1&limit=20&sort=newest`**

No auth required. Paginated list of published blogs for an author. Used to populate the blog list on the public `/author/[username]` page.

```
GET {{base_url}}/author-profiles/ajay-kathwate/blogs
GET {{base_url}}/author-profiles/ajay-kathwate/blogs?sort=oldest&limit=10
```

**Query params (all optional)**

| Param   | Default   | Notes                     |
| ------- | --------- | ------------------------- |
| `page`  | `1`       | —                         |
| `limit` | `20`      | —                         |
| `sort`  | `newest`  | `newest` or `oldest`      |

**Expected: 200**

```json
{
  "data": {
    "data": [ ...blog summary objects... ],
    "meta": { "page": 1, "limit": 20, "total": 8, "hasNextPage": false }
  }
}
```

**Error cases**

| Scenario           | Expected        |
| ------------------ | --------------- |
| Username not found | `404 Not Found` |

---

## Company Published Blogs Endpoint

### 46. Get Company's Published Blogs (Public, Paginated)

**`GET {{base_url}}/companies/:handle/blogs?page=1&limit=20&sort=newest`**

No auth required. Paginated published blogs for a company. Used to populate the **Blogs tab** on the public `/company/[handle]` page.

```
GET {{base_url}}/companies/acme-corp/blogs
GET {{base_url}}/companies/acme-corp/blogs?sort=oldest&page=2&limit=10
```

**Query params (all optional)**

| Param   | Default   | Notes                |
| ------- | --------- | -------------------- |
| `page`  | `1`       | —                    |
| `limit` | `20`      | —                    |
| `sort`  | `newest`  | `newest` or `oldest` |

**Expected: 200**

```json
{
  "data": {
    "data": [ ...blog summary objects... ],
    "meta": { "page": 1, "limit": 20, "total": 12, "hasNextPage": false }
  }
}
```

**Error cases**

| Scenario           | Expected        |
| ------------------ | --------------- |
| Handle not found   | `404 Not Found` |

---

### 46a. Get Company by ID (Public)

**`GET {{base_url}}/companies/by-id/:id`**

Lookup by UUID — useful when you have a company UUID but not the handle.

```
GET {{base_url}}/companies/by-id/{{company_id}}
```

---

### 46b. Get Featured Companies (Public)

**`GET {{base_url}}/companies/featured?limit=6`**

Returns companies with `featured: true`, newest first. Used for the homepage featured section.

```
GET {{base_url}}/companies/featured
GET {{base_url}}/companies/featured?limit=3
```

**Expected: 200** — array of company objects. Empty array if no featured companies exist.

> To feature a company, set `featured = true` in the DB:
> ```sql
> UPDATE companies SET featured = true WHERE handle = 'stackpilot';
> ```

---

### 46c. List Pending Invites (Owner only)

**`GET {{base_url}}/companies/:handle/invites`**

Returns all pending invites for the company. Requires Owner role.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "invitedEmail": "newauthor@example.com",
      "status": "pending",
      "expiresAt": "2026-05-28T...",
      "token": "abc123..."
    }
  ]
}
```

---

### 46d. Revoke Invite (Owner only)

**`DELETE {{base_url}}/companies/:handle/invites/:inviteId`**

Permanently deletes the invite. The invited user can no longer accept it. Returns `204 No Content`.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Error cases**

| Scenario         | Expected           |
| ---------------- | ------------------ |
| Not owner        | `403 Forbidden`    |
| Invite not found | `404 Not Found`    |

---

### 46e. Resend Invite (Owner only)

**`POST {{base_url}}/companies/:handle/invites/:inviteId/resend`**

Creates a new invite (with a fresh 7-day expiry) and sends a new email. The old invite is deleted. Returns `204 No Content`.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Error cases**

| Scenario               | Expected           |
| ---------------------- | ------------------ |
| Not owner              | `403 Forbidden`    |
| Invite not found       | `404 Not Found`    |
| Invite not pending     | `400 Bad Request`  |

---

## Search Endpoint

### 47. Search (Public)

**`GET {{base_url}}/search?q=typescript&limit=10`**

Full-text search across blogs, companies, and authors. Returns up to `limit` results per type. Use the `type` param to search a single category only (faster, fewer results to parse).

```
GET {{base_url}}/search?q=typescript
GET {{base_url}}/search?q=nestjs&limit=5
GET {{base_url}}/search?q=ajay&type=authors
GET {{base_url}}/search?q=acme&type=companies
GET {{base_url}}/search?q=scaling&type=articles
```

**Query params**

| Param   | Required | Default | Notes                                              |
| ------- | -------- | ------- | -------------------------------------------------- |
| `q`     | Yes      | —       | 1–100 chars                                        |
| `limit` | No       | `10`    | Max per type, 1–50                                 |
| `type`  | No       | `all`   | `all`, `articles`, `authors`, `companies` — when set, only that category runs; others return `[]` |

**Expected: 200 (type=all)**

```json
{
  "data": {
    "blogs": [
      {
        "id": "uuid",
        "title": "TypeScript Tips",
        "slug": "typescript-tips",
        "summary": "...",
        "articleType": "tutorial",
        "readingTimeMinutes": 5,
        "publishedAt": "2026-05-20T...",
        "authorProfile": { "displayName": "Ajay K", "username": "ajay-k", "avatarUrl": null },
        "company": null,
        "tags": [{ "id": "uuid", "name": "TypeScript", "slug": "typescript" }]
      }
    ],
    "companies": [
      {
        "id": "uuid",
        "name": "Acme Corp",
        "handle": "acme-corp",
        "tagline": "...",
        "logoUrl": null,
        "industry": "dev_tools",
        "stage": "early_stage"
      }
    ],
    "authors": [
      {
        "id": "uuid",
        "displayName": "Ajay K",
        "username": "ajay-k",
        "avatarUrl": null,
        "bio": "...",
        "expertiseTags": ["TypeScript", "NestJS"]
      }
    ]
  }
}
```

**Expected: 200 (type=authors)** — `blogs` and `companies` are `[]`, only `authors` is populated.

**Error cases**

| Scenario              | Expected          |
| --------------------- | ----------------- |
| `q` missing           | `400 Bad Request` |
| `q` > 100 chars       | `400 Bad Request` |
| Invalid `type` value  | `400 Bad Request` |
| `limit` > 50          | `400 Bad Request` |

---

## Follow Endpoints

All follow endpoints require JWT.

### 48. Follow an Author

**`POST {{base_url}}/author-profiles/:id/follow`**

`id` is the `AuthorProfile.id` (UUID), not the userId or username.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": { "followersCount": 1 }
}
```

**Error cases**

| Scenario             | Expected           |
| -------------------- | ------------------ |
| Already following    | `409 Conflict`     |
| Following yourself   | `409 Conflict`     |
| Profile not found    | `404 Not Found`    |

---

### 49. Unfollow an Author

**`DELETE {{base_url}}/author-profiles/:id/follow`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "followersCount": 0 }`

**Error cases**

| Scenario          | Expected        |
| ----------------- | --------------- |
| Not following     | `404 Not Found` |

---

### 50. Follow a Company

**`POST {{base_url}}/companies/:id/follow`**

`id` is the Company UUID (not the handle).

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "followersCount": 1 }`

**Error cases**

| Scenario          | Expected           |
| ----------------- | ------------------ |
| Already following | `409 Conflict`     |
| Company not found | `404 Not Found`    |

---

### 51. Unfollow a Company

**`DELETE {{base_url}}/companies/:id/follow`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "followersCount": 0 }`

---

## Analytics Endpoints

### 52. Record Blog View (Public)

**`POST {{base_url}}/blogs/:slug/view`**

Records a view for a published blog. No auth required — IP is hashed for deduplication. Call this when a reader opens a blog post. Optionally pass session context.

```
POST {{base_url}}/blogs/how-we-scaled-to-100k-users/view
```

**Body (all fields optional)**

```json
{
  "sessionId": "sess_abc123",
  "source": "explore",
  "referrer": "https://twitter.com",
  "device": "mobile"
}
```

Valid `source` values: `explore`, `search`, `direct`, `tag`, `profile`
Valid `device` values: `mobile`, `desktop`, `tablet`

**Expected: 200** — `{ "recorded": true }`

**Error cases**

| Scenario              | Expected        |
| --------------------- | --------------- |
| Slug not found        | `404 Not Found` |
| Blog not published    | `404 Not Found` |

---

### 53. Get Blog Analytics (Author only)

**`GET {{base_url}}/blogs/:slug/analytics`**

Returns view stats for a blog. Only the blog's author can access this.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": {
    "totalViews": 124,
    "last30Days": 87,
    "last7Days": 23
  }
}
```

**Error cases**

| Scenario       | Expected        |
| -------------- | --------------- |
| Not the author | `404 Not Found` |

---

### 54. Get Company Analytics (Owner only)

**`GET {{base_url}}/companies/:handle/analytics`**

Returns aggregate analytics for a company. Only company owners can access this.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": {
    "totalBlogs": 8,
    "publishedBlogs": 6,
    "totalViews": 412,
    "totalFollowers": 34
  }
}
```

**Error cases**

| Scenario   | Expected        |
| ---------- | --------------- |
| Not owner  | `404 Not Found` |

---

## Notifications Endpoints

All notifications endpoints require JWT.

### 55. Get My Notifications (Paginated)

**`GET {{base_url}}/notifications?page=1&limit=20`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "type": "follow",
        "message": "Someone followed you.",
        "isRead": false,
        "metadata": null,
        "createdAt": "2026-05-21T..."
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 3, "hasNextPage": false }
  }
}
```

---

### 56. Get Unread Count

**`GET {{base_url}}/notifications/unread-count`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "data": { "count": 3 } }`

---

### 57. Mark Notification as Read

**`PATCH {{base_url}}/notifications/:id/read`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — the updated notification with `isRead: true`.

**Error cases**

| Scenario              | Expected        |
| --------------------- | --------------- |
| Notification not found or belongs to different user | `404 Not Found` |

---

### 58. Mark All Notifications as Read

**`POST {{base_url}}/notifications/read-all`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "data": { "message": "All notifications marked as read." } }`

---

## Tag Follow Endpoints

All tag follow endpoints require JWT.

### 59. Follow a Tag

**`POST {{base_url}}/tags/:id/follow`**

`id` is the Tag UUID (get from `GET /tags` or `GET /tags/:slug`).

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "followersCount": 1 }`

**Error cases**

| Scenario          | Expected           |
| ----------------- | ------------------ |
| Already following | `409 Conflict`     |
| Tag not found     | `404 Not Found`    |

---

### 60. Unfollow a Tag

**`DELETE {{base_url}}/tags/:id/follow`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "followersCount": 0 }`

**Error cases**

| Scenario      | Expected        |
| ------------- | --------------- |
| Not following | `404 Not Found` |

---

## Follow List Endpoints

All follow list endpoints require JWT.

### 60a. Get My Followers (People Who Follow Me)

**`GET {{base_url}}/me/followers/authors`**

Returns the `AuthorProfile` objects of users who follow the authenticated user. Ordered newest-follower first.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "displayName": "Jane Dev",
      "username": "jane-dev",
      "avatarUrl": "https://cdn.example.com/jane.png",
      "bio": "...",
      "expertiseTags": ["Go", "Kubernetes"],
      "createdAt": "2026-05-20T..."
    }
  ]
}
```

Returns `[]` if the authenticated user hasn't completed onboarding (no `AuthorProfile` exists yet) or has no followers.

> Note: `GET /me/followers/companies` does **not** exist. The data model only supports users following companies, not companies following users.

---

### 60b. Get Authors I Follow

**`GET {{base_url}}/me/following/authors`**

Returns `AuthorProfile` objects for all authors the authenticated user follows. Ordered most-recently-followed first.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "displayName": "Ajay K",
      "username": "ajay-k",
      "avatarUrl": null,
      "bio": "...",
      "expertiseTags": ["TypeScript"],
      "createdAt": "2026-05-20T..."
    }
  ]
}
```

Returns `[]` if not following any authors.

---

### 60c. Get Companies I Follow

**`GET {{base_url}}/me/following/companies`**

Returns company objects for all companies the authenticated user follows. Ordered most-recently-followed first.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Acme Corp",
      "handle": "acme-corp",
      "tagline": "Building the future of developer tooling",
      "logoUrl": null,
      "industry": "dev_tools",
      "stage": "early_stage",
      "createdAt": "2026-05-20T..."
    }
  ]
}
```

Returns `[]` if not following any companies.

---

### 60d. Get Tags I Follow

**`GET {{base_url}}/me/following/tags`**

Returns tag objects for all tags the authenticated user follows. Ordered most-recently-followed first.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "TypeScript",
      "slug": "typescript",
      "blogCount": 42,
      "isApproved": true,
      "createdAt": "2026-05-20T..."
    }
  ]
}
```

Returns `[]` if not following any tags.

---

## Engagement Endpoints

Likes and saves require JWT. Shares and read sessions are public (auth optional — pass token to attribute to user).

### 61. Like a Blog

**`POST {{base_url}}/blogs/:slug/like`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "likesCount": 1 }`

**Error cases**

| Scenario           | Expected           |
| ------------------ | ------------------ |
| Already liked      | `409 Conflict`     |
| Blog not published | `404 Not Found`    |

---

### 62. Unlike a Blog

**`DELETE {{base_url}}/blogs/:slug/like`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "likesCount": 0 }`

**Error cases**

| Scenario    | Expected        |
| ----------- | --------------- |
| Not liked   | `404 Not Found` |

---

### 63. Save (Bookmark) a Blog

**`POST {{base_url}}/blogs/:slug/save`**

Bookmarks a blog for later reading.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "savesCount": 1 }`

**Error cases**

| Scenario      | Expected           |
| ------------- | ------------------ |
| Already saved | `409 Conflict`     |

---

### 64. Unsave a Blog

**`DELETE {{base_url}}/blogs/:slug/save`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — `{ "savesCount": 0 }`

---

### 65. Record a Share

**`POST {{base_url}}/blogs/:slug/share`**

No auth required. Pass a token to attribute the share to a user. The `channel` field identifies the share destination.

**Body (all optional)**

```json
{
  "channel": "twitter"
}
```

Valid `channel` values: `twitter`, `linkedin`, `reddit`, `copy_link`, `other`

**Expected: 200** — `{ "sharesCount": 1 }`

---

### 66. Update Read Session

**`POST {{base_url}}/blogs/:slug/read-session`**

Tracks reading progress. Call periodically while reading (e.g., every 30s on scroll events and on page unload). Uses `sessionId` as an upsert key — each unique session updates the same row.

No auth required — pass token to attribute session to a user.

**Body**

```json
{
  "sessionId": "sess_abc123",
  "maxScrollDepth": 65,
  "readDurationSeconds": 180
}
```

| Field                | Required | Notes                                                              |
| -------------------- | -------- | ------------------------------------------------------------------ |
| `sessionId`          | Yes      | Client-generated string, max 64 chars. Use `nanoid()` or similar. |
| `maxScrollDepth`     | Yes      | 0–100. How far down the page the user has scrolled.               |
| `readDurationSeconds`| Yes      | Total active seconds spent on the page.                            |
| `completed`          | No       | Defaults to `true` when `maxScrollDepth >= 80`.                   |

**Expected: 200** — `{ "recorded": true }`

**Error cases**

| Scenario          | Expected        |
| ----------------- | --------------- |
| Blog not published | `404 Not Found` |

---

### 67. Get Blog Engagement Counters (Public)

**`GET {{base_url}}/blogs/:slug/engagement`**

Returns pre-aggregated engagement counters for a blog. Updated every 10 minutes by the background aggregation job.

```
GET {{base_url}}/blogs/how-we-scaled-to-100k-users/engagement
```

**Expected: 200**

```json
{
  "data": {
    "totalViews": 1240,
    "uniqueViews": 892,
    "likesCount": 47,
    "savesCount": 31,
    "sharesCount": 12,
    "avgCompletionRate": 0.71,
    "trendingScore": 84.3
  }
}
```

Counters are `0` for a blog with no activity yet (counters row not yet created by cron).

---

### 68. Get My Engagement Status

**`GET {{base_url}}/blogs/:slug/my-engagement`**

Returns whether the authenticated user has liked or saved a specific blog.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": {
    "isLiked": true,
    "isSaved": false
  }
}
```

---

### 68a. Get My Saved Blogs (Paginated)

**`GET {{base_url}}/me/saved?page=1&limit=20`**

Returns blog summaries for all blogs the authenticated user has bookmarked, newest-saved first.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Query params (all optional)**

| Param   | Default | Max  |
| ------- | ------- | ---- |
| `page`  | `1`     | —    |
| `limit` | `20`    | —    |

**Example**

```
GET {{base_url}}/me/saved
GET {{base_url}}/me/saved?page=2&limit=10
```

**Expected: 200**

```json
{
  "data": {
    "data": [
      {
        "id": "uuid",
        "title": "How We Scaled to 100k Users",
        "slug": "how-we-scaled-to-100k-users",
        "summary": "...",
        "articleType": "scaling_story",
        "readingTimeMinutes": 8,
        "status": "published",
        "publishedAt": "2026-05-20T...",
        "likesCount": 47,
        "savesCount": 31,
        "viewsCount": 1240,
        "authorProfile": { "displayName": "Ajay K", "username": "ajay-k", "avatarUrl": null },
        "company": null,
        "tags": [{ "id": "uuid", "name": "TypeScript", "slug": "typescript" }]
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

Returns `{ data: [], total: 0, page: 1, limit: 20 }` if the user has no saved blogs.

---

### 69. Get Homepage Payload

**`GET {{base_url}}/home`**

Public. Returns an aggregated homepage payload.

**Headers**

None required.

**Expected: 200**

```json
{
  "data": {
    "featuredArticle": {
      "id": "...",
      "title": "The highest-trending published article",
      "slug": "...",
      "summary": "...",
      "articleType": "architecture_deep_dive",
      "authorProfile": { "displayName": "Ajay K", "username": "ajay-k", "avatarUrl": null },
      "company": null,
      "tags": [],
      "readingTimeMinutes": 8,
      "publishedAt": "2026-05-20T10:00:00.000Z"
    },
    "trendingArticles": [
      { "id": "...", "title": "...", "slug": "...", "authorProfile": { ... }, "tags": [...] }
    ],
    "recentDeepDives": [
      { "id": "...", "title": "...", "articleType": "architecture_deep_dive", ... }
    ],
    "trendingTags": [
      { "id": "...", "name": "System Design", "slug": "system-design", "blogCount": 14 }
    ],
    "stats": {
      "totalPublishedArticles": 42,
      "articlesPublishedThisWeek": 5,
      "companiesActivelyPublishing": 3
    }
  }
}
```

**Notes:**
- `featuredArticle` is the blog with the highest `trendingScore` in `blog_engagement_counters`. Returns `null` if no published articles exist.
- `trendingArticles` are the next top 5 by `trendingScore`, excluding the featured article.
- `recentDeepDives` are the 5 most recently published `architecture_deep_dive` articles.
- `trendingTags` are the top 10 approved tags by `blogCount`.
- `stats` is a quick snapshot — use `GET /stats` for the full breakdown.

---

### 70. Get Platform Stats

**`GET {{base_url}}/stats`**

Public. Returns platform-level publishing and engagement statistics.

**Headers**

None required.

**Expected: 200**

```json
{
  "data": {
    "totalPublishedArticles": 42,
    "articlesPublishedThisWeek": 5,
    "newDeepDivesThisWeek": 2,
    "avgReadCompletion": 0.61,
    "companiesActivelyPublishing": 3,
    "totalAuthors": 18
  }
}
```

**Field descriptions:**

| Field | Description |
|---|---|
| `totalPublishedArticles` | All-time count of published blogs |
| `articlesPublishedThisWeek` | Published in the last 7 days |
| `newDeepDivesThisWeek` | `architecture_deep_dive` articles published in last 7 days |
| `avgReadCompletion` | Average `avgCompletionRate` across all `blog_engagement_counters` rows (0.0–1.0) |
| `companiesActivelyPublishing` | Companies with at least one article published in the last 7 days |
| `totalAuthors` | Count of author profiles created |

---

### 71. Get Article Types

**`GET {{base_url}}/article-types`**

Public. Returns all supported article types with human-readable labels and descriptions. Useful for populating dropdowns in a blog editor.

**Headers**

None required.

**Expected: 200**

```json
{
  "data": [
    { "type": "engineering_blog", "label": "Engineering Blog", "description": "General engineering articles covering tools, practices, and day-to-day technical work." },
    { "type": "architecture_deep_dive", "label": "Architecture Deep Dive", "description": "In-depth exploration of system design decisions, trade-offs, and architectural patterns." },
    { "type": "case_study", "label": "Case Study", "description": "Real-world problem → solution narratives with measurable outcomes." },
    { "type": "scaling_story", "label": "Scaling Story", "description": "How a system or team was grown to handle increased load, users, or complexity." },
    { "type": "failure_postmortem", "label": "Failure Postmortem", "description": "Honest retrospectives on incidents, outages, or failed experiments — and what was learned." },
    { "type": "ai_experiment", "label": "AI Experiment", "description": "Hands-on exploration of AI/ML models, integrations, or applied research." },
    { "type": "founder_note", "label": "Founder's Note", "description": "Perspective from company leadership on product direction, culture, or lessons learned." },
    { "type": "tutorial", "label": "Tutorial", "description": "Step-by-step guide to accomplish a specific technical task." },
    { "type": "opinion_essay", "label": "Opinion Essay", "description": "Argued perspective on a technical or industry topic — not neutral, not a how-to." },
    { "type": "project_showcase", "label": "Project Showcase", "description": "Demonstration of a built product, open-source library, or internal tool." },
    { "type": "open_source_release", "label": "Open Source Release", "description": "Announcement and walkthrough of a newly open-sourced project." },
    { "type": "other", "label": "Other", "description": "Articles that do not fit a predefined type." }
  ]
}
```

---

## Scheduled Publishing (Background Job)

Blogs set to `scheduled` status are auto-published by a cron job running **every minute** on the server. There is no manual API call needed — it happens automatically.

### How to test scheduled publishing

1. Create a blog draft: `POST /blogs`
2. Schedule it 2 minutes in the future:
   ```
   POST {{base_url}}/blogs/{{blog_slug}}/schedule
   ```
   ```json
   { "scheduledAt": "2026-05-20T10:02:00.000Z" }
   ```
3. Confirm status is `scheduled`: `GET /blogs/me`
4. Wait 2 minutes
5. Check blog is now `published`: `GET /blogs/{{blog_slug}}` (public, no auth)
6. Check server logs for: `Scheduler: published blog "your-blog-slug"`

### Publish failure state

If publishing fails for any reason, the blog status is set to `publish_failed`. You can recover it by manually publishing:

```
POST {{base_url}}/blogs/{{blog_slug}}/publish
```

Check for failed blogs:

```sql
SELECT slug, status, scheduled_at FROM blogs WHERE status = 'publish_failed';
```

---

## Full Happy-Path Flow

Run these in order to exercise the complete user journey end-to-end.

### Auth & Profile

1. **Register** — `POST /auth/register` → check for verification email
2. **Verify email** — `POST /auth/verify-email` with token from DB
3. **Login** — `POST /auth/login` → save tokens to env
4. **Onboarding** — `POST /auth/onboarding` (multipart/form-data) with `displayName`; optionally `username` and `avatar` file
5. **Get profile** — `GET /author-profiles/me` → confirm profile exists
6. **Update profile** — `PATCH /author-profiles/me` with `bio` → confirm partial update

### Company

7. **Create company** — `POST /companies` → save `company_handle` and `company_id` to env
8. **Get company** — `GET /companies/{{company_handle}}` (no auth) → confirm public page works
9. **Get my companies** — `GET /companies/mine` → should return the new company
10. **Update company** — `PATCH /companies/{{company_handle}}` with `{ "stage": "growth" }`
11. **Add milestone** — `POST /companies/{{company_handle}}/milestones` with type + headline
12. **View milestones** — `GET /companies/{{company_handle}}/milestones` (no auth)

### Invite Flow (requires a second test account)

13. **Invite author** — `POST /companies/{{company_handle}}/invites` with second user's email → get token from DB
14. **Accept invite** (as second user) — `POST /companies/invites/{{invite_token}}/accept`
15. **Check members** — `GET /companies/{{company_handle}}/members` → both users visible

### Blog

16. **Create draft** — `POST /blogs` with title + articleType → save `blog_slug` to env
17. **Get my blogs** — `GET /blogs/me` → draft visible
18. **Update draft** — `PATCH /blogs/{{blog_slug}}` with new title and tags
19. **Schedule** — `POST /blogs/{{blog_slug}}/schedule` with future `scheduledAt`
20. **Publish** — `POST /blogs/{{blog_slug}}/publish` (overrides scheduled status)
21. **View publicly** — `GET /blogs/{{blog_slug}}` (no auth) → confirms published
22. **Archive** — `POST /blogs/{{blog_slug}}/archive` → blog hidden from public
23. **Confirm hidden** — `GET /blogs/{{blog_slug}}` (no auth) → `404`
24. **Unarchive** — `POST /blogs/{{blog_slug}}/unarchive` → back to published

### Author & Company Public Pages

25. **Author blogs** — `GET /author-profiles/{{username}}/blogs` (no auth) → published blog appears
26. **Company blogs** — `GET /companies/{{company_handle}}/blogs` (no auth) → published blog appears

### Discovery

27. **Explore** — `GET /explore` → published blog appears
28. **Filter by tag** — `GET /explore?tag=typescript` → filtered results
29. **Tags list** — `GET /tags` → tags from blog appear
30. **Trending tags** — `GET /tags/trending` → top 10

### Scheduled Publishing

31. **Create another draft** — `POST /blogs` with a new title
32. **Schedule it** — `POST /blogs/{{blog_slug}}/schedule` with `scheduledAt` 2 minutes from now
33. **Wait 2 minutes** — cron fires every minute
34. **Confirm auto-published** — `GET /blogs/{{blog_slug}}` (public) should return `200`

### Tag Approval (Admin)

35. **Get unapproved tags** — query DB: `SELECT id, name FROM tags WHERE is_approved = false`
36. **Approve tag** — `POST /tags/{{tag_id}}/approve` with `{{admin_token}}`
37. **Confirm in autocomplete** — `GET /tags` → approved tag now appears

### Cleanup

38. **Refresh token** — `POST /auth/refresh` → update env
39. **Logout** — `POST /auth/logout` → revoke token
40. **Confirm revoked** — `POST /auth/refresh` with old token → `401`

---

## Login Lockout Flow

1. `POST /auth/login` with `{ "email": "test@example.com", "password": "WrongPass1" }` — repeat 5 times
2. 6th attempt → `401` (locked)
3. Reset early by deleting the row: `DELETE FROM login_attempts WHERE identifier_hash IS NOT NULL;`

---

## Admin Flow

Manually promote a user to admin in the DB, then log in:

```sql
UPDATE users SET platform_role = 'platform_admin' WHERE email = 'admin@example.com';
```

1. **Login as admin** → save to `{{admin_token}}`
2. `GET /users` with `{{admin_token}}` → `200` (full user list)
3. `GET /users` with `{{access_token}}` (regular user) → `403`

---

## Company Owner vs Author Permission Matrix

Test these access control rules after setting up a company with an invited author (second account):

| Action                              | Owner | Author | Expected for Author |
| ----------------------------------- | ----- | ------ | ------------------- |
| `PATCH /companies/:handle`          | ✅    | ❌     | `403 Forbidden`     |
| `POST /companies/:handle/invites`   | ✅    | ❌     | `403 Forbidden`     |
| `DELETE /companies/:handle/members/:id` | ✅ | ❌   | `403 Forbidden`     |
| `POST /companies/:handle/milestones`| ✅    | ❌     | `403 Forbidden`     |
| `POST /blogs` (under company)       | ✅    | ✅     | `201 Created`       |
| `PATCH /blogs/:slug` (own blog)     | ✅    | ✅     | `200 OK`            |
| `PATCH /blogs/:slug` (other's blog) | ✅    | ❌     | `403 Forbidden`     |
| `POST /blogs/:slug/archive` (other's) | ✅  | ❌     | `403 Forbidden`     |

---

## Rate Limits Summary

| Endpoint                         | Limit        | Window     |
| -------------------------------- | ------------ | ---------- |
| `POST /auth/register`            | 5 requests   | 60 seconds |
| `POST /auth/login`               | 5 requests   | 60 seconds |
| `POST /auth/forgot-password`     | 3 requests   | 60 seconds |
| `POST /auth/resend-verification` | 3 requests   | 60 seconds |
| `GET /users`                     | 30 requests  | 60 seconds |
| `PATCH /users/:id`               | 20 requests  | 60 seconds |
| `DELETE /users/:id`              | 10 requests  | 60 seconds |
| All other endpoints              | 100 requests | 60 seconds |

When a limit is hit the response is `429 Too Many Requests`.

---

## Common Headers Reference

| Header          | Value                     | When required                         |
| --------------- | ------------------------- | ------------------------------------- |
| `Content-Type`  | `application/json`        | All POST / PATCH requests with a body |
| `Authorization` | `Bearer {{access_token}}` | All protected endpoints               |

The `X-Correlation-Id` header is injected by the server on every response for tracing — you can optionally pass your own value on requests.

---

## Useful Dev Queries

Get the latest email verification token:
```sql
SELECT token FROM email_verification_tokens ORDER BY created_at DESC LIMIT 1;
```

Get the latest password reset token:
```sql
SELECT token FROM password_reset_tokens ORDER BY created_at DESC LIMIT 1;
```

Get the latest company invite token:
```sql
SELECT token, invited_email, expires_at FROM company_invites ORDER BY id DESC LIMIT 1;
```

Check blog status:
```sql
SELECT slug, status, published_at, scheduled_at FROM blogs ORDER BY created_at DESC LIMIT 5;
```

Check scheduled blogs due for publishing:
```sql
SELECT slug, scheduled_at, status FROM blogs WHERE status = 'scheduled' AND scheduled_at <= NOW();
```

Check publish_failed blogs:
```sql
SELECT slug, scheduled_at FROM blogs WHERE status = 'publish_failed';
```

Check tag counts and approval status:
```sql
SELECT name, slug, blog_count, is_approved FROM tags ORDER BY blog_count DESC;
```

Get unapproved tags (need admin approval):
```sql
SELECT id, name, slug FROM tags WHERE is_approved = false ORDER BY created_at DESC;
```

Check company memberships:
```sql
SELECT u.email, cm.role, c.handle FROM company_memberships cm
JOIN users u ON u.id = cm.user_id
JOIN companies c ON c.id = cm.company_id
ORDER BY c.handle, cm.role;
```

Promote user to admin:
```sql
UPDATE users SET platform_role = 'platform_admin' WHERE email = 'your@email.com';
```

Reset login lockout:
```sql
DELETE FROM login_attempts;
```
