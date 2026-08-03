# Environments

Three environments, regardless of which provider you pick from
`docs/deploy/`. This file is provider-agnostic; the provider playbooks only
add the *how* for each one.

## The three environments

| Environment | Runs where | API URL | Database | Deploys on |
|---|---|---|---|---|
| **Development** | Your machine | `http://localhost:<PORT>` (see `.env`) | Local Postgres (or the provider's free dev instance) | Manual (`pnpm --filter api dev`) |
| **Staging** | Your chosen provider, a separate app/service from prod | Provider-assigned URL, or `https://api-staging.<your-domain>` | Separate managed Postgres instance from prod — never shared | On push to `develop` (see "What ships today" below) |
| **Production** | Your chosen provider | `https://api.<your-domain>` | Separate managed Postgres instance from staging | Manual trigger only, from `main`, behind the `production` GitHub Environment's required reviewers — the same gating `eas-production.yml` already uses (see `docs/CI_CD.md`) |

Staging and production are **never** the same database or the same
provider project/app — a migration or a bad write in staging must not be
able to touch production data.

## Env var management

Per **Constitution Article V** (`docs/CONSTITUTION.md`) — secrets never in
code, regardless of how low-risk they look:

- **Local (`.env`)** — copy `.env.example`, fill in real values; already
  gitignored (`.gitignore` excludes `.env` and `.env.*.local`). Never
  commit it, never paste a real value into a task/PR description.
- **Staging / production** — set directly in the provider's own env var /
  secrets UI or CLI (Railway variables, Render environment groups, Fly
  secrets, or a VPS's root-only `.env` file). Each provider playbook lists
  the exact command. **Never** put a staging or production secret in a
  GitHub Actions workflow file, a committed `.env`, or a task/PR
  description — GitHub Actions **Secrets**
  (`Settings → Secrets and variables → Actions`) are only for what a
  workflow step itself needs to reach the provider (a deploy token), not
  for the app's own runtime secrets.
- **Rotation** — if a secret leaks (committed by accident, shared in a
  screenshot, etc.), rotate it at the provider/issuer first, then update it
  in every environment that used it. Deleting the git history entry alone
  does not make the leaked value safe to keep using.

## Required env vars (all environments)

From `.env.example` — every provider playbook's **Env vars** section maps
these to that provider's mechanism:

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string (Prisma) — a different value per environment, never shared |
| `JWT_SECRET` | Auth token signing — a different value per environment; never reuse a dev value in staging/prod |
| `PORT` | Fastify listen port (`nestjs-backend`'s bootstrap reads `process.env.PORT`) — most providers inject this themselves; only set it manually on a VPS |
| `CORS_ORIGIN` | Comma-separated allowed origins (also read in `nestjs-backend`'s bootstrap) — the mobile app's EAS Update URL / your web origin, per environment |

## Promotion flow

```
feature branch → PR → merge to develop → (staging deploy)
                                              │
                                   verify staging (manual QA / smoke test)
                                              │
                              PR: develop → main → human-reviewed merge
                                              │
                        api-deploy.yml (push: main) → PRODUCTION
                     gated by the production GitHub Environment's
                     required reviewers, same as eas-production.yml
```

- A feature never deploys to production directly — it lands on `develop`
  first, deploys to staging, and only reaches `main` (and therefore
  production) through a reviewed PR.
- This mirrors `docs/CI_CD.md`'s existing rule for EAS — "production
  deploys are never automatic" — the API follows the same discipline the
  mobile pipeline already established, not a separate standard.
- **What ships today:** `api-deploy.yml` triggers on push to `main` and
  manual dispatch only (see `docs/CI_CD.md`) — it deploys production,
  gated as above. It does **not** yet have a `develop` trigger for the
  staging leg of this diagram.
- **To wire staging deploy:** add a `develop` trigger — either a second job
  in `api-deploy.yml` or a separate `api-deploy-staging.yml` — running the
  same Deploy step from your chosen provider playbook, pointed at the
  staging service/DB instead of production, with no reviewer gate (staging
  is meant to be fast to iterate on). Until you do, treat a green `develop`
  build plus a manual deploy/smoke-test as the interim staging gate.
