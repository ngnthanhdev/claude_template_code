# Claude Code Full‑Stack Template

A native‑first Claude Code starter template for building an **Expo mobile app + NestJS API**
monorepo through a disciplined Brainstorm → Design → Layer → Implement → Test → Checkpoint → Refine
workflow.

## What this is

This repo is **not** a finished app — it's a template. It ships a complete pnpm + Turborepo
monorepo skeleton, plus a full Claude Code "native engine" (skills, subagents, slash commands,
hooks, `settings.json`) that drives you through building your own product from a one‑line idea to
a tested, CI‑gated codebase.

It is **native‑first**: instead of simulating the workflow with plain markdown instructions, it
uses Claude Code's own primitives — skills, subagents, slash commands, hooks, `settings.json`, and
Plan Mode — as the actual workflow engine.

`apps/mobile`, `apps/api`, and `packages/shared` ship **empty** (only a `.gitkeep` each). They are
scaffolded for real during your project's own **Layer 0**, once your design spec is approved — this
template only provides the monorepo configuration around them.

The template is tuned for a product that wants **smooth UI and beautiful animations** with React
Native Reanimated v4 — the mobile foundation and an authored animation skill bake in the Reanimated
4 essentials and gotchas from day one.

**HARD GATE:** no code, no scaffolding, no `apps/*` changes before a design spec has been written to
`docs/specs/` and approved by you. A fresh clone has an empty `docs/specs/`, which is exactly what
triggers Phase 0 automatically the moment you open the repo in Claude Code.

## Requirements

- [Claude Code](https://docs.claude.com/claude-code) — CLI, desktop app, web (claude.ai/code), or IDE extension. This is the engine that runs the template's workflow (skills, subagents, slash commands, hooks); it's a build/assist dependency, not a runtime one — the Expo app and NestJS API you produce run without it.
- Node.js ≥ 20
- pnpm (`npm install -g pnpm@9` if you don't have it)
- git
- For mobile development: Watchman, Xcode (iOS) and/or Android Studio (Android)
- Optional: [`graphify`](https://github.com/Graphify-Labs/graphify) + [`uv`](https://docs.astral.sh/uv/) for the `/graph`
  command (codebase dependency graphing)

## Quick start

```bash
./scripts/start-project.sh
```

This asks for your project name and either an existing spec/brain‑dump file or a quick description,
then writes `docs/BRIEF.md` (and `docs/SPECIFICATIONS.md` if you provided one) and makes sure
`docs/specs/` is empty so Phase 0 will trigger.

Then:

1. Open the folder in Claude Code.
2. `CLAUDE.md`'s hard gate detects there's no design doc in `docs/specs/` yet and Phase 0 starts
   automatically — Claude will brainstorm your idea with you one question at a time.
3. Once you approve a design, run `/scope-breakdown` to generate `tasks/layer-0-todo.md`, then
   `/run-layer` to start implementing.

Windows users can run `scripts/start-project.ps1` or `scripts/start-project.bat` instead.

## Repo structure

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
│   ├── SECURITY.md               # ASVS/MASVS standards, tool matrix, workflow
│   ├── EXTERNAL_SKILLS.md        # provenance/version/license of vendored skills
│   ├── specs/                    # design docs land here (empty until Phase 0 runs)
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

## Workflow summary

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

Three discipline gates hold this together: (1) no code before the spec is approved; (2) no
advancing to the next layer before its tests pass; (3) no hard‑coded secrets — use `.env` /
`packages/shared/config` only. See `docs/WORKFLOW.md` for the full guide.

## Slash commands

| Command | What it does |
|---|---|
| `/phase-0` | Enter Plan Mode, run the `brainstorming` skill, write the approved design to `docs/specs/` (HARD GATE — no code first) |
| `/scope-breakdown` | Dispatch the `scope-planner` subagent against the approved spec → create `tasks/layer-*.md` |
| `/pick-task` | Show the next task in the current layer and load its relevant skills |
| `/run-layer` | Fan out independent tasks in the current layer to worktree‑isolated `task-implementer` subagents, merge, then run `code-reviewer` |
| `/next-layer` | Verify the layer's tests pass, advance `tasks/done.md`, create the next layer, bump "Current Layer" in `CLAUDE.md` |
| `/checkpoint` | Generate `CHECKPOINT.md` (git log + `done.md` + key decisions) and compact context |
| `/learn` | Extract patterns/gotchas from the finished layer into `.learnings/` |
| `/graph` | Run `graphify` over the monorepo and summarize `GRAPH_REPORT.md` |
| `/refine` | Brainstorm a reported bug/feature, then append it to `tasks/layer-refinement-todo.md` |

## Skills

### Authored

| Skill | Purpose |
|---|---|
| `brainstorming` | Phase 0 loop: clarify → 2‑3 approaches → design doc |
| `mobile-app-agent` | Screen composition, Expo Router navigation, device APIs, perf guardrails |
| `expo-router-nativewind` | Mobile foundation: root layout, NativeWind, Reanimated setup, New Arch |
| `mobile-auth-state` | Auth flows, secure token storage, persisted session store |
| `mobile-api-integration` | TanStack Query + typed client consuming `@shared` zod contracts |
| `mobile-data-forms` | `react-hook-form` + zod forms, FlashList lists, optimistic updates |
| `mobile-i18n-theme` | i18n and light/dark theme tokens with NativeWind |
| `mobile-testing-release` | Jest + RTL unit tests, Maestro e2e flows, release checklist |
| `expo-eas-pipeline` | EAS build/submit/update profiles, channels, secrets |
| `mobile-animations` | Reanimated v4 animation/gesture recipe library (the "how") |
| `motion-design-principles` | When/why to animate vs. restrain — the taste layer |
| `api-design` | REST resource design, pagination, error envelopes, versioning |
| `nestjs-backend` | Modules/DI/guards/pipes, Fastify adapter, `nestjs-zod` validation |
| `database-orm` | Prisma schema, migrations, `PrismaModule`/`PrismaService`, transactions |
| `backend-auth-security` | Guards + Passport, RBAC, CORS/CSRF, helmet, OWASP top‑10, BOLA/IDOR + mass‑assignment (ASVS) |
| `backend-testing` | Jest unit + Supertest integration against the Nest app |
| `shared-contracts` | `packages/shared` zod schemas as the mobile↔api single source of truth |
| `typescript-strict` | No `any`, narrowing, discriminated unions, `satisfies` |
| `git-workflow` | Conventional commits, branch naming, 1 commit = 1 task |
| `security-threat-model` | STRIDE + trust boundaries before a large feature (see `docs/SECURITY.md`) |
| `security-review` | Audit a diff/PR for high‑confidence security findings (ASVS/MASVS) |
| `expo-security` | Mobile hardening to OWASP MASVS: token storage, deep links, WebView, build config |

### Vendored (external, license‑preserved)

| Skill | Source | Why |
|---|---|---|
| `react-native-best-practices` | software‑mansion‑labs/skills | Authoritative Reanimated 4, gestures, Skia, 120fps |
| `react-native-guidelines` | vercel‑labs/agent‑skills | Perf guardrails: FlashList, memoization, expo‑image |
| `ui-ux-pro-max` | nextlevelbuilder/ui-ux-pro-max-skill | Visual design intelligence (styles, palettes, typography) |
| `ponytail` | DietrichGebert/ponytail | Code‑minimalism discipline (anti over‑engineering) |

See `docs/EXTERNAL_SKILLS.md` for pinned commits, licenses, and re‑sync commands.

## Animation

Reanimated v4 requires the **New Architecture** (`newArchEnabled: true` in `app.json`), and worklets
now live in a separate `react-native-worklets` package. The `expo-router-nativewind` foundation
skill wires this up; `mobile-animations` is the recipe library (scroll‑driven 3D cards,
swipe‑to‑island morph, gesture interactions, carousels, Skia effects); `motion-design-principles`
decides *whether and how much* to animate a given interaction (honoring `useReducedMotion()`,
200–350ms durations, springs, and UI‑thread‑only work) before `mobile-animations` is used to
implement it.

## CI/CD

Four GitHub Actions workflows live in `.github/workflows/`:

- `ci.yml` — on every PR/push: `pnpm turbo run lint typecheck test`
- `eas-preview.yml` — builds an EAS preview profile from `develop` / manual dispatch
- `eas-production.yml` — manual, gated EAS production build (+ optional submit)
- `api-deploy.yml` — builds the API Docker image; the actual hosting deploy step is left as a
  provider‑agnostic placeholder for you to fill in

See `docs/CI_CD.md` for required secrets and gate rules.

## License

MIT
