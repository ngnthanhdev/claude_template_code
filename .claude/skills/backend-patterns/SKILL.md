---
name: backend-patterns
description: All apps/api backend patterns in one skill — NestJS modules/DI/guards/pipes on the Fastify adapter, Prisma schema/migrations/transactions, REST resource design with pagination and error envelopes, Jest unit + Supertest integration testing. Load the SKILL.md for routing and core rules, then read ONLY the references/ file matching the task.
---

# Backend patterns

One skill for `apps/api` work. **Do not read every reference — pick the
one(s) the task actually touches:**

| Task touches… | Read |
|---|---|
| Modules, DI, guards, pipes, Fastify adapter, `nestjs-zod` validation | `references/nestjs.md` |
| Prisma schema, migrations, `PrismaModule`/`PrismaService`, transactions | `references/prisma.md` |
| REST resource shape, pagination, error envelopes, versioning | `references/api-design.md` |
| Jest unit tests, Supertest integration tests against the Nest app | `references/testing.md` |

Auth guards, RBAC, and the security checklist live in the `security` skill
(`references/backend.md`).

## Core rules (apply to every backend task)

- Every endpoint validates its body/query/params via a `nestjs-zod` DTO
  backed by a `packages/shared` zod schema (Article VII).
- The mobile client is untrusted: scope every lookup to the authenticated
  user/owner, allowlist fields on writes — never spread a client DTO into
  Prisma `create`/`update` (Article VI).
- Secrets via `ConfigService`/env only (Article V).
- Every task ships a test proving its acceptance criteria (Article IV).
- Strict TypeScript, no `any` (Article III).
