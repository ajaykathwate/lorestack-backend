# Deployment Guide — Lorestack Backend (Fly.io)

> **Stack:** NestJS · Prisma · PostgreSQL · Socket.io · pnpm · Docker  
> **Platform:** Fly.io · Region: Singapore (`sin`)  
> **App name:** `lorestack` · **Postgres app:** `lorestack-postgres`  
> **Deploy branch:** `release` — every merge to `release` auto-deploys via GitHub Actions

---

## Table of Contents

1. [How Fly.io Works](#how-flyio-works)
2. [Pre-flight Checklist](#pre-flight-checklist)
3. [Step 1 — Install flyctl & Login](#step-1--install-flyctl--login)
4. [Step 2 — Create the Fly App](#step-2--create-the-fly-app)
5. [Step 3 — Create Postgres Database](#step-3--create-postgres-database)
6. [Step 4 — Set Secrets (Environment Variables)](#step-4--set-secrets-environment-variables)
7. [Step 5 — First Deploy](#step-5--first-deploy)
8. [Step 6 — Verify Everything Works](#step-6--verify-everything-works)
9. [Step 7 — Custom Domain + SSL](#step-7--custom-domain--ssl)
10. [Step 8 — Update Google OAuth Callback](#step-8--update-google-oauth-callback)
11. [Step 9 — CI/CD with GitHub Actions](#step-9--cicd-with-github-actions)
12. [How Every Deploy Works After This](#how-every-deploy-works-after-this)
13. [Day-to-Day Development Workflow](#day-to-day-development-workflow)
14. [Scaling](#scaling)
15. [Monitoring & Logs](#monitoring--logs)
16. [Useful Commands Reference](#useful-commands-reference)
17. [Common Errors & Fixes](#common-errors--fixes)
18. [Secrets Reference (All Env Vars)](#secrets-reference-all-env-vars)

---

## How Fly.io Works

Fly takes your `Dockerfile`, builds it, and runs it on their global infrastructure.

| Concept | How Fly handles it |
|---|---|
| **Servers** | Called "Machines" — small VMs running your Docker container |
| **Port** | Injects `PORT` env var and routes traffic to your container's `internal_port` in fly.toml |
| **Database** | Separate Fly Postgres app — connects via private network (fast, no internet hop) |
| **Migrations** | `release_command` in fly.toml runs migrations in a temp VM *before* new machines start |
| **Secrets** | Set via `fly secrets set` — injected as env vars at runtime, never in fly.toml |
| **SSL** | Automatic via Let's Encrypt — both `.fly.dev` subdomain and custom domains |
| **WebSockets** | Native — Fly does not terminate WebSocket connections, they pass straight through |

**The migration flow — most important thing to understand:**

```
Merge PR into release branch
    ↓
GitHub Actions: lint + tests
    ↓
flyctl deploy --remote-only
    ↓
Fly builds new Docker image
    ↓
Fly starts a TEMPORARY machine with the new image
    └── runs: pnpm prisma migrate deploy
    └── if FAILS → deploy aborts, old version keeps running ✅
    └── if SUCCEEDS → continues
    ↓
Fly replaces old machines with new ones (rolling restart)
    ↓
Health check at /api/v1/health must pass
    └── if FAILS → Fly rolls back automatically ✅
    └── if PASSES → deploy complete ✅
```

---

## Pre-flight Checklist

- [ ] Code is on GitHub, deploy branch is `release`
- [ ] `Dockerfile` exists at repo root ✅
- [ ] `fly.toml` exists at repo root ✅
- [ ] `.github/workflows/deploy.yml` exists ✅
- [ ] Credit card added to Fly account (required even for free tier)

---

## Step 1 — Install flyctl & Login

**macOS:**
```bash
brew install flyctl
```

**Windows (PowerShell as Admin):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Linux / WSL:**
```bash
curl -L https://fly.io/install.sh | sh
```

> **Windows tip:** Run all `fly` commands from PowerShell or CMD — not WSL. WSL can drop long-running CLI connections mid-deploy.

```bash
fly auth login       # Opens browser to sign in
fly auth whoami      # Verify — should show your email
```

---

## Step 2 — Create the Fly App

Run from the repo root. Registers the app name with Fly but does **not** deploy yet.

```bash
fly apps create lorestack
```

Update `fly.toml` if you use a different name:
```toml
app = "lorestack"  # must match
```

---

## Step 3 — Create Postgres Database

Fly Postgres runs as a separate app on Fly's private network — no internet hop between app and DB.

```bash
fly postgres create \
  --name lorestack-postgres \
  --region sin \
  --vm-size shared-cpu-1x \
  --volume-size 10 \
  --initial-cluster-size 1
```

> When prompted for cluster size, enter `1` — single node is fine for MVP.

**Save the credentials output somewhere safe** (1Password, Notion) — you won't see them again.

**Attach Postgres to your app** (auto-sets `DATABASE_URL` secret):

```bash
fly postgres attach lorestack-postgres --app lorestack
```

Output:
```
The following secret was added to lorestack:
  DATABASE_URL=postgres://lorestack:<password>@lorestack-postgres.internal:5432/lorestack
```

> This creates a **dedicated DB user and database** for the app — not the root postgres user. ✅

```bash
fly secrets list --app lorestack
# DATABASE_URL should appear (value hidden)
```

---

## Step 4 — Set Secrets (Environment Variables)

Secrets are encrypted, injected as env vars at runtime, never visible in logs or fly.toml.

```bash
fly secrets set \
  JWT_SECRET="REPLACE_WITH_64_CHAR_RANDOM_STRING" \
  JWT_EXPIRES_IN="15m" \
  JWT_REFRESH_EXPIRES_IN_DAYS="7" \
  PASSWORD_HASH_ROUNDS="12" \
  RESEND_API_KEY="re_REPLACE_WITH_YOUR_KEY" \
  MAIL_FROM="noreply@yourdomain.com" \
  APP_BASE_URL="https://lorestack.fly.dev" \
  FRONTEND_URL="https://your-frontend.vercel.app" \
  CORS_ORIGIN="https://your-frontend.vercel.app" \
  --app lorestack
```

**Google OAuth** (add after getting credentials from Google Cloud Console):
```bash
fly secrets set \
  GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="GOCSPX-your-secret" \
  GOOGLE_CALLBACK_URL="https://lorestack.fly.dev/api/v1/auth/google/callback" \
  --app lorestack
```

**Generate JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

> `DATABASE_URL` is already set by `fly postgres attach` — do NOT set it again.

**Verify all secrets are set:**
```bash
fly secrets list --app lorestack
```

---

## Step 5 — First Deploy

```bash
fly deploy --app lorestack
```

Watch logs in a second terminal:
```bash
fly logs --app lorestack
```

**Expected output:**
```
Running lorestack release_command: pnpm prisma migrate deploy
✓ release_command completed successfully
Machine was created
✓ Machine is healthy
--> v1 deployed successfully
```

**Get your app URL:**
```bash
fly status --app lorestack
# Hostname: lorestack.fly.dev
```

---

## Step 6 — Verify Everything Works

```bash
# Health check — hits DB (SELECT 1) too
curl https://lorestack.fly.dev/api/v1/health
# Expected: {"status":"ok","database":"ok","timestamp":"..."}

# Swagger UI
open https://lorestack.fly.dev/docs

# App + machine status
fly status --app lorestack
```

---

## Step 7 — Custom Domain + SSL

**Add domain to Fly:**
```bash
fly certs add api.lorestack.com --app lorestack
```

Fly outputs a CNAME record to add in your DNS provider:
```
api.lorestack.com CNAME lorestack.fly.dev
```

| DNS Provider | Steps |
|---|---|
| Cloudflare | DNS → Add Record → CNAME → `api` → `lorestack.fly.dev` → Proxy **OFF** (grey cloud) |
| Namecheap | Advanced DNS → CNAME → Host: `api` → Value: `lorestack.fly.dev` |
| Route 53 | Hosted zones → Create CNAME record → `api.lorestack.com` → `lorestack.fly.dev` |

> **Cloudflare:** Keep proxy **OFF** (grey cloud) — orange cloud can break WebSocket connections.

**Check SSL certificate status:**
```bash
fly certs check api.lorestack.com --app lorestack
# Wait for: Certificate is ready (~1–5 minutes)
```

**Update secrets with real domain:**
```bash
fly secrets set \
  APP_BASE_URL="https://api.lorestack.com" \
  GOOGLE_CALLBACK_URL="https://api.lorestack.com/api/v1/auth/google/callback" \
  --app lorestack
# Setting secrets triggers an automatic redeploy ✅
```

---

## Step 8 — Google OAuth Setup & Callback Update

### Part A — Get Google Credentials (one-time setup)

**1. Create a Google Cloud Project**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **"New Project"**
3. Name: `lorestack` → **Create**
4. Make sure the new project is selected in the dropdown

**2. Configure the OAuth Consent Screen** *(required before creating credentials)*
1. Left sidebar → **APIs & Services → OAuth consent screen**
2. Choose **External** → **Create**
3. Fill in:
   - **App name:** `Lorestack`
   - **User support email:** your email
   - **Developer contact email:** your email
4. **Save and Continue**
5. On the **Scopes** page → **Add or Remove Scopes** → add:
   - `openid`
   - `email`
   - `profile`
6. Save and Continue → Save and Continue → **Back to Dashboard**

> App will be in **Testing** mode. Fine for development. To allow any Google account to sign in, click **"Publish App"** later (instant approval for email/profile scopes).

**3. Create OAuth 2.0 Credentials**
1. Left sidebar → **APIs & Services → Credentials**
2. **+ Create Credentials → OAuth 2.0 Client IDs**
3. **Application type:** Web application
4. **Name:** `lorestack-backend`
5. **Authorized JavaScript origins** — add:
   ```
   http://localhost:3001
   https://lorestack.fly.dev
   https://api.lorestack.com
   ```
6. **Authorized redirect URIs** — add:
   ```
   http://localhost:3001/api/v1/auth/google/callback
   https://lorestack.fly.dev/api/v1/auth/google/callback
   https://api.lorestack.com/api/v1/auth/google/callback
   ```
7. **Create**

**4. Copy your credentials**  
A popup shows:
- **Client ID** → `GOOGLE_CLIENT_ID` (looks like `123456789-xxxx.apps.googleusercontent.com`)
- **Client Secret** → `GOOGLE_CLIENT_SECRET` (looks like `GOCSPX-xxxxxxxx`)

Copy both and set them as Fly secrets:
```bash
fly secrets set \
  GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="GOCSPX-your-secret" \
  GOOGLE_CALLBACK_URL="https://lorestack.fly.dev/api/v1/auth/google/callback" \
  --app lorestack
```

---

### Part B — Update Callback URL After Custom Domain

Once you set up `api.lorestack.com` (Step 7), update the callback URL:

1. Google Cloud Console → **APIs & Services → Credentials → your OAuth 2.0 Client**
2. Under **Authorized redirect URIs**, ensure this is present:
   ```
   https://api.lorestack.com/api/v1/auth/google/callback
   ```
3. Save — propagates in ~5 minutes

Then update the Fly secret:
```bash
fly secrets set \
  GOOGLE_CALLBACK_URL="https://api.lorestack.com/api/v1/auth/google/callback" \
  --app lorestack
```

---

## Step 9 — CI/CD with GitHub Actions

The workflow at `.github/workflows/deploy.yml` is already configured to deploy on push to `release`.

**Get a Fly deploy token:**
```bash
fly tokens create deploy -a lorestack
# Outputs: FlyV1 ...
```

**Add token to GitHub:**
1. GitHub repo → **Settings → Secrets and variables → Actions**
2. **New repository secret**
3. Name: `FLY_API_TOKEN` · Value: paste the token
4. Save

That's it. CI/CD is live — every merge to `release` auto-deploys.

---

## How Every Deploy Works After This

```
Merge PR into release branch on GitHub
    ↓
GitHub Actions triggers
    ↓
pnpm lint + pnpm test
    ↓ (if tests fail → stops here, nothing deploys)
flyctl deploy --remote-only
    ↓
Fly builds Docker image on their servers
    ↓
Release VM: pnpm prisma migrate deploy
    ↓ (migrations fail → abort, old version stays up ✅)
New machine starts: node dist/main
    ↓
Health check: GET /api/v1/health → 200 OK
    ↓ (fails → Fly rolls back automatically ✅)
Old machine stops
    ↓
✅ Deploy complete — ~3–5 minutes total
```

---

## Day-to-Day Development Workflow

```bash
# 1. Start a new feature
git checkout master
git checkout -b feature/my-feature

# 2. Build, commit as usual
git add .
git commit -m "feat: my feature"
git push origin feature/my-feature

# 3. Open PR on GitHub: feature/my-feature → release
#    Review → Merge

# 4. GitHub Actions auto-deploys to Fly.io ✅
#    No manual steps needed

# 5. Keep master in sync
git checkout master
git merge release
git push origin master
```

---

## Scaling

**Scale vertically (bigger machine):**
```bash
fly scale memory 1024 --app lorestack      # Upgrade to 1GB RAM
fly scale vm shared-cpu-2x --app lorestack # Bigger CPU+RAM
fly platform vm-sizes                       # See all options
```

**Scale horizontally (more machines):**
```bash
fly scale count 2 --app lorestack  # 2 machines, auto load-balanced
fly scale count 1 --app lorestack  # Scale back down
```

> **WebSockets + multiple machines:** Socket.io clients may connect to different machines. You'll need a Redis adapter to broadcast across machines. This is a future concern — 1 machine handles significant load.

---

## Monitoring & Logs

```bash
fly logs --app lorestack              # Live log stream
fly logs --app lorestack -n 100       # Last 100 lines
fly status --app lorestack            # Machine states + health
fly dashboard --app lorestack         # Web dashboard (metrics, deploys)
fly releases --app lorestack          # Deployment history
```

**SSH into running machine:**
```bash
fly ssh console --app lorestack
# Inside container:
printenv                              # See all env vars / secrets
```

**Rollback to previous version:**
```bash
fly releases --app lorestack
# Note the image ref from the version you want
fly deploy --image registry.fly.io/lorestack:deployment-XXXXX --app lorestack
```

**Postgres:**
```bash
fly postgres connect -a lorestack-postgres          # Postgres shell
fly postgres connect -a lorestack-postgres --command "SELECT count(*) FROM users;"
```

---

## Useful Commands Reference

```bash
# ── App ──────────────────────────────────────────────────────────────────────
fly status --app lorestack
fly logs --app lorestack
fly dashboard --app lorestack
fly open --app lorestack

# ── Deploy ───────────────────────────────────────────────────────────────────
fly deploy --app lorestack                    # Deploy from local (uses WSL? use PowerShell)
fly deploy --remote-only --app lorestack      # Build on Fly's servers (faster)
fly releases --app lorestack

# ── Secrets ──────────────────────────────────────────────────────────────────
fly secrets list --app lorestack
fly secrets set KEY=value --app lorestack
fly secrets unset KEY --app lorestack

# ── Machines ─────────────────────────────────────────────────────────────────
fly machines list --app lorestack
fly scale show --app lorestack
fly scale memory 1024 --app lorestack

# ── Database ─────────────────────────────────────────────────────────────────
fly postgres connect -a lorestack-postgres
fly postgres restart -a lorestack-postgres

# ── Debug ────────────────────────────────────────────────────────────────────
fly ssh console --app lorestack
fly ssh console --app lorestack -C "printenv"

# ── One-off tasks ────────────────────────────────────────────────────────────
fly ssh console --app lorestack -C "pnpm prisma:seed"
```

---

## Common Errors & Fixes

**`Cannot find module 'multer'`**  
→ multer missing from prod deps. Fix: `pnpm add multer` → commit → redeploy.

---

**Deploy fails at release command:**
```
Error: P3009 migrate found failed migration
```
→ Fix:
```bash
fly ssh console --app lorestack -C \
  "pnpm prisma migrate resolve --rolled-back <migration_name>"
```

---

**Health check fails — app won't start:**
```bash
fly logs --app lorestack
# Look for the actual startup error
fly ssh console --app lorestack -C "printenv DATABASE_URL"
# Verify DB connection string is correct
```

---

**CORS error from frontend:**
```bash
fly secrets set CORS_ORIGIN="https://your-frontend.vercel.app" --app lorestack
```

---

**`fly deploy` hangs mid-deploy (WSL issue):**  
→ Switch to PowerShell/CMD. Run `fly deploy --app lorestack` from Windows terminal, not WSL.

---

**Machine stopped, health check warning:**  
→ App crashed on startup. Check logs immediately:
```bash
fly logs --app lorestack
```

---

## Secrets Reference (All Env Vars)

```bash
fly secrets set \
  JWT_SECRET="<run: node -e \"console.log(require('crypto').randomBytes(48).toString('base64'))\">" \
  JWT_EXPIRES_IN="15m" \
  JWT_REFRESH_EXPIRES_IN_DAYS="7" \
  PASSWORD_HASH_ROUNDS="12" \
  RESEND_API_KEY="re_xxxxxxxxxxxx" \
  MAIL_FROM="noreply@lorestack.com" \
  APP_BASE_URL="https://api.lorestack.com" \
  FRONTEND_URL="https://lorestack.com" \
  CORS_ORIGIN="https://lorestack.com,https://www.lorestack.com" \
  GOOGLE_CLIENT_ID="xxxx.apps.googleusercontent.com" \
  GOOGLE_CLIENT_SECRET="GOCSPX-xxxx" \
  GOOGLE_CALLBACK_URL="https://api.lorestack.com/api/v1/auth/google/callback" \
  --app lorestack

# DATABASE_URL is set by `fly postgres attach` — do NOT set manually
```

| Secret | Where to get it |
|---|---|
| `JWT_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `MAIL_FROM` | Verified sender domain in Resend |
| `APP_BASE_URL` | Your Fly URL or custom domain |
| `FRONTEND_URL` | Your Vercel/frontend URL |
| `CORS_ORIGIN` | Same as FRONTEND_URL (comma-separated for multiple origins) |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credentials |
| `GOOGLE_CALLBACK_URL` | `https://your-api-domain/api/v1/auth/google/callback` |

---

## Cost Breakdown

| Resource | Spec | Monthly |
|---|---|---|
| App Machine | `shared-cpu-1x`, 512MB | ~$2 |
| Fly Postgres | `shared-cpu-1x`, 256MB, 10GB | ~$5 |
| Outbound data | ~10GB | ~$1 |
| **Total** | | **~$8/mo** |

> Upgrade app to 1GB RAM: ~$12/mo · Add second machine: ~$17/mo

---

*Last updated: May 2026*
