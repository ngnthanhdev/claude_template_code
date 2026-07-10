---
name: security-threat-model
description: Use before implementing a large feature (during Phase 0/brainstorming or /refine, before code exists) — STRIDE per element, trust boundaries between the untrusted mobile client, the NestJS API, the database, and external services, and a threat list mapped to ASVS/MASVS mitigations. Run this before security-review, which audits the diff after the feature is built.
---

# security-threat-model

Threat-model a feature **before** writing code for it — during `/phase-0`,
the `brainstorming` skill's design pass, or `/refine` for a feature-sized
change. This is the "should this be built this way" pass; `security-review`
is the "was it built safely" pass that runs on the resulting diff. Running
this first is cheaper than finding the same problem in review after the
Prisma schema and API contract are already written.

## When to run this

- Before a feature large enough to introduce a new trust boundary, a new
  data flow across mobile → API → database, or a new privilege level (e.g.
  admin actions, another user's data becoming visible, a new external
  integration).
- During Phase 0 (`docs/phases/phase-0.md`) or `/refine`, as part of
  proposing the design — not bolted on after the design doc is written.
- Not needed for a small, same-trust-boundary change (e.g. adding a field to
  an existing, already-scoped resource) — that's what `security-review`
  catches on the diff.

## Trust boundaries in this stack

Treat every boundary crossing as a place an attacker can tamper with data in
transit:

```
[ Mobile app (untrusted) ] --HTTPS/JWT--> [ NestJS API ] --Prisma--> [ Database ]
                                                |
                                                +--> [ External services (webhooks, third-party APIs) ]
```

- **Mobile is an untrusted client**, full stop. Anything the app enforces
  client-side (a hidden button, a disabled field, a role check in a
  `useEffect`) is UX, not security — a jailbroken/rooted device or a
  modified request bypasses it trivially. Every authorization decision must
  be re-checked server-side; see `expo-security`'s trust-model section for
  the client-side implications and `backend-auth-security` for the
  server-side guard pattern.
- **Mobile ↔ API** is the boundary a network attacker or a modified client
  sits on: TLS termination, JWT validation, CORS/rate-limiting live here.
- **API ↔ database** is the boundary Prisma's parameterized queries defend
  by default — the threat here is a query built from unsanitized input
  (raw SQL) or a query scoped incorrectly (BOLA/IDOR — the *authorization*
  boundary, not just the network one).
- **API ↔ external services** (payment webhooks, third-party APIs) is a
  boundary where the "client" sending you data is itself untrusted unless
  its request is signature-verified.

## STRIDE per element

For each element touched by the feature (a new endpoint, a new mobile
screen, a new external integration), walk all six:

| Threat | Ask |
|---|---|
| **S**poofing | Can an attacker present as another user or as the server itself (forged JWT, replayed session, spoofed webhook sender)? |
| **T**ampering | Can an attacker modify data in transit or at rest that the system trusts unchecked (a modified request body, a tampered deep-link param, a client-supplied `ownerId`)? |
| **R**epudiation | Can an action happen with no record of who did it — does this feature need an audit trail it doesn't have? |
| **I**nformation disclosure | Does any response, log line, or error message expose more than the requesting user is entitled to see? |
| **D**enial of service | Can an unauthenticated or low-privilege actor exhaust a resource (unbounded query, unrate-limited endpoint, unbounded file upload)? |
| **E**levation of privilege | Can a lower-privilege actor reach a higher-privilege action (a member calling an admin-only service method through a route that forgot `@Roles`)? |

## Data-flow trace

For a new API surface, trace the request through every layer it touches:
**controller → service → Prisma**, noting at each hop what validates the
input (DTO/zod schema), what authorizes the action (guard/`RolesGuard`/scoped
query), and what the response exposes back. A feature whose data-flow trace
has a hop with no validation or authorization step attached is exactly where
the eventual `security-review` finding will land — catch it here instead.

## Output — threat list mapped to mitigations

Produce a short table, one row per identified threat, added to the feature's
design doc section (or the `/refine` entry) rather than a separate document:

| Element | STRIDE category | Threat | Mitigation | Standard |
|---|---|---|---|---|
| `POST /trips/:id/activities` | Elevation of privilege | Non-member creates an activity in another user's trip | Scope the write to `trip.members.some({ userId: authenticatedUser.id })` before create | ASVS 4.1 (access control) |
| Mobile `share-trip` deep link | Spoofing | Unverified deep link triggers an authenticated action without user confirmation | Require explicit in-app confirmation before any state-changing action from a deep link | MASVS-PLATFORM-2 |

Assets and entry points identified during this pass (what data matters, who
can reach it, at what privilege level) feed directly into `api-design` (the
endpoint shape) and `database-orm` (how the schema scopes ownership) once
implementation starts.

## Do

- Run this before the design doc for a large feature is finalized, not
  after the API is already built.
- Walk all six STRIDE categories per element — skipping one because "it
  obviously doesn't apply" is usually where the miss happens.
- Map every identified threat to an ASVS (backend) or MASVS (mobile)
  category so the mitigation is checkable, not just described.

## Don't

- Don't skip this for a feature that adds a new privilege boundary just
  because the individual endpoints look simple in isolation.
- Don't treat a client-side check (hidden UI, disabled button, local role
  gate) as a mitigation for anything — it isn't one.
- Don't duplicate this with `security-review` — this runs before code
  exists and produces a threat list; `security-review` runs on the diff and
  produces concrete findings.
