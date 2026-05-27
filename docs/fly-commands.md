# Fly.io CLI Commands — Lorestack

> App: `lorestack` · Postgres: `lorestack-postgres` · Region: `sin`  
> Run all commands from **PowerShell or CMD** (not WSL — WSL drops long-running connections)

---

## Auth

| Command | What it does |
|---|---|
| `fly auth login` | Open browser to sign in to Fly |
| `fly auth whoami` | Show currently logged-in account |
| `fly auth logout` | Log out |

---

## Deploy

| Command | What it does |
|---|---|
| `fly deploy --app lorestack` | Build locally and deploy |
| `fly deploy --remote-only --app lorestack` | Build on Fly's servers (faster, uses cache) |
| `fly deploy --image registry.fly.io/lorestack:deployment-XXXXX --app lorestack` | Deploy a specific previous image (rollback) |

---

## App Status

| Command | What it does |
|---|---|
| `fly status --app lorestack` | Show app info, machine states, health check status |
| `fly releases --app lorestack` | List all past deploys with version numbers and image refs |
| `fly dashboard --app lorestack` | Open the web dashboard in browser (metrics, logs, deploys) |
| `fly open --app lorestack` | Open the app URL in browser |

---

## Logs

| Command | What it does |
|---|---|
| `fly logs --app lorestack` | Stream live logs |
| `fly logs --app lorestack -n 100` | Show last 100 log lines |
| `fly logs --app lorestack --machine 5683e769ad9068` | Logs from a specific machine only |

---

## Secrets (Environment Variables)

| Command | What it does |
|---|---|
| `fly secrets list --app lorestack` | List all secret names (values are always hidden) |
| `fly secrets set KEY="value" --app lorestack` | Add or update a secret (triggers redeploy) |
| `fly secrets set K1="v1" K2="v2" --app lorestack` | Set multiple secrets at once |
| `fly secrets unset KEY --app lorestack` | Delete a secret |

---

## Machines

| Command | What it does |
|---|---|
| `fly machines list --app lorestack` | List all machines with IDs, state, region |
| `fly machines start <machine-id> --app lorestack` | Start a stopped machine |
| `fly machines restart <machine-id> --app lorestack` | Restart a running machine |
| `fly machines stop <machine-id> --app lorestack` | Gracefully stop a machine |
| `fly machines destroy <machine-id> --app lorestack` | Permanently delete a machine |

---

## Scaling

| Command | What it does |
|---|---|
| `fly scale show --app lorestack` | Show current machine count and size |
| `fly scale count 2 --app lorestack` | Run 2 machines (load balanced) |
| `fly scale count 1 --app lorestack` | Scale back to 1 machine |
| `fly scale memory 1024 --app lorestack` | Set RAM to 1GB |
| `fly scale vm shared-cpu-2x --app lorestack` | Change VM size |
| `fly platform vm-sizes` | List all available VM sizes and prices |

---

## Tokens (CI/CD)

| Command | What it does |
|---|---|
| `fly tokens create deploy -a lorestack` | Create a deploy token for GitHub Actions (`FLY_API_TOKEN`) |
| `fly tokens list -a lorestack` | List all tokens for the app |

---

## SSH / Debug

| Command | What it does |
|---|---|
| `fly ssh console --app lorestack` | Open a shell inside the running container |
| `fly ssh console --app lorestack -C "printenv"` | Print all env vars / secrets inside container |
| `fly ssh console --app lorestack -C "pnpm prisma:seed"` | Run DB seeder inside container |
| `fly ssh console --app lorestack -C "ls /app/dist"` | Check built files inside container |

---

## Database (Postgres)

| Command | What it does |
|---|---|
| `fly postgres connect -a lorestack-postgres` | Open an interactive Postgres shell |
| `fly postgres connect -a lorestack-postgres --command "SELECT count(*) FROM users;"` | Run a single SQL query |
| `fly postgres restart -a lorestack-postgres` | Restart the Postgres app |
| `fly postgres attach lorestack-postgres --app lorestack` | Wire Postgres to app (sets `DATABASE_URL` secret) |
| `fly postgres detach lorestack-postgres --app lorestack` | Remove the Postgres connection |

---

## Certs (Custom Domain SSL)

| Command | What it does |
|---|---|
| `fly certs add api.lorestack.com --app lorestack` | Add a custom domain and start SSL provisioning |
| `fly certs check api.lorestack.com --app lorestack` | Check SSL certificate status |
| `fly certs list --app lorestack` | List all configured domains and cert status |
| `fly certs remove api.lorestack.com --app lorestack` | Remove a custom domain |

---

## Apps

| Command | What it does |
|---|---|
| `fly apps list` | List all your Fly apps |
| `fly apps create lorestack` | Register a new app name (does not deploy) |
| `fly apps destroy lorestack` | Permanently delete an app and all its machines |

---

## Common Workflows

**Rollback to previous version:**
```bash
# 1. Find the image ref of the version you want
fly releases --app lorestack

# 2. Deploy that specific image
fly deploy --image registry.fly.io/lorestack:deployment-XXXXX --app lorestack
```

**Check why the app crashed:**
```bash
fly logs --app lorestack
# Look for ERROR lines near the bottom
```

**Update a single env var without full redeploy:**
```bash
fly secrets set CORS_ORIGIN="https://new-frontend.vercel.app" --app lorestack
# Setting a secret triggers an automatic rolling redeploy
```

**Fix a migration that failed partway:**
```bash
fly ssh console --app lorestack -C \
  "pnpm prisma migrate resolve --rolled-back <migration_name>"
```

**Run DB seed in production (careful):**
```bash
fly ssh console --app lorestack -C "pnpm prisma:seed"
```
