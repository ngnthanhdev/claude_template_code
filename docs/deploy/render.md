# Deploy — Render

Render deploys from a `render.yaml` blueprint (infrastructure-as-code) or a
plain Dockerfile web service. Good fit for a declarative, git-tracked
deploy config and a free tier that's usable for staging.

## Build

Render builds `apps/api/Dockerfile` directly — the same Dockerfile
`api-deploy.yml` already builds for CI (`docker build apps/api`).

## Deploy

Add `render.yaml` at the repo root (Render auto-detects it on connect):

```yaml
services:
  - type: web
    name: api
    runtime: docker
    dockerfilePath: apps/api/Dockerfile
    dockerContext: apps/api
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: api-db
          property: connectionString
      - key: JWT_SECRET
        sync: false        # set manually in the dashboard — never in git
      - key: CORS_ORIGIN
        sync: false

databases:
  - name: api-db
    plan: starter
```

Connect the repo in the Render dashboard (**New → Blueprint**), pointing at
this file — it provisions the web service and the Postgres database
together. For CI-driven redeploys (the `api-deploy.yml` marker step), use a
**deploy hook**:

```bash
curl -X POST "$RENDER_DEPLOY_HOOK_URL"
```

with `RENDER_DEPLOY_HOOK_URL` (from **Service → Settings → Deploy Hook**)
stored as a GitHub Actions secret.

## Env vars

Set in the Render dashboard (**Service → Environment**) or in
`render.yaml` as above — `sync: false` means "required, but set it in the
dashboard, not in this git-tracked file." `DATABASE_URL` is wired
automatically from the `fromDatabase` reference. `PORT` is injected by
Render itself — do not set it manually. Use separate services (and a
separate `api-db`) for staging vs. production, per
`docs/deploy/environments.md`.

## Health check

`healthCheckPath: /health` in the blueprint above (matches `apps/api`'s
`GET /health` endpoint). Render won't route traffic to a new deploy until
this path returns `200`, and rolls back automatically if it never does.

## Notes

- Free-tier web services spin down after inactivity (a cold start on the
  next request) — fine for staging, use a paid plan for production to
  avoid it.
- **Logs** tab in the dashboard, or `render logs -r <service>` via the
  Render CLI, for live output.
- Rollback: **Events** tab → a previous successful deploy → **Rollback to
  this deploy**.
