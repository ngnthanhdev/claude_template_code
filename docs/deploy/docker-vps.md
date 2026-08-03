# Deploy — Docker + VPS

Full control: you own the box. Uses the same image `api-deploy.yml`
already builds in CI (`docker build apps/api`) and runs it with Docker
directly on a VPS (Hetzner, a DigitalOcean Droplet, Linode, etc.) behind a
reverse proxy for TLS.

## Build

```bash
docker build -t api:$(git rev-parse --short HEAD) apps/api
```

Same command `api-deploy.yml` already runs (see `docs/CI_CD.md`) — this
playbook picks up right after that step: get the built image onto the VPS
and run it.

## Deploy

Push the image to a registry the VPS can pull from (GitHub Container
Registry is the path of least setup since you're already on GitHub
Actions):

```bash
# in api-deploy.yml, after the existing image step — replace `org` below
# with your GitHub org/user (unquoted `<org>` would be read as shell
# redirection, not a placeholder, so this uses a substituted variable
# instead):
org=your-gh-org
docker tag api:${{ github.sha }} "ghcr.io/$org/api:${{ github.sha }}"
docker tag api:${{ github.sha }} "ghcr.io/$org/api:latest"
echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
docker push "ghcr.io/$org/api:${{ github.sha }}"
docker push "ghcr.io/$org/api:latest"
```

Then, on the VPS (SSH manually the first time; scripted via SSH in CI for
repeat deploys):

```bash
org=your-gh-org   # same value used when pushing the image above
docker pull "ghcr.io/$org/api:latest"
docker stop api || true && docker rm api || true
docker run -d --name api --restart unless-stopped \
  --env-file /etc/api/.env \
  -p 127.0.0.1:3000:3000 \
  "ghcr.io/$org/api:latest"
```

Bind to `127.0.0.1` and put a reverse proxy (Caddy, Nginx, or Traefik) in
front for TLS termination and the public `:443` listener — don't expose
the container's port directly to the internet.

For CI-driven deploys (the `api-deploy.yml` marker step), SSH in and run
the `docker pull`/`stop`/`run` sequence above via `appleboy/ssh-action` (or
equivalent), authenticated with a deploy-only SSH key stored as a GitHub
Actions secret.

## Env vars

`/etc/api/.env` on the VPS, **not** in git, permissions locked down:

```bash
ssh deploy@your-vps 'sudo mkdir -p /etc/api && sudo chmod 700 /etc/api'
scp .env.production deploy@your-vps:/tmp/api.env   # transfer once, out-of-band
ssh deploy@your-vps 'sudo mv /tmp/api.env /etc/api/.env && sudo chmod 600 /etc/api/.env'
```

Populate it with `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT` (see
`docs/deploy/environments.md`), pointed at whichever Postgres this VPS's
environment uses (self-hosted on the same box, a managed instance, or a
separate VPS — never the same database as another environment).

## Health check

```bash
curl -sf http://127.0.0.1:3000/health || echo "unhealthy"
```

Wire this into your reverse proxy's own health check (Caddy/Nginx upstream
health) and/or a `docker run --health-cmd` on the container itself, so a
crashed API gets detected and can trigger a restart or an alert rather
than silently serving errors.

## Notes

- You own OS patching, Docker daemon updates, disk space (old images pile
  up — run `docker image prune` periodically), and TLS cert renewal
  (`certbot`, or Caddy's automatic HTTPS).
- No managed rollback — redeploying the previous image tag
  (`docker run ... ghcr.io/<org>/api:<previous-sha>`) is the mechanism;
  keep at least the last few tagged images available in the registry.
- This is the most manual option in this directory — pick it when you
  specifically want the control (or already run VPS infrastructure), not
  by default.
