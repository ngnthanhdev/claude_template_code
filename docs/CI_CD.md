# CI/CD

Five GitHub Actions workflows live in `.github/workflows/`. `CLAUDE.md`
`@`-imports this file so Claude always knows the gate rules before it commits
anything meant to ship.

## The five workflows

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | every pull request; push to `main`/`develop` | Quality gate: `pnpm install --frozen-lockfile` then `pnpm turbo run lint typecheck test` across every app/package in the workspace. |
| `security.yml` | every pull request; push to `main`/`develop` | Gitleaks (secret scan), Semgrep (SAST against `p/typescript p/javascript p/owasp-top-ten p/nodejsscan`), and `pnpm audit --audit-level=high` (dependency vulnerabilities). Each step runs `continue-on-error` today since `apps/*`/`packages/shared` are still empty skeletons; see `docs/SECURITY.md`. |
| `eas-preview.yml` | push to `develop`; manual (`workflow_dispatch`) | Builds an internal-distribution EAS **preview** build of the mobile app (`eas build --profile preview --platform all --non-interactive`), for QA on real devices without going through the app stores. |
| `eas-production.yml` | manual (`workflow_dispatch`) only | Builds the **production** EAS profile (and optionally `eas submit`s it) from the `production` GitHub environment, so it can require manual approval before running. Never fires on a normal push. |
| `api-deploy.yml` | push to `main`; manual (`workflow_dispatch`) | Builds the API's Docker image (`docker build apps/api`). The actual deploy step is a **provider-agnostic placeholder** — see below. |

`.github/dependabot.yml` runs alongside these workflows (not itself a
workflow file): weekly `npm` updates for the workspace root,
`apps/mobile`, `apps/api`, `packages/shared`, plus weekly `github-actions`
updates for `.github/workflows/` itself. It also finds nothing to update in
the app/package directories until they're scaffolded.

**ZAP and MobSF remain manual, release-time steps**, not part of any of
these five workflows — see `docs/SECURITY.md` for why (both need a
running/built artifact `security.yml` doesn't produce).

## Required secret: `EXPO_TOKEN`

Both EAS workflows need an Expo access token in this repo's
**Settings → Secrets and variables → Actions → `EXPO_TOKEN`**. Create one at
`https://expo.dev/accounts/[account]/settings/access-tokens`.

- Each EAS job sets `EXPO_TOKEN` as a job-level `env` from the secret, then
  guards its build/submit step with `if: env.EXPO_TOKEN != ''`. Without the
  secret configured, the workflow still runs (checkout, install, Expo CLI
  setup) but skips the build step instead of failing loudly — a fork or a
  fresh clone without the secret set won't get a red X for a step that could
  never have worked.
- `eas-production.yml` additionally scopes its job to the `production`
  GitHub environment, so the secret (and the run itself) can be gated behind
  required reviewers if you configure that environment's protection rules.

## Gate rules

- **`ci.yml` is the merge gate.** A pull request should not merge with a red
  `quality` job. This is the CI-side enforcement of the "no advancing layers
  before tests pass" discipline in `docs/WORKFLOW.md`.
- **EAS builds are opt-in, not blocking.** `eas-preview.yml` and
  `eas-production.yml` never gate a merge — they produce build artifacts,
  they don't validate code correctness. `ci.yml` already does that.
- **Production deploys are never automatic.** `eas-production.yml` and
  `api-deploy.yml`'s real deploy step should only run from an explicit,
  intentional trigger (`workflow_dispatch`, or a push to `main` you've
  reviewed) — never from a feature branch or a draft PR.

## `api-deploy.yml` is provider-agnostic on purpose

This template doesn't pick a hosting provider for the API. `api-deploy.yml`
builds the Docker image and then stops at a single, explicit marker comment
naming the one step left for you to fill in: your host's deploy command.

This is the only unfinished placeholder shipped anywhere in the template —
everything else ships as complete, working content. When you've picked a
host — Fly.io, Render, Railway, AWS ECS, or anything else that takes a built
Docker image — replace that marker line with the provider's deploy
step/action. Until then, the workflow builds the image (so you get an early
signal if the Dockerfile itself is broken) without assuming a host.
