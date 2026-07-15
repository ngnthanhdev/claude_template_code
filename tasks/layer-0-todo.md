# Layer 0 — Foundation

Status: **not started**

This is the first layer every project built from this template runs, before
any project-specific feature work. It scaffolds the empty `apps/*` and
`packages/shared` placeholders into a real Expo app, a real NestJS API, and a
real shared-schema package, then wires CI against them. Nothing in Layer 1
should start until every task below is `Status: done` and its acceptance
criteria are met.

Each task is a level-3 heading with a stable `T-xxxxxx` id, followed by a
metadata list (`Status`, `Assignee`, `Files`, `Acceptance`, `Skills`, and an
optional `Depends`):

```markdown
### T-a3f9c1 — <title>
- **Status:** todo        <!-- todo | ready | in-progress | blocked | review | done -->
- **Assignee:** ai        <!-- ai | human -->
- **Files:** apps/api/prisma/schema.prisma, ...
- **Acceptance:** <checkable definition of done>
- **Skills:** database-orm, shared-contracts
- **Depends:** T-xxxxxx   <!-- optional, omit if none -->
```

`Status` moves `todo → ready → in-progress → blocked/review → done` as
`/run-layer` and its `task-implementer`s work the task; `Assignee` is `ai`
unless a task needs a human decision first. Tasks in this layer are
independent enough to fan out via `/run-layer`, except where a task
explicitly notes a `Depends` on another task in this file.

---

### T-13ab58 — Scaffold the Expo app in apps/mobile
- **Status:** todo
- **Assignee:** ai
- **Files:** apps/mobile/**, apps/mobile/app.json, apps/mobile/package.json, apps/mobile/tsconfig.json
- **Acceptance:**
  - Expo app created with Expo Router as the navigation foundation.
  - NativeWind configured and a sample styled component renders correctly.
  - `app.json` sets `"newArchEnabled": true` (required by Reanimated 4).
  - Root `_layout` sets up `GestureHandlerRootView`, `SafeAreaProvider`, and the
    Reanimated babel plugin.
  - `apps/mobile/tsconfig.json` extends `../../tsconfig.base.json`.
  - `pnpm --filter mobile exec tsc --noEmit` passes with no errors.
  - App boots in Expo Go or a dev client with no red-screen errors.
- **Skills:** expo-router-nativewind, mobile-app-agent

---

### T-804011 — Install the animation dependency stack
- **Status:** todo
- **Assignee:** ai
- **Files:** apps/mobile/package.json
- **Acceptance:**
  - `react-native-reanimated@4`, `react-native-gesture-handler`,
    `react-native-worklets` (the separate v4 worklets package),
    `@shopify/react-native-skia`, `@shopify/flash-list`, `expo-image`, and
    `react-native-reanimated-carousel` are installed at versions compatible
    with the Expo SDK selected for this project.
  - A trivial Reanimated animation (e.g. a shared-value-driven fade) runs on a
    device/simulator without a New Architecture or worklets-registration error.
  - Documented in this task's summary: the exact Expo SDK version chosen and
    confirmation it supports `newArchEnabled: true` with these package
    versions (per the compatibility risk noted in the design spec, §13).
- **Skills:** mobile-animations, expo-router-nativewind
- **Depends:** T-13ab58

---

### T-2f2057 — Scaffold the NestJS API in apps/api
- **Status:** todo
- **Assignee:** ai
- **Files:** apps/api/**, apps/api/package.json, apps/api/tsconfig.json, apps/api/prisma/schema.prisma
- **Acceptance:**
  - NestJS app created using the **Fastify** adapter
    (`@nestjs/platform-fastify`), not the default Express adapter.
  - Prisma initialized with a `PrismaModule`/`PrismaService` pattern and a
    minimal `schema.prisma` (even a placeholder model is fine at this stage).
  - `nestjs-zod`'s `ZodValidationPipe` wired as a global pipe.
  - `apps/api/tsconfig.json` extends `../../tsconfig.base.json`.
  - A health-check endpoint (`GET /health`) returns `200`.
  - `pnpm --filter api exec tsc --noEmit` passes with no errors.
  - `pnpm --filter api test` runs (even a single smoke test) and passes.
- **Skills:** nestjs-backend, database-orm

---

### T-a463b5 — Initialize packages/shared
- **Status:** todo
- **Assignee:** ai
- **Files:** packages/shared/**, packages/shared/package.json, packages/shared/tsconfig.json, packages/shared/src/index.ts
- **Acceptance:**
  - Package exports zod schemas and their inferred TypeScript types from
    `packages/shared/src`.
  - `packages/shared/tsconfig.json` extends `../../tsconfig.base.json` and
    respects the `@shared/*` path alias defined there.
  - At least one real schema exists (even a minimal one, e.g. a shared error
    envelope or a health-check response shape) and is importable from both
    `apps/mobile` and `apps/api` without a build step (or with a documented
    build step if the monorepo setup requires one).
  - `pnpm --filter @shared exec tsc --noEmit` passes with no errors.
- **Skills:** shared-contracts, typescript-strict

---

### T-f5834d — Wire CI against the scaffolded skeleton
- **Status:** todo
- **Assignee:** ai
- **Files:** .github/workflows/ci.yml, turbo.json
- **Acceptance:**
  - `pnpm turbo run lint typecheck test` passes locally across all three
    packages.
  - Pushing a branch/PR triggers `ci.yml` and it goes green.
  - Any turbo pipeline gaps discovered (e.g. a package missing a `lint` or
    `test` script that `turbo.json` expects) are fixed so the root scripts
    work uniformly across `apps/mobile`, `apps/api`, and `packages/shared`.
- **Skills:** git-workflow
- **Depends:** T-13ab58, T-804011, T-2f2057, T-a463b5

No new files are expected for this task beyond what's listed above — it
verifies `.github/workflows/ci.yml` (already shipped by the template) against
the now-populated `apps/*` and `packages/shared`, touching a package's own
`package.json` scripts only if a pipeline gap is found.

---

## After this layer: creating `layer-1-todo.md`

Once every task above is `Status: done` and `pnpm turbo run lint typecheck test`
is green, run `/next-layer`. It will:

1. Confirm the gate (all Layer 0 tests passing).
2. Move this file's completed tasks into `tasks/done.md`.
3. Dispatch `scope-planner` again — this time with both the approved
   `docs/specs/` design and the now-real `apps/*`/`packages/shared` code as
   context — to derive `tasks/layer-1-todo.md`, the first layer of actual
   product features (see `docs/SCOPE_BREAKDOWN.md` for how layers are
   derived, and its worked example for what a Layer 1 commonly contains:
   shared auth/data contracts, the primary data model, and the first
   real screens).
4. Bump "Current Layer" / "Current Task" in `CLAUDE.md` to point at Layer 1.

Do not hand-write `layer-1-todo.md` yourself — always generate it through
`/next-layer` → `scope-planner` so it stays derived from the approved spec
rather than drifting from it.
