# API deploy playbooks

This template doesn't pick a hosting provider for `apps/api` —
`docs/deploy/` is where you do, once, and it's a concrete playbook for each
realistic choice. **Mobile deploy is EAS**, already fully wired
(`.github/workflows/eas-preview.yml`, `eas-production.yml` — see the
`expo-eas-pipeline` skill and `docs/CI_CD.md`); nothing in this directory
duplicates that.

## Pick one API host

| Provider | File | Good fit when |
|---|---|---|
| Railway | [`railway.md`](./railway.md) | You want the fastest path to a running Postgres + API with almost no config. |
| Render | [`render.md`](./render.md) | You want a free-tier-friendly host with a declarative `render.yaml` blueprint. |
| Fly.io | [`fly.md`](./fly.md) | You want the API running close to users across regions. |
| Docker + VPS | [`docker-vps.md`](./docker-vps.md) | You want full control (or already run a VPS) and are comfortable owning the box. |
| Generic (any Docker host) | [`generic.md`](./generic.md) | Your host isn't one of the above but takes a Docker image (AWS ECS, GCP Cloud Run, DigitalOcean App Platform, ...). |

Every playbook covers the same five things for its provider: **build →
deploy → env vars → health check → notes**. Read
[`environments.md`](./environments.md) first — it covers what's true
regardless of provider: which environment exists where, how env vars are
managed, and the feature → staging → production promotion flow.

## How this wires into `api-deploy.yml`

`.github/workflows/api-deploy.yml` builds the API's Docker image
(`docker build apps/api`) and then stops at a marker comment — the one
intentional placeholder this template ships (see `docs/CI_CD.md`). Once
you've picked a provider above:

1. Open its playbook and copy the **Deploy** step's CLI command or GitHub
   Action into `api-deploy.yml`, replacing the marker comment.
2. Add whatever secret that step needs (a deploy token, an API key) to this
   repo's **Settings → Secrets and variables → Actions**, alongside the
   `EXPO_TOKEN` secret the EAS workflows already use.
3. Commit the workflow change (`ci(deploy): wire <provider> deploy step
   into api-deploy.yml`).

Nothing else in `api-deploy.yml` changes — the image step, its triggers
(push to `main`, manual dispatch), and the "production deploys are never
automatic from a feature branch" rule in `docs/CI_CD.md` all stay as they
are.
