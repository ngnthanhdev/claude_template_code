# Deploy — Generic (any Docker-image host)

The pattern behind all four playbooks above, if your host is AWS ECS, GCP
Cloud Run, Azure Container Apps, DigitalOcean App Platform, or anything
else that runs a container image. Every one of them reduces to the same
five questions.

## 1. Build

Same source for every host: `docker build apps/api` produces the image
(`apps/api/Dockerfile`) — this already happens in `api-deploy.yml`'s image
step (see `docs/CI_CD.md`). Confirm your host builds from that same
Dockerfile, or accepts a pre-built image (push it to a registry the host
can pull from — ECR for ECS, Artifact Registry for Cloud Run, GHCR works
for most).

## 2. Deploy

Every host has one of two shapes:

- **You push an image, the host runs it** (ECS, Cloud Run, most App
  Platforms) — tag → push to the host's registry → update the
  service/revision to the new tag. This is the shape `docker-vps.md`
  half-manually replicates; a managed host usually has a one-command or
  one-API-call version (`aws ecs update-service`, `gcloud run deploy`).
  Automating this in `api-deploy.yml`'s marker step is almost always
  "call the host's official GitHub Action" (most major hosts publish one)
  rather than hand-rolling the API calls.
- **The host builds from your repo/Dockerfile directly** (Railway, Render,
  Fly — see their playbooks) — you point it at `apps/api` as the build
  context/root and it handles the image + push + rollout itself.

## 3. Env vars

Every host has an env var / secrets mechanism in its dashboard or CLI —
`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` always go there, never in the
Dockerfile or a committed file (Constitution Article V,
`docs/CONSTITUTION.md`). Most hosts inject their own `PORT`; check whether
yours does before hard-coding one — `nestjs-backend`'s bootstrap already
reads `process.env.PORT ?? 3000`, so it adapts either way. See
`docs/deploy/environments.md` for which vars are required and the
per-environment isolation rule (separate DB, separate secrets — staging
never shares with production).

## 4. Health check

Every host that does rolling/zero-downtime deploys needs a health-check
URL to know a new instance is actually ready before cutting traffic to it
— point yours at `GET /health` (`apps/api`'s health endpoint, per
`tasks/layer-0-todo.md`'s Layer 0 acceptance criterion). If your host
doesn't have a first-class health-check concept, wire an external uptime
check against the same path so you at least get alerted.

## 5. Notes

- Confirm your host runs the container listening on `0.0.0.0` (not
  `localhost`/`127.0.0.1`) — `nestjs-backend`'s Fastify bootstrap already
  does this, but it's the #1 "works locally, unreachable when deployed"
  mistake with containerized Node APIs.
- Confirm the host actually uses `apps/api` as the Docker build context
  (not the repo root) — a monorepo is the #2 mistake, where the host can't
  find the Dockerfile or copies the wrong files in.
- Once you've filled in `api-deploy.yml`'s placeholder for your specific
  host, consider writing a short `docs/deploy/<your-host>.md` of your own
  alongside these — future-you (or the next engineer) shouldn't have to
  rediscover the exact CLI flags from scratch.
