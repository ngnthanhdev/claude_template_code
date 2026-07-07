# Scope breakdown

How this template turns an approved design into an ordered list of buildable
work, and how that work is organized so parallel implementation is safe.

## Why layers, not a flat backlog

A flat task list hides two things that matter for an agent-driven workflow:
which tasks can safely run **at the same time**, and which tasks would
silently break if run **out of order**. Dependency-driven layering makes both
explicit.

- A **layer** is a set of tasks that are independent of each other but may
  depend on anything completed in an earlier layer.
- Tasks **within** a layer are assumed parallel-safe: `/run-layer` fans them
  out to separate `task-implementer` subagents, each in its own git worktree,
  precisely because nothing in the layer should need another task in the same
  layer to exist first.
- Tasks **across** layers are ordered: Layer N may freely depend on anything
  in Layers 0..N-1, never on something not yet built.
- No layer starts until the previous one's tests are green. This is the
  second discipline gate from `docs/WORKFLOW.md` — advancing early means
  building on ground that hasn't been proven to hold.

## Layer 0 is always the foundation layer

Regardless of what the approved spec describes, Layer 0 scaffolds the
skeleton every later layer depends on:

- `apps/mobile` — the Expo app (Expo Router, NativeWind, New Architecture
  enabled for Reanimated 4, the animation dependency stack).
- `apps/api` — the NestJS app (Fastify adapter, Prisma, `nestjs-zod`).
- `packages/shared` — the zod schema package both apps import from.
- Base config already present from the template (`turbo.json`,
  `tsconfig.base.json`, `pnpm-workspace.yaml`) gets wired into the new apps'
  own configs.
- CI (`.github/workflows/ci.yml`) runs against the scaffolded skeleton so
  `lint`/`typecheck`/`test` are green before Layer 1 begins.

See `tasks/layer-0-todo.md` for the concrete checklist a new project starts
from.

## How `scope-planner` produces `tasks/layer-*.md`

`/scope-breakdown` dispatches the `scope-planner` subagent (Opus — this is a
dependency-analysis reasoning task, not routine implementation) with the
approved design document as its input. It works in three passes:

1. **Extract the feature/component list** from the approved spec — every
   screen, endpoint, data model, and cross-cutting concern the design calls for.
2. **Dependency-analyze** that list: what needs `packages/shared` schemas to
   exist first, what needs an API endpoint before the mobile screen that
   consumes it can be tested end-to-end, what's genuinely standalone (a
   settings screen with no data dependency, a health-check endpoint, etc.).
3. **Group into layers** such that everything in a layer has all its
   dependencies satisfied by strictly earlier layers, and emit
   `tasks/layer-N-todo.md` for the next unbuilt layer (later layers are
   generated as each prior one completes, not all up front, since later
   layers may need to react to what was actually learned/decided in earlier ones).

Each task written into a layer file includes:

- **Files** — the concrete paths the task is expected to touch (scope
  control: a `task-implementer` should not need to go outside this list).
- **Acceptance criteria** — a checkable definition of done, usually including
  the test(s) that must pass.
- **Relevant skills** — which `.claude/skills/*` the `task-implementer`
  should load before starting (e.g. a mobile form task loads
  `mobile-data-forms` and `shared-contracts`; a Prisma model task loads
  `database-orm`).

## Example: a typical Expo + NestJS product

For a product with auth, a primary data model, and a home feed, a realistic
breakdown looks like this:

- **Layer 0 — Foundation:** scaffold `apps/mobile`, `apps/api`,
  `packages/shared`, CI. (See `tasks/layer-0-todo.md`.)
- **Layer 1 — Core contracts and auth:**
  - `packages/shared`: zod schemas for `User`, auth request/response shapes.
  - `apps/api`: `AuthModule` (JWT strategy, guards), `UsersModule` with Prisma
    model + migration.
  - `apps/mobile`: auth screens (`mobile-auth-state`), secure token storage,
    auth-gated route group.
  - These three groups can mostly run in parallel once the shared schemas
    task lands first within the layer (the schema task has no dependency on
    the other two; the API and mobile auth tasks both depend on it, so the
    scope-planner would in practice put the schema task in this layer and the
    API/mobile tasks in the *next* layer once schemas exist — or, if the
    schema shape is simple and already fully specified in the design doc, all
    three may ship in the same layer with the schema task simply implemented
    first within the fan-out).
- **Layer 2 — Primary data model and feed:**
  - `apps/api`: the core resource's Prisma model, CRUD endpoints, `nestjs-zod`
    DTOs from `packages/shared`.
  - `apps/mobile`: feed screen (`mobile-api-integration` + TanStack Query +
    FlashList), pull-to-refresh, optimistic create/update
    (`mobile-data-forms`).
  - `mobile-animations` + `motion-design-principles`: card entrance/scroll
    interactions on the feed, gated by the "does this communicate meaning"
    checklist before anything is added.
- **Layer 3 — Polish and release readiness:**
  - i18n/theme pass (`mobile-i18n-theme`), EAS build profiles
    (`expo-eas-pipeline`), Maestro e2e flows for the auth + feed happy path
    (`mobile-testing-release`), API integration test suite
    (`backend-testing`).

This is illustrative, not prescriptive — the actual layers for a given
project are whatever `scope-planner` derives from *that* project's approved
spec, but the shape (foundation, then contracts, then core features, then
polish/release) recurs because it mirrors real dependency order.
