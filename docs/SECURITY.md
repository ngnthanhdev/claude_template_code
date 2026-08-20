# Security

This template's security posture in one place: the standards it verifies
against, the tools that check for what a human/agent review misses, and the
point in the workflow each one runs.

## Standards

- **OWASP ASVS** (Application Security Verification Standard) — the backend
  standard. `apps/api` findings (authentication, access control, input
  validation, injection) map to an ASVS chapter/category. Used throughout
  the `security` skill (references/backend.md and references/review.md).
- **OWASP MASVS** (Mobile Application Security Verification Standard) — the
  mobile standard, for `apps/mobile`. Backed by **MASWE** (the weakness
  enumeration behind each MASVS control) and **MASTG** (the testing guide
  with concrete verification steps for each one). Used throughout
  the `security` skill (references/mobile.md).

Every finding produced by the `security` skill's review or mobile references cites the
relevant ASVS or MASVS category — a finding without one isn't tied to a
verifiable standard.

## Tool matrix

| Concern | Tool | Notes |
|---|---|---|
| NestJS SAST (static analysis) | Semgrep or CodeQL | Runs against source in CI; catches pattern-level issues (injection, unsafe deserialization) the `security` skill's manual trace complements but doesn't replace. |
| Dependency vulnerabilities | Dependabot or Renovate | Automated PRs for outdated/vulnerable `package.json` dependencies across the workspace. |
| Committed secrets | Gitleaks | Scans git history/diffs for credential-shaped strings before they land on `main`. |
| Container/IaC | Trivy | Scans the API's Docker image (`apps/api`'s `Dockerfile`, built in `api-deploy.yml`) and any IaC for known CVEs/misconfiguration. |
| Running API | OWASP ZAP | Dynamic scan against a **running** `apps/api` instance — needs a live target, see workflow note below. |
| Built mobile binary | MobSF | Static/dynamic scan of a **built** APK/IPA — needs a build artifact, see workflow note below. |

## Workflow — where each step runs

1. **Threat-model the feature** — `security` (references/threat-model.md — STRIDE + trust
   boundaries), during Phase 0/brainstorming or `/refine`, before code exists.
2. **Implement the NestJS API** — guards, DTOs, scoped Prisma queries per
   `security` (references/backend.md) and `backend-patterns`.
3. **Implement the Expo client** — secure token storage, validated
   deep links, minimal persistence per the `security` skill (references/mobile.md).
4. **Security review on the diff** — the `reviewer` subagent's security lens
   (or `/security-review` for a standalone pass): high-confidence findings
   before merge.
5. **Run scanners in CI** — `.github/workflows/security.yml` (Gitleaks
   secret scan, Semgrep SAST against `p/typescript p/javascript
   p/owasp-top-ten p/nodejsscan`, and `pnpm audit --audit-level=high` for
   dependency vulnerabilities) plus `.github/dependabot.yml` (weekly `npm`
   updates for the workspace root, `apps/mobile`, `apps/api`,
   `packages/shared`, and weekly `github-actions` updates). All
   source/dependency-level, no running app or build artifact required, so
   this fits the "no heavy builds in CI" rule this template otherwise
   enforces (`CLAUDE.md`'s Token discipline section). Each `security.yml`
   step runs `continue-on-error` today since `apps/*`/`packages/shared` are
   still empty skeletons — it becomes a real gate once they're scaffolded
   and you choose to remove that.
6. **Build production, then scan the artifact** — OWASP ZAP against a
   deployed/running API, MobSF against the built APK/IPA, at release time.

## ZAP and MobSF are manual, release-time steps — not CI

Unlike the four scanners in step 5, **ZAP and MobSF are not run in this
template's CI**:

- **ZAP** needs a running `apps/api` instance to point at. This template's
  CI (`ci.yml`) runs `lint`/`typecheck`/`test` against source — it never
  boots a live, network-reachable instance of the API for a scanner to hit.
- **MobSF** needs a built APK/IPA. Building one is exactly the "heavy build"
  (`eas build`, `expo run:*`) this template's CI and `block-build-output.sh`
  hook deliberately keep out of routine sessions (`CLAUDE.md`'s Token
  discipline section, `docs/CI_CD.md`).

Run both manually (or from a separate, deliberately-triggered pipeline) at
release time: ZAP against a staging deployment before promoting to
production, MobSF against the artifact an EAS production build
(`eas-production.yml`) produces before submitting it to the app stores.

## Skills

One skill, `security`, with four on-demand references:

- `references/threat-model.md` — run before a large feature is built.
- `references/backend.md` — apply while building the NestJS API.
- `references/mobile.md` — apply while building the Expo client.
- `references/review.md` — run on the diff before merge.
