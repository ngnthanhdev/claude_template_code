---
name: security-review
description: Use when auditing a diff/PR (in apps/api or apps/mobile) for security issues before merge — tracing untrusted input to a sensitive sink, checking authorization boundaries, injection, file upload, secrets, rate limiting, and error leakage. Complements code-reviewer (correctness/simplification), not a replacement for it. Run security-threat-model instead when planning a large feature before code exists.
---

# security-review

A focused security audit of a **diff or PR**, not a general code review.
Where the `code-reviewer` subagent looks for correctness bugs and
simplification opportunities, this skill looks for one thing only: can an
untrusted actor make this diff do something it shouldn't. Run it on the diff
produced by a layer's tasks, before merge — not as a substitute for
`code-reviewer`, alongside it.

## Goal

Every finding reported is **high-confidence** — a concrete, traceable path
from an attacker-controlled input to a sensitive sink, not a hypothetical
"this pattern can sometimes be risky" observation. State explicitly in the
report that low-confidence/speculative concerns were filtered out rather
than listed as findings. A security review that reports everything that
*could* be a problem is noise an engineer learns to ignore; a review that
reports only what *is* a problem gets acted on.

## Method — trace untrusted input to sensitive sink

For every changed handler/controller/service method in the diff:

1. **Identify entry points.** HTTP request body/query/params (`apps/api`),
   deep-link params or WebView messages (`apps/mobile`), any value that
   crosses a trust boundary from a client the server doesn't control.
2. **Follow the value.** Does it reach a sensitive sink unsanitized/unvalidated?
   - A **database write or query** (Prisma call, raw SQL).
   - An **authorization decision** (does this value select *which* record,
     bypassing the authenticated user's actual scope?).
   - A **file path or upload destination**.
   - An **external call** (outbound HTTP/webhook/URL fetch built from user input).
   - A **shell command or dynamic `eval`**.
3. **Check what stands between the two.** A `nestjs-zod` DTO validating
   shape isn't the same as validating *ownership* — a value can be
   well-typed and still let one user act on another user's data.

## Checklist (apply per diff, not exhaustively line-by-line)

- **Authorization / privilege boundaries (BOLA/IDOR).** Does every lookup by
  ID scope to the authenticated user or the resource's parent, or does it
  trust a bare `id` from the client? (See `backend-auth-security`'s BOLA/IDOR
  section for the two concrete Prisma patterns this template expects.)
- **Mass assignment.** Does a service spread a client DTO straight into a
  Prisma `create`/`update`, letting the client set fields it shouldn't
  control (`ownerId`, `role`, `isAdmin`, `price`)?
- **DTO validation.** Does every new/changed endpoint validate its body via
  a `nestjs-zod` DTO backed by a `packages/shared` schema, or does a raw
  `@Body()` reach a service unchecked?
- **Injection.** Any raw SQL (`$queryRawUnsafe`, string-concatenated query),
  shell command built from user input, or template/`eval` construction from
  untrusted data?
- **File upload.** Is the MIME type/extension checked server-side (not just
  trusted from the client's declared `Content-Type`)? Is the upload path
  derived from user input in a way that could traverse (`../`)? Is there a
  size limit?
- **Secrets.** Any credential, token, or API key that should come from
  `ConfigService`/env instead appearing as a literal in the diff?
- **Rate limiting.** Does a new auth, password-reset, or otherwise
  brute-forceable endpoint have `@fastify/rate-limit` (or an equivalent
  guard) applied, or is it wide open?
- **Error leakage.** Does a new error path return a raw stack trace,
  internal exception message, or Prisma error detail to the client instead
  of going through the global exception filter?

## Report format

Report **only** findings that survive the high-confidence bar above. For
each finding, use exactly this structure — no partial entries:

- **Severity** — Critical / High / Medium / Low.
- **File and line** — the exact location in the diff.
- **Exploitation scenario** — the concrete request/input an attacker sends
  and what state that puts the system in.
- **Impact** — what the attacker gains (data disclosure, privilege
  escalation, data corruption, DoS).
- **Concrete remediation** — the actual code change, not "add validation".
- **Regression test** — the specific test (Jest/Supertest for `apps/api`,
  RTL/Maestro for `apps/mobile`) that would catch this if it regressed.
- **OWASP category** — ASVS category/chapter for `apps/api` findings,
  MASVS category for `apps/mobile` findings (pair with `expo-security` for
  the mobile-specific checks this skill's checklist doesn't cover in depth).

If nothing high-confidence was found, say so explicitly rather than padding
the report with speculative items.

## Do

- State the confidence filter explicitly in every report, even when it
  found nothing.
- Trace a concrete data path for every finding — input to sink, not a
  pattern match against a keyword.
- Cite the exact ASVS/MASVS category so the finding maps to a standard, not
  just a house opinion.

## Don't

- Don't restate what `code-reviewer` already covers (naming, duplication,
  simplification) — that's a different skill's job.
- Don't report a finding without all six fields — an incomplete finding
  isn't actionable.
- Don't flag a theoretical concern with no traceable input-to-sink path;
  note it as a non-issue with a one-line reason instead of inflating the
  finding count.
