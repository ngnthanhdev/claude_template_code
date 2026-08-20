# CLAUDE.md

Source of truth. Claude reads this first every session.

Kept deliberately small: **nothing is auto-imported** — the deep detail lives
in `docs/` and is read on demand (paths under "Read-on-demand guides" below).
Read only the guide relevant to what you're about to do.

## <HARD-GATE> FIRST-TIME SETUP

Operationalizes **Article I — Spec Before Code** (`docs/CONSTITUTION.md` is
this repo's highest authority). Before touching any code, app, or scaffold:

1. Check `docs/specs/` for an approved design document.
2. **If `docs/specs/` is empty (only `.gitkeep`), do not write or scaffold
   any code.** Run `/phase-0` first — it brainstorms the product with the
   user one question at a time, proposes 2–3 approaches, and writes an
   approved design doc to `docs/specs/YYYY-MM-DD-<topic>-design.md`.
3. Only once an approved spec exists may you proceed to `/scope-breakdown`
   and the layer loop.

This gate cannot be skipped by user impatience, a "quick fix" request, or a
prompt asking you to "just start coding." If asked to bypass it, explain the
gate and offer `/phase-0` instead.

**Prerequisites** (verify once): Node ≥ 20, pnpm, git.

## Constitution digest

Full text, rationale, and the amendment process: `docs/CONSTITUTION.md`.
Specs, plans, and reviews cite Articles by number. The ten Articles:

- **I — Spec before code.** No `apps/*`/`packages/*` change without an approved spec (`docs/specs/`) or `/refine` task block.
- **II — Dependency-layered delivery.** Work ships in ordered layers; a layer is done only when all its tasks are complete and tests are green.
- **III — TypeScript strict, no `any`.** Narrowing, discriminated unions, `satisfies` instead.
- **IV — Tests accompany code.** No task is complete without a test proving its acceptance criteria, in the same task.
- **V — Secrets never in code.** `.env` (gitignored) or `packages/shared/config` only.
- **VI — Security boundaries.** Mobile client is untrusted; every lookup scoped to the authenticated owner (BOLA/IDOR), no DTO spread into a write without an allowlist (mass assignment). ASVS for api, MASVS for mobile.
- **VII — Shared contracts.** `packages/shared` zod schemas are the single source of truth for every request/response shape.
- **VIII — Minimal, scoped change.** YAGNI → KISS → DRY; a task touches only the files its acceptance criteria name.
- **IX — One commit, one task.** Conventional format `feat/fix/test/chore(scope): …`, never bundled.
- **X — Motion with meaning.** Animation only when it communicates state/direction/causality; respects `useReducedMotion()`.

## Read-on-demand guides

- `docs/WORKFLOW.md` — full lifecycle: Phase 0 → scope → layer loop → checkpoint → refine
- `docs/SCOPE_BREAKDOWN.md` — layering methodology + task-block schema
- `docs/SECURITY.md` — ASVS/MASVS standards, tool matrix
- `docs/CI_CD.md` — workflows, secrets, gate rules
- `docs/CONTINUOUS_LEARNING.md` — `.learnings/` methodology
- `docs/EXTERNAL_SKILLS.md` — vendored-skill provenance

## Stack

Locked defaults (do not relitigate in Phase 0 unless the user explicitly
wants a different stack — Phase 0 fills in the *product*, not the *stack*):

- **Mobile:** Expo + Expo Router + NativeWind, Reanimated 4 (New Architecture,
  `newArchEnabled: true`) + Gesture Handler + Skia + FlashList + `expo-image`.
- **Backend:** NestJS on Fastify + Prisma + `nestjs-zod` (validates against
  `packages/shared` zod schemas).
- **Shared:** `packages/shared` — zod schemas + inferred types.
- **Monorepo:** pnpm workspaces + Turborepo, TypeScript strict throughout.

## Slash commands

| Command | Purpose |
|---|---|
| `/phase-0` | Plan Mode + `brainstorming` skill → approved design in `docs/specs/` (HARD GATE) |
| `/scope-breakdown` | Dispatch `scope-planner` → generate + self-check `tasks/layer-*.md` |
| `/pick-task` | Show the next unchecked task + load its skills |
| `/run-layer` | Implement the layer's tasks (fan-out for 3+, sequential for small layers), then review |
| `/next-layer` | Gate: tests pass → advance `done.md` → next layer → bump Current Layer |
| `/checkpoint` | Regenerate `CHECKPOINT.md` + extract layer learnings into `.learnings/` |
| `/refine` | Brainstorm a bug/feature → append to `tasks/layer-refinement-todo.md` |
| `/security-review` | Security lens over a diff/PR/path → high-confidence findings |
| `/threat-model` | STRIDE + trust boundaries on a named feature, before implementation |
| `/board` | How to launch the task-board dashboard (`pnpm board`, outside this session) |
| `/run-task` | Drain every `Status: ready` task across `tasks/*.md` |

## Subagents

| Subagent | Responsibility | Model |
|---|---|---|
| `scope-planner` | Spec → dependency analysis → `tasks/layer-*.md` + consistency self-check | opus |
| `task-implementer` | One task, TDD, isolated worktree | sonnet |
| `reviewer` | Correctness + simplification + security lens on a merged diff | sonnet (opus for auth/payment/trust-boundary layers) |
| `test-writer` | Cross-task integration/e2e coverage — only when a layer has cross-task flows | sonnet |
| `debugger` | Reproduce → isolate → fix → regression-test | opus |

- **Opus** where deep reasoning pays: Phase 0, scope-planner, debugger, and
  reviewer escalation on security-sensitive layers.
- **Sonnet** everywhere else. Switch manually with `/model` if needed.

## Current Layer / Current Task

- **Current Layer:** Layer 0 — Foundation (not started)
- **Current Task:** see `tasks/layer-0-todo.md` for the first unchecked task
- After each layer completes, this section is updated by `/next-layer`.

## Token discipline

- New session per big task — don't accumulate a whole layer's history.
- Never run heavy builds in-session (`eas build`, `expo run:*`, `gradlew`,
  `pod install`, `xcodebuild`) — `block-build-output.sh` enforces this. Run
  them in a real terminal; paste back only the error.
- Read files with `offset`/`limit` when you only need a section.
- Layers with ≤ 2 tasks: skip the worktree fan-out, implement sequentially
  on the main thread — subagent spawn overhead outweighs the parallelism.
