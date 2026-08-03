# Deploy — Railway

Railway builds directly from your Dockerfile (`apps/api/Dockerfile`, once
Layer 0 scaffolds it) and provisions a managed Postgres with one command.
Good fit for the fastest path to a running API + DB with almost no config.

## Build

Railway builds the image itself from `apps/api/Dockerfile` — you don't run
`docker build` locally as part of this flow (CI's `api-deploy.yml` still
does, for the "does the Dockerfile itself work" signal — see
`docs/CI_CD.md`).

## Deploy

```bash
npm install -g @railway/cli
railway login
railway init                       # once, links this repo to a Railway project
railway add --database postgres    # provisions managed Postgres, sets DATABASE_URL
railway up --service api           # builds apps/api/Dockerfile and deploys it
```

Point Railway at the `apps/api` subdirectory as the build root: in the
service's **Settings → Build → Root Directory**, set `apps/api` (Railway
otherwise builds from the repo root, which has no Dockerfile).

For CI-driven deploys (the `api-deploy.yml` marker step), use:

```bash
railway up --service api --ci
```

authenticated via `RAILWAY_TOKEN` (a project token from **Settings →
Tokens**), stored as a GitHub Actions secret.

## Env vars

```bash
railway variables --set "JWT_SECRET=<value>" --set "CORS_ORIGIN=<value>" --service api
```

`DATABASE_URL` is set automatically by `railway add --database postgres`.
`PORT` is injected by Railway itself — do not set it manually (see
`docs/deploy/environments.md`). Use a separate Railway **environment**
(Railway's own staging/production split) or a separate project entirely
for staging vs. production — never point both at the same Postgres
instance.

## Health check

Set **Settings → Healthcheck Path** to `/health`, matching `apps/api`'s
health endpoint (`GET /health`, per `tasks/layer-0-todo.md`'s Layer 0
acceptance criterion). Railway uses this to confirm a deploy actually
succeeded before routing traffic to it.

## Notes

- Railway's free tier sleeps/limits usage — fine for staging, budget a paid
  plan for production.
- `railway logs --service api` for live deploy/runtime logs.
- Rollback: **Deployments** tab → a previous deployment → **Redeploy**.
