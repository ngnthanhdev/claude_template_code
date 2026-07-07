# Architecture

> Filled during Phase 0 for **your** project, once the PRD's feature set is
> settled. This document describes how the product is actually built on top
> of this template's locked stack (Expo/Expo Router/NativeWind on the mobile
> side; NestJS on Fastify + Prisma + `nestjs-zod` on the API side; shared zod
> contracts in `packages/shared`) — it should not relitigate the stack, only
> the project-specific shape on top of it.

## System overview

_[fill in during Phase 0]_

A short text/diagram description of how `apps/mobile`, `apps/api`, and
`packages/shared` fit together for this specific product, plus any external
services (auth provider, storage, push notifications, third-party APIs).

```
_[fill in during Phase 0 — a simple text diagram of the major components
 and how data flows between them is enough; it does not need to be a
 polished image]_
```

## Components

### `apps/mobile`

_[fill in during Phase 0]_

Major screens/route groups, navigation shape, and any mobile-specific
architectural decisions (offline behavior, local persistence, push
notification handling).

### `apps/api`

_[fill in during Phase 0]_

Major NestJS modules, how they map to the feature set in `docs/PRD.md`, and
any API-specific architectural decisions (background jobs, caching, rate
limiting, third-party integrations).

### `packages/shared`

_[fill in during Phase 0]_

The zod schemas this project needs, and which of them are consumed by both
apps vs. only one side.

## Data model

_[fill in during Phase 0]_

The core entities and their relationships (this becomes the basis for the
Prisma schema built in Layer 0/1).

## Data flow

_[fill in during Phase 0]_

For the 2–3 most important user flows, describe the path data takes: mobile
action → API call → database → response → UI update. Call out anywhere this
isn't a simple request/response (real-time updates, background sync, optimistic
UI).

## Key architectural decisions

_[fill in during Phase 0]_

Decisions specific to this project (not already locked by the template) and
why they were made — this feeds `CHECKPOINT.md`'s "Key decisions" section as
layers complete.

## Known risks

_[fill in during Phase 0]_

Anything identified during Phase 0 as a likely source of trouble later
(a third-party API with unclear limits, a performance-sensitive screen, a
data model that might need to change shape).

---

This document, together with `docs/PRD.md`, is the primary input
`scope-planner` reads when producing `tasks/layer-0-todo.md` via
`/scope-breakdown`. See `docs/SCOPE_BREAKDOWN.md`.
