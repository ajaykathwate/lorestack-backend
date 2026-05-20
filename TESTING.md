# API Testing Guide — Postman

Base URL: `http://localhost:3000`  
All endpoints are versioned under `/api/v1/`.

---

## Setup

### Postman Environment Variables

Create a Postman environment called **Lorestack Local** with these variables:

| Variable        | Initial Value                  | Description                   |
| --------------- | ------------------------------ | ----------------------------- |
| `base_url`      | `http://localhost:3000/api/v1` | Base URL                      |
| `access_token`  | _(empty)_                      | Set automatically after login |
| `refresh_token` | _(empty)_                      | Set automatically after login |
| `user_id`       | _(empty)_                      | Set after login or register   |
| `admin_token`   | _(empty)_                      | Set after logging in as admin |

### Auto-capture tokens (Login test script)

Add this to the **Tests** tab of any login request to auto-fill the env variables:

```javascript
const res = pm.response.json();
if (res.data?.accessToken) {
  pm.environment.set('access_token', res.data.accessToken);
  pm.environment.set('refresh_token', res.data.refreshToken);
}
```

---

## Auth Endpoints

### 1. Register

**`POST /api/v1/auth/register`**

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

**`POST /api/v1/auth/verify-email`**

No auth required. Token comes from the email link — check server logs or the `email_verification_tokens` table in dev.

**Headers**

```
Content-Type: application/json
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

**`POST /api/v1/auth/login`**

No auth required.

**Headers**

```
Content-Type: application/json
```

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

**`GET /api/v1/auth/google`**

Open this URL directly in a browser — Postman cannot handle the OAuth redirect flow.

```
http://localhost:3000/api/v1/auth/google
```

Google will redirect to the callback URL. On success the callback returns the same token shape as login. The callback URL (`/api/v1/auth/google/callback`) is handled automatically by Passport — do not call it manually.

---

### 5. Onboarding (Create Author Profile)

**`POST /api/v1/auth/onboarding`**

Requires JWT. Must be called after email verification. Can only be completed once per account.

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body — minimal**

```json
{
  "displayName": "Ajay Kathwate"
}
```

**Body — with avatar**

```json
{
  "displayName": "Ajay Kathwate",
  "avatarUrl": "https://example.com/avatar.png"
}
```

**Expected: 201**

```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "displayName": "Ajay Kathwate",
    "username": "ajay-kathwate",
    "bio": null,
    "avatarUrl": null,
    "expertiseTags": [],
    "createdAt": "2026-05-20T..."
  }
}
```

Note: `username` is auto-generated from `displayName` (lowercased, hyphenated). If `"ajay-kathwate"` is taken, it becomes `"ajay-kathwate-1"`.

**Error cases**

| Scenario                | Expected           |
| ----------------------- | ------------------ |
| No auth header          | `401 Unauthorized` |
| Already onboarded       | `409 Conflict`     |
| `displayName` < 2 chars | `400 Bad Request`  |
| `avatarUrl` not a URL   | `400 Bad Request`  |

---

### 6. Refresh Token

**`POST /api/v1/auth/refresh`**

No auth header needed — the refresh token itself is the credential.

**Headers**

```
Content-Type: application/json
```

**Body**

```json
{
  "refreshToken": "{{refresh_token}}"
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

Note: refresh token rotation is active — each successful refresh invalidates the old token and issues a new one. Update `{{refresh_token}}` in your env after each refresh.

**Error cases**

| Scenario                       | Expected                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| Invalid/garbage token          | `401 Unauthorized`                                                                   |
| Reused (already-rotated) token | `401 Unauthorized` — reuse detection triggers revocation of all tokens for that user |
| Expired token                  | `401 Unauthorized`                                                                   |

---

### 7. Logout

**`POST /api/v1/auth/logout`**

No auth header required. Pass the refresh token to revoke it.

**Headers**

```
Content-Type: application/json
```

**Body**

```json
{
  "refreshToken": "{{refresh_token}}"
}
```

**Expected: 200**

```json
{
  "data": {
    "message": "Logged out successfully."
  }
}
```

Note: passing an already-revoked or unknown token still returns `200` — this is intentional (no information leakage).

---

### 8. Forgot Password

**`POST /api/v1/auth/forgot-password`**

No auth required.

**Headers**

```
Content-Type: application/json
```

**Body**

```json
{
  "email": "ajay@example.com"
}
```

**Expected: 200** (same response regardless of whether the email exists)

```json
{
  "data": {
    "message": "If the account exists, a reset link has been sent."
  }
}
```

The reset link is valid for **60 minutes**. Check server logs or the `password_reset_tokens` table for the token in dev.

**Error cases**

| Scenario             | Expected                                  |
| -------------------- | ----------------------------------------- |
| Invalid email format | `400 Bad Request`                         |
| Rate limited         | `429` after 3 requests/60s                |
| Google-only account  | `200` generic response (anti-enumeration) |

---

### 9. Reset Password

**`POST /api/v1/auth/reset-password`**

No auth required. Token comes from the reset email link.

**Headers**

```
Content-Type: application/json
```

**Body**

```json
{
  "token": "<token-from-reset-email>",
  "password": "NewPassword1"
}
```

**Expected: 200**

```json
{
  "data": {
    "message": "Password reset successfully. Please log in again."
  }
}
```

Note: all existing refresh tokens for the user are revoked on success.

**Error cases**

| Scenario               | Expected           |
| ---------------------- | ------------------ |
| Expired token          | `401 Unauthorized` |
| Already-used token     | `401 Unauthorized` |
| Password < 8 chars     | `400 Bad Request`  |
| Password has no number | `400 Bad Request`  |
| Google-only account    | `400 Bad Request`  |

---

### 10. Resend Verification Email

**`POST /api/v1/auth/resend-verification`**

No auth required.

**Headers**

```
Content-Type: application/json
```

**Body**

```json
{
  "identifier": "ajay@example.com"
}
```

**Expected: 200** (same response regardless of whether email exists)

```json
{
  "data": {
    "message": "If the account exists and is not yet verified, a new link has been sent."
  }
}
```

**Error cases**

| Scenario             | Expected                   |
| -------------------- | -------------------------- |
| Invalid email format | `400 Bad Request`          |
| Rate limited         | `429` after 3 requests/60s |
| Already verified     | `200` generic response     |

---

### 11. Change Password

**`POST /api/v1/auth/change-password`**

Requires JWT.

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

**Expected: 200**

```json
{
  "data": {
    "message": "Password changed successfully."
  }
}
```

Note: all existing refresh tokens are revoked on success.

**Error cases**

| Scenario                    | Expected           |
| --------------------------- | ------------------ |
| No auth header              | `401 Unauthorized` |
| Wrong `currentPassword`     | `401 Unauthorized` |
| `newPassword` < 8 chars     | `400 Bad Request`  |
| `newPassword` has no number | `400 Bad Request`  |
| Google-only account         | `400 Bad Request`  |

---

## Users Endpoints

All users endpoints require a valid JWT except where noted.

### 12. Get Current User (Me)

**`GET /api/v1/users/me`**

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

Note: `password`, `providerId`, `deletedAt`, `passwordChangedAt` are never returned.

**Error cases**

| Scenario       | Expected           |
| -------------- | ------------------ |
| No auth header | `401 Unauthorized` |
| Expired token  | `401 Unauthorized` |

---

### 13. Get User by ID

**`GET /api/v1/users/:id`**

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Example**

```
GET /api/v1/users/550e8400-e29b-41d4-a716-446655440000
```

**Expected: 200** — same shape as `/users/me`

**Error cases**

| Scenario       | Expected           |
| -------------- | ------------------ |
| No auth header | `401 Unauthorized` |
| Unknown UUID   | `404 Not Found`    |
| Non-UUID param | `400 Bad Request`  |

---

### 14. List All Users (Admin only)

**`GET /api/v1/users`**

Requires `platform_admin` role. Regular users get `403`.

**Headers**

```
Authorization: Bearer {{admin_token}}
```

**Query params (all optional)**

```
?page=1&limit=20
```

**Expected: 200**

```json
{
  "data": [
    {
      "id": "uuid",
      "email": "...",
      "platformRole": "user",
      ...
    }
  ]
}
```

**Error cases**

| Scenario           | Expected           |
| ------------------ | ------------------ |
| Regular user token | `403 Forbidden`    |
| No auth            | `401 Unauthorized` |
| `page=0`           | `400 Bad Request`  |
| `limit=101`        | `400 Bad Request`  |

---

### 15. Update User

**`PATCH /api/v1/users/:id`**

Users can update their own account. Platform admins can update any account.

**Headers**

```
Content-Type: application/json
Authorization: Bearer {{access_token}}
```

**Body**

```json
{
  "email": "newemail@example.com"
}
```

**Expected: 200** — updated user object

**Error cases**

| Scenario                        | Expected           |
| ------------------------------- | ------------------ |
| No auth                         | `401 Unauthorized` |
| Updating another user's account | `403 Forbidden`    |
| Email already taken             | `409 Conflict`     |
| Invalid email format            | `400 Bad Request`  |

---

### 16. Delete (Soft-delete) User

**`DELETE /api/v1/users/:id`**

Users can delete their own account. Platform admins can delete any account. This is a soft-delete — the row is not removed, `deletedAt` is set.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200** — the deleted user object (with `deletedAt` populated)

**Error cases**

| Scenario                        | Expected           |
| ------------------------------- | ------------------ |
| No auth                         | `401 Unauthorized` |
| Deleting another user's account | `403 Forbidden`    |
| Non-UUID param                  | `400 Bad Request`  |

---

## Author Profiles Endpoints

### 17. Get Own Profile

**`GET /api/v1/author-profiles/me`**

Requires JWT. Returns 404 if onboarding has not been completed yet.

**Headers**

```
Authorization: Bearer {{access_token}}
```

**Expected: 200**

```json
{
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "displayName": "Ajay Kathwate",
    "username": "ajay-kathwate",
    "bio": null,
    "avatarUrl": null,
    "expertiseTags": [],
    "twitterHandle": null,
    "linkedinUrl": null,
    "githubHandle": null,
    "websiteUrl": null,
    "createdAt": "2026-05-20T...",
    "updatedAt": "2026-05-20T..."
  }
}
```

---

### 18. Update Own Profile

**`PATCH /api/v1/author-profiles/me`**

Requires JWT. All fields are optional — send only what you want to change.

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

**Body — partial update**

```json
{
  "bio": "Updated bio only."
}
```

**Expected: 200** — updated profile object

**Error cases**

| Scenario                                     | Expected           |
| -------------------------------------------- | ------------------ |
| No auth                                      | `401 Unauthorized` |
| Username already taken                       | `409 Conflict`     |
| Username with invalid chars (e.g. uppercase) | `400 Bad Request`  |
| `bio` > 300 chars                            | `400 Bad Request`  |
| `avatarUrl` not a valid URL                  | `400 Bad Request`  |
| `linkedinUrl` not a valid URL                | `400 Bad Request`  |

---

### 19. Get Profile by Username (Public)

**`GET /api/v1/author-profiles/:username`**

No auth required.

**Example**

```
GET /api/v1/author-profiles/ajay-kathwate
```

**Expected: 200** — same shape as `/author-profiles/me`

**Error cases**

| Scenario           | Expected        |
| ------------------ | --------------- |
| Username not found | `404 Not Found` |

---

## Full Happy-Path Flow

Run these in order to test the complete user journey end-to-end.

### Step 1 — Register

`POST /api/v1/auth/register` with `fullName`, `email`, `password`

### Step 2 — Verify Email

Grab the token from the `email_verification_tokens` table or server logs.  
`POST /api/v1/auth/verify-email` with `{ "token": "..." }`

### Step 3 — Login

`POST /api/v1/auth/login` → save `accessToken` and `refreshToken` to env.

### Step 4 — Onboarding

`POST /api/v1/auth/onboarding` with `Authorization: Bearer {{access_token}}`  
Confirm `username` is auto-generated from `displayName`.

### Step 5 — Get own profile

`GET /api/v1/author-profiles/me` — confirm profile exists.

### Step 6 — Get public profile

`GET /api/v1/author-profiles/{{username}}` — no auth header. Should return same data.

### Step 7 — Update profile

`PATCH /api/v1/author-profiles/me` with `{ "bio": "Hello world" }` — confirm partial update works.

### Step 8 — Refresh token

`POST /api/v1/auth/refresh` — update `{{refresh_token}}` in env with the new one.

### Step 9 — Change password

`POST /api/v1/auth/change-password` with `currentPassword` + `newPassword`.

### Step 10 — Logout

`POST /api/v1/auth/logout` with current `{{refresh_token}}`.

### Step 11 — Confirm token revoked

`POST /api/v1/auth/refresh` with the old `{{refresh_token}}` — should return `401`.

---

## Login Lockout Flow

Tests the 5-attempt lockout.

1. `POST /api/v1/auth/login` with `{ "email": "test@example.com", "password": "WrongPass1" }` — repeat 5 times
2. 6th attempt → expect `401` (locked) or `429` (rate limited)
3. Wait 15 minutes OR manually delete the `login_attempts` row in the DB to reset early

---

## Admin Flow

To get an admin token you must manually set `platformRole = 'platform_admin'` in the DB for a user, then log in normally.

```sql
UPDATE users SET platform_role = 'platform_admin' WHERE email = 'admin@example.com';
```

Then:

1. `POST /api/v1/auth/login` as admin → save to `{{admin_token}}`
2. `GET /api/v1/users` with `Authorization: Bearer {{admin_token}}` → `200`
3. `GET /api/v1/users` with `Authorization: Bearer {{access_token}}` (regular user) → `403`

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

No other headers are required. The `X-Correlation-Id` header is injected by the server on every response for request tracing — you can optionally pass your own value.
