---
name: security
description: The single security skill — diff/PR audit method with a high-confidence bar (BOLA/IDOR, mass assignment, DTO validation, injection, secrets, rate limiting), STRIDE threat modeling before large features, backend auth hardening (guards, Passport, RBAC, CORS/CSRF, OWASP ASVS), and mobile hardening (MASVS: token storage, deep links, WebView, build config). Load the SKILL.md for routing, then read ONLY the references/ file matching the job.
---

# Security

One skill, four jobs. **Pick the reference matching the job — don't read
all four:**

| Job | Read |
|---|---|
| Audit a diff/PR/path for high-confidence findings (`/security-review`, `reviewer`'s security lens) | `references/review.md` |
| STRIDE + trust boundaries before building a large feature (`/threat-model`) | `references/threat-model.md` |
| Implement/ review backend auth: guards, Passport, RBAC, CORS/CSRF, helmet, OWASP top-10, ASVS | `references/backend.md` |
| Implement/review mobile hardening to MASVS: token storage, deep links, WebView, build config | `references/mobile.md` |

## Non-negotiables (Constitution Articles V & VI)

- Client-supplied ids are never trusted: every lookup scopes to the
  authenticated user or the resource's owner (BOLA/IDOR).
- Writes use explicit field allowlists — no client-DTO spread into
  persistence (mass assignment).
- Standards: OWASP **ASVS** for `apps/api`, **MASVS** for `apps/mobile`
  (tool matrix + workflow in `docs/SECURITY.md`).
- Findings are reported only at high confidence — a traceable path from
  attacker-controlled input to a sensitive sink; an empty report is valid.
