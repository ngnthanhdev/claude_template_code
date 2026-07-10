# Security

This template's security posture in one place: the standards it verifies
against, the tools that check for what a human/agent review misses, and the
point in the workflow each one runs.

## Standards

- **OWASP ASVS** (Application Security Verification Standard) — the backend
  standard. `apps/api` findings (authentication, access control, input
  validation, injection) map to an ASVS chapter/category. Used throughout
  `backend-auth-security` and `security-review`.
- **OWASP MASVS** (Mobile Application Security Verification Standard) — the
  mobile standard, for `apps/mobile`. Backed by **MASWE** (the weakness
  enumeration behind each MASVS control) and **MASTG** (the testing guide
  with concrete verification steps for each one). Used throughout
  `expo-security`.

Every finding produced by `security-review` or `expo-security` cites the
relevant ASVS or MASVS category — a finding without one isn't tied to a
verifiable standard.

## Tool matrix

| Concern | Tool | Notes |
|---|---|---|
| NestJS SAST (static analysis) | Semgrep or CodeQL | Runs against source in CI; catches pattern-level issues (injection, unsafe deserialization) `security-review`'s manual trace complements but doesn't replace. |
| Dependency vulnerabilities | Dependabot or Renovate | Automated PRs for outdated/vulnerable `package.json` dependencies across the workspace. |
| Committed secrets | Gitleaks | Scans git history/diffs for credential-shaped strings before they land on `main`. |
| Container/IaC | Trivy | Scans the API's Docker image (`apps/api`'s `Dockerfile`, built in `api-deploy.yml`) and any IaC for known CVEs/misconfiguration. |
| Running API | OWASP ZAP | Dynamic scan against a **running** `apps/api` instance — needs a live target, see workflow note below. |
| Built mobile binary | MobSF | Static/dynamic scan of a **built** APK/IPA — needs a build artifact, see workflow note below. |

## Workflow — where each step runs

1. **Threat-model the feature** — `security-threat-model` (STRIDE + trust
   boundaries), during Phase 0/brainstorming or `/refine`, before code exists.
2. **Implement the NestJS API** — guards, DTOs, scoped Prisma queries per
   `backend-auth-security` and `database-orm`.
3. **Implement the Expo client** — secure token storage, validated
   deep links, minimal persistence per `expo-security`.
4. **`security-review` on the diff** — high-confidence findings before merge,
   complementing `code-reviewer`'s correctness/simplification pass.
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

- `security-threat-model` — run before a large feature is built.
- `backend-auth-security` — apply while building the NestJS API.
- `expo-security` — apply while building the Expo client.
- `security-review` — run on the diff before merge.
