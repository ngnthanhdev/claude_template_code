# Deploy — Fly.io

Fly deploys `apps/api/Dockerfile` as a Fly App defined by `fly.toml`, with
Postgres as a separate Fly app. Good fit when you want the API running
close to users across regions.

## Build

Fly builds `apps/api/Dockerfile` itself during `fly deploy` (remote
builder by default — no local Docker daemon required).

## Deploy

```bash
brew install flyctl        # or see fly.io/docs/flyctl/install
fly auth login
cd apps/api
fly launch --dockerfile Dockerfile --no-deploy   # generates fly.toml, asks region/name
fly postgres create --name api-db                # separate Postgres app
fly postgres attach api-db                        # wires DATABASE_URL as a Fly secret
fly deploy
```

`fly launch` writes `apps/api/fly.toml` — commit it. For CI-driven deploys
(the `api-deploy.yml` marker step):

```yaml
- uses: superfly/flyctl-actions/setup-flyctl@master
- run: flyctl deploy --config apps/api/fly.toml --remote-only
  working-directory: apps/api
  env:
    FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

with `FLY_API_TOKEN` (`fly tokens create deploy`) stored as a GitHub
Actions secret.

## Env vars

```bash
fly secrets set JWT_SECRET="<value>" CORS_ORIGIN="<value>" --config apps/api/fly.toml
```

`DATABASE_URL` is set automatically by `fly postgres attach`. `PORT` — Fly
expects the app to listen on the port declared in `fly.toml`'s
`[[services]]` block (`internal_port`); `backend-patterns`'s bootstrap
already reads `process.env.PORT` and Fly injects `PORT` to match, so no
extra wiring is needed as long as `internal_port` agrees with it. Use a
separate Fly app (and a separate `api-db`) per environment, per
`docs/deploy/environments.md` — e.g. `api-staging`/`api-staging-db` and
`api-production`/`api-production-db`.

## Health check

`fly.toml`:

```toml
[[services.http_checks]]
  path = "/health"
  interval = "15s"
  timeout = "5s"
```

Fly won't finish a deploy (won't cut traffic over to the new machines)
until this check passes.

## Notes

- `fly status` / `fly logs` for deploy state and live logs.
- Fly bills per-resource even at low usage — check current free-allowance
  terms before treating it as a free staging host.
- Rollback: `fly releases` to list, then
  `fly deploy --image <previous-image-ref>` — Fly doesn't have a
  one-command "rollback"; redeploying a prior image is the mechanism.
