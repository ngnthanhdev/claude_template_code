# Design: Claude Code Full‑Stack Template (Expo Mobile + Node API)

> Status: **Approved (pending user spec review)** · Date: 2026‑07‑07
> Target repo: https://github.com/ngnthanhdev/claude_template_code
> Reference/prior art: `ocanhdt12-gif/opencode-react-native-template` (opencode, mobile‑only)

---

## 1. Goal

A **starter template for Claude Code** that drives a disciplined
`Brainstorm → Design (approve) → Scope by dependency layers → Implement → Test → Checkpoint → Refine`
workflow for building a **full‑stack product**: an **Expo mobile app** + a **Node backend/API**,
in a **pnpm + Turborepo monorepo**.

Unlike the opencode reference (which simulates the workflow with plain markdown), this template is
**native‑first**: it uses Claude Code's own primitives — **skills, subagents, slash commands, hooks,
settings.json, and Plan Mode** — as the workflow engine.

The product this template is tuned to build wants **smooth UI and beautiful animations with
React Native Reanimated v4**, so the mobile foundation and an authored animation skill bake in the
Reanimated 4 essentials and gotchas.

## 2. Locked decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Project type | Full‑stack: Expo mobile + Node backend/API |
| 2 | Native depth | **Native‑first** (skills, subagents, commands, hooks, Plan Mode) |
| 3 | Repo structure | **Monorepo** — pnpm workspaces + Turborepo (`apps/mobile`, `apps/api`, `packages/shared`) |
| 4 | v1 modules | Core workflow + CI/CD + Checkpoint/context‑compression + Continuous‑learning/graph. **No** monitoring stack (deferred). |
| 5 | Content language | **English** |
| 6 | Workflow approach | **Hybrid** — docs+skills define what/why; slash commands for repetitive steps; subagents for parallelism+review; hooks for cheap deterministic guards |
| 7 | Parallel task safety | **git worktree isolation** per `task-implementer` subagent |
| 8 | Commit hook | **Reminder only** (never auto‑commit) |
| 9 | External skills | **Vendor** (commit into repo) with preserved LICENSE + attribution: SWM `react-native-best-practices`, Vercel `react-native-guidelines`, `ui-ux-pro-max`, `ponytail` |
| 10 | Animation strategy | Perspective transforms + Skia (no 3D engine); authored **`mobile-animations`** (how, recipe library) + **`motion-design-principles`** (when/why, Reduce‑Motion aware); Dynamic Island = in‑app simulated (core) + real Live Activities (optional, documented) |
| 11 | Backend stack | **NestJS** (on Fastify adapter) + **Prisma** + `nestjs-zod` (reuse `packages/shared` zod schemas) |
| 12 | Mobile E2E | **Maestro** |

**Non‑goals (YAGNI):** monitoring stack (Sentry/Prometheus/Grafana); pre‑filled app code
(`apps/*` ship empty and are scaffolded in Layer 0); the SWM `radon-mcp` server (not selected);
provider‑specific deploy wiring (kept generic until hosting is chosen).

## 3. Repository structure

`apps/*` and `packages/*` ship **empty** (`.gitkeep`). The template provides only the monorepo
skeleton config; **Layer 0** scaffolds Expo + API + shared into the placeholders per the approved spec.

```
claude_template_code/
├── CLAUDE.md                     # Source of truth; kept lean, @-imports sub-guides
├── README.md                     # Human-facing intro + how to start
│
├── .claude/
│   ├── settings.json             # hooks + permissions + env (committed)
│   ├── settings.local.json.example
│   ├── skills/                   # authored + vendored external skills
│   ├── agents/                   # subagent definitions
│   ├── commands/                 # slash commands
│   └── hooks/                    # hook scripts referenced by settings.json
│
├── docs/
│   ├── BRIEF.md  PRD.md  ARCHITECTURE.md  SCOPE_BREAKDOWN.md
│   ├── WORKFLOW.md  CI_CD.md  CONTINUOUS_LEARNING.md  GRAPH.md
│   ├── EXTERNAL_SKILLS.md        # provenance/version/license of vendored skills
│   ├── specs/                    # design docs (this file lives here)
│   └── phases/phase-0.md
│
├── tasks/
│   ├── layer-0-todo.md  layer-refinement-todo.md  done.md
│
├── .learnings/.gitkeep
│
├── apps/
│   ├── mobile/.gitkeep           # Expo app — scaffolded in Layer 0
│   └── api/.gitkeep              # Node backend — scaffolded in Layer 0
├── packages/
│   └── shared/.gitkeep           # shared zod schemas + types + config
│
├── .github/workflows/
│   ├── ci.yml  eas-preview.yml  eas-production.yml  api-deploy.yml
│
├── scripts/
│   ├── start-project.sh / .ps1 / .bat   checkpoint.js
│
├── CHECKPOINT.md                 # generated after each layer
├── package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json
├── .env.example  .gitignore  eas.json
```

## 4. Native engine (`.claude/`)

### 4.1 Subagents (`.claude/agents/*.md`)
Frontmatter: `name`, `description`, `tools`, `model`. Benefits: **context isolation** (token savings)
and **parallelism** (tasks in the same layer run concurrently).

| Subagent | Responsibility | Invoked by |
|----------|----------------|------------|
| `scope-planner` | Read approved spec → dependency analysis → generate `tasks/layer-*.md` | `/scope-breakdown` |
| `task-implementer` | Implement **one** task in an isolated git worktree → code + unit tests → return summary | `/run-layer` (fan‑out) |
| `code-reviewer` | Review a diff for correctness + simplification | after each task/layer |
| `test-writer` | Write integration/e2e tests at layer end | `/next-layer` |
| `debugger` | Systematic debugging when a test fails | on bug |

### 4.2 Slash commands (`.claude/commands/*.md`)
Thin prompts that expand into instructions and invoke skills/subagents:

- `/phase-0` — enter **Plan Mode**, run `brainstorming` skill, write design to `docs/specs/` (HARD GATE, no code)
- `/scope-breakdown` — dispatch `scope-planner` → create `layer-*.md`
- `/pick-task` — show next task in current layer + load relevant skills
- `/run-layer` — fan out independent tasks to `task-implementer` (worktree‑isolated) → then `code-reviewer`
- `/next-layer` — verify layer done (tests pass) → create next layer → advance "Current Layer"
- `/checkpoint` — generate `CHECKPOINT.md` (git log + done.md + key decisions)
- `/learn` — extract patterns/gotchas into `.learnings/`
- `/graph` — run graphify, update `graph.json`
- `/refine` — brainstorm a reported bug/feature → add to `layer-refinement-todo.md`

### 4.3 Hooks & `settings.json`
Cheap, deterministic guards:

- **PreToolUse (Bash)** → `block-build-output.sh`: block heavy build commands (`eas build`,
  `expo run:*`, `gradlew`, `pod install`) inside a session; print a message telling the user to run
  them in a real terminal. Natively enforces the reference template's token rule.
- **PostToolUse (Edit|Write)** → `auto-format.sh`: run prettier/eslint `--fix` on edited files.
- **Stop|SubagentStop** → `suggest-commit.sh`: **remind** to commit ("1 commit = 1 task"). Never auto‑commit.
- **permissions**: allowlist safe commands (pnpm/turbo/git/eslint/tsc/expo lint); deny dangerous ones.
- `settings.local.json.example`: per‑developer overrides/secrets (gitignored).

### 4.4 Memory
Root `CLAUDE.md` stays lean and uses `@`‑imports (`@docs/WORKFLOW.md`, `@docs/SCOPE_BREAKDOWN.md`, …)
so only the needed guide is pulled into context.

## 5. Skills catalog (`.claude/skills/`)

### 5.1 Authored skills
**Planning:** `brainstorming`

**Mobile (Expo):**
`mobile-app-agent`, `expo-router-nativewind` (foundation), `mobile-auth-state`,
`mobile-api-integration`, `mobile-data-forms`, `mobile-i18n-theme`, `mobile-testing-release`,
`expo-eas-pipeline`, **`mobile-animations`** (Reanimated v4 — see §10).

**Backend (NestJS):**
`api-design`, `nestjs-backend` (modules/controllers/providers, DI, guards, pipes, DTOs; **Fastify
adapter**; **`nestjs-zod` `ZodValidationPipe`** reusing `packages/shared` schemas),
`database-orm` (**Prisma** via a `PrismaModule`/service, migrations, relations, query opt),
`backend-auth-security` (Nest Guards/Passport, JWT/session, CORS/CSRF, secrets, OWASP),
`backend-testing` (**Jest + Supertest**, Nest default; fixtures, mocking).

**Motion / UX judgment:**
`motion-design-principles` — decides **when/why** to animate vs. when to hold back (the taste layer),
complementing `mobile-animations` (which is **how**). Encodes: animate only to communicate meaning
(state change, continuity, gesture feedback, purposeful delight); restrain on high‑frequency actions,
dense scrolling, input‑blocking, low‑end/battery, and when Reduce Motion is on; hard rules —
Reanimated `useReducedMotion()` fallback, 200–350ms durations, springs, cap concurrent heavy effects,
keep work on the UI thread; ships a decision checklist the agent runs before adding any animation.

**Shared / cross‑cutting:**
`shared-contracts` (zod schemas + types shared mobile↔api in `packages/shared` — single source of truth),
`typescript-strict`, `git-workflow`.

### 5.2 Vendored external skills (committed, with LICENSE + attribution)
| Skill | Source | Why |
|-------|--------|-----|
| `react-native-best-practices` | software‑mansion‑labs/skills | Authoritative Reanimated 4, gestures, Skia, 120fps |
| `react-native-guidelines` | vercel‑labs/agent‑skills | Perf guardrails: FlashList, memoization, expo‑image |
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | Visual design intelligence (styles, palettes, typography, UX) |
| `ponytail` | DietrichGebert/ponytail | Code‑minimalism discipline (anti over‑engineering) |

`docs/EXTERNAL_SKILLS.md` records each skill's source repo, commit/version pinned, license, and the
command to re‑sync. Licenses must be verified and preserved during vendoring.

## 6. Workflow lifecycle

```
Fresh clone (no design in docs/specs/)
  → PHASE 0 (Plan Mode, HARD GATE): /phase-0 → brainstorming skill → design doc → user approve
  → SCOPE BREAKDOWN: /scope-breakdown → scope-planner → tasks/layer-*.md
       (Layer 0 = scaffold Expo + API + shared + base config + CI)
  → LAYER LOOP (per layer):
       /run-layer → task-implementer (per-task worktree) → merge → code-reviewer → test-writer
       /next-layer  [gate: all tests pass]
  → BETWEEN LAYERS: /checkpoint → CHECKPOINT.md (+ compact context); /learn; /graph
  → REFINEMENT: user reports bug/feature → /refine → brainstorm → layer-refinement-todo.md → implement
```

**Discipline gates:** (1) no code before spec approval; (2) no advancing layers before tests pass;
(3) no hard‑coded secrets (use `.env` / `packages/shared/config`).

## 7. Monorepo configuration
- `pnpm-workspace.yaml` → `apps/*`, `packages/*`
- `turbo.json` → pipelines `lint`, `typecheck`, `test`, `build` with `dependsOn: ["^build"]`
- `tsconfig.base.json` → strict, path alias `@shared/*`
- root `package.json` → scripts wrapping turbo + `checkpoint`
- `.gitignore` → node, expo, turbo cache, `graphify-out/`, build artifacts (keep `.learnings/`)

## 8. CI/CD (`.github/workflows/`)
- `ci.yml` — PR/push: `turbo run lint typecheck test` across apps + build sanity
- `eas-preview.yml` — develop/manual: EAS preview build (mobile)
- `eas-production.yml` — manual from main: EAS production build/submit
- `api-deploy.yml` — build API (Docker image) + **provider‑agnostic** deploy step (placeholder)

## 9. Testing strategy
| Level | When | Tool |
|-------|------|------|
| Unit | right after each task | Jest (api, Nest default), Vitest (shared), Jest+RTL (mobile) |
| Integration | end of layer | Jest+Supertest (api), RTL (mobile) |
| E2E | before release | Maestro (mobile), Supertest full‑flow (api) |

## 10. Animation stack (Reanimated v4)

### 10.1 Libraries
- Core: `react-native-reanimated@4` + `react-native-gesture-handler` + `react-native-worklets`
- Lists/images: `@shopify/flash-list`, `expo-image`
- Effects: `@shopify/react-native-skia` (GPU canvas — shaders, particles, morph/blur)
- Prebuilt motion: `react-native-reanimated-carousel` (3D stack/tinder/parallax); optional `moti`
- **3D depth = perspective transforms + Skia only.** No 3D engine
  (`@react-three/fiber`/`filament`) in v1; a project that truly needs 3D scenes adds it in Phase 0.

### 10.2 Gotchas baked into the foundation
- Reanimated 4 **requires the New Architecture (Fabric)** → `newArchEnabled: true` in `app.json`.
- Worklets moved to a **separate `react-native-worklets` package** in v4 (differs from v3 setup).
- Reduce Motion: honor `useReducedMotion()` — degrade to fade/instant.

### 10.3 `mobile-animations` = recipe/pattern library
Each recipe ships a canonical snippet + a perf caveat, and defers the *whether* to
`motion-design-principles`:
- **Scroll‑driven 3D cards** — `useAnimatedScrollHandler` → `interpolate` scroll offset →
  `transform: [{perspective},{rotateX/Y},{scale},{translateY}]` per item.
- **Swipe‑to‑island morph** — Pan/Fling gesture + shared value + Reanimated layout transition
  (`LinearTransition`/`entering`/`exiting`) to morph a list item into a floating in‑app "island" pill;
  Skia for fluid/blur morphs.
- **Gesture interactions** — pan/pinch/fling patterns integrated with Reanimated.
- **Carousel** — `react-native-reanimated-carousel` 3D modes.
- **Skia effects** — particles/shaders/blur for premium moments.
- Deep source: vendored SWM `react-native-best-practices`.

### 10.4 Dynamic Island — two tiers
- **Core (v1):** *in‑app simulated island* via the swipe‑to‑island recipe above — pure
  Reanimated/Skia, cross‑platform, no native code.
- **Optional capability (documented, not core):** *real Live Activities* (iOS 16.1+, ActivityKit)
  via `@bacons/apple-targets` (SwiftUI widget, EAS dev build, iOS‑only). Documented in
  `docs/EXTERNAL_SKILLS.md`/foundation notes for projects that need a system‑level island.

## 11. Model strategy (native Claude Code)
- Phase 0 / brainstorm and `code-reviewer`: **Opus** (deep reasoning) via subagent `model:` frontmatter.
- `task-implementer` (routine implementation): **Sonnet** (fast + cheap).
- Manual switch with `/model` when needed. No hard‑coded third‑party model IDs.

## 12. Success criteria
1. Cloning the repo + running `scripts/start-project.*` yields a ready monorepo skeleton and a Claude
   Code session that begins Phase 0 automatically (via `CLAUDE.md`).
2. `/phase-0` cannot be bypassed to code before an approved spec exists in `docs/specs/`.
3. `/scope-breakdown` produces a dependency‑ordered `tasks/layer-0-todo.md`.
4. `/run-layer` fans out to worktree‑isolated subagents and integrates results without cross‑task
   file conflicts.
5. All authored skills load in Claude Code (valid frontmatter) and vendored skills carry their licenses.
6. `mobile-animations` + foundation produce a Reanimated‑v4‑ready Expo app (New Arch enabled).
7. CI runs `turbo run lint typecheck test` green on the scaffolded skeleton.

## 13. Risks / open items
- **Vendoring licenses:** each external skill's license must be checked (MIT/Apache expected) and its
  LICENSE + attribution preserved; abort vendoring any skill whose license forbids redistribution and
  fall back to a documented install command for that one.
- **Worktree merge:** integrating parallel worktree results can still conflict at merge time; the
  orchestrator must surface conflicts rather than silently overwrite.
- **Reanimated v4 / SDK compatibility:** New Architecture requirement pins a minimum Expo SDK; Layer 0
  scaffolding must select a compatible SDK version at scaffold time.
- **`ponytail` overlap:** its minimalism commands partially overlap the built‑in `/simplify`; document
  when to use which to avoid confusion.
