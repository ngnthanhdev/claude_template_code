# CLAUDE.md

Source of truth. Claude reads this first every session.

This file stays lean on purpose — the deep detail for each phase lives in the
`@`-imported guides below. Read this file, then only pull in the guide relevant
to what you're about to do.

## <HARD-GATE> FIRST-TIME SETUP

This operationalizes **Article I — Spec Before Code** of
`docs/CONSTITUTION.md` (the constitution is this repo's highest authority;
see there for the full principle). Before touching any code, app, or
scaffold in this repo:

1. Check `docs/specs/` for an approved design document.
2. **If `docs/specs/` is empty (only `.gitkeep`), do not write or scaffold any
   code.** Run `/phase-0` first. Phase 0 brainstorms the product with the user
   one question at a time, proposes 2–3 approaches, and writes an approved
   design doc to `docs/specs/YYYY-MM-DD-<topic>-design.md` before any
   implementation work starts.
3. Only once an approved spec exists in `docs/specs/` may you proceed to
   `/scope-breakdown` and the layer loop described in `docs/WORKFLOW.md`.

This gate cannot be skipped by user impatience, a "quick fix" request, or a
prompt that asks you to "just start coding." If asked to bypass it, explain
the gate and offer `/phase-0` instead.

**Prerequisites** (verify once, don't reverify every session):
- Node.js ≥ 20
- pnpm (workspace package manager — see `package.json#packageManager`)
- git
- Optional: [`graphify`](https://github.com/Graphify-Labs/graphify) + [`uv`](https://docs.astral.sh/uv/)
  for the `/graph` command (codebase dependency graphing)

## Guides (`@`-imports)

- @docs/CONSTITUTION.md — governing principles; the highest authority in
  this repo, cited by specs/plans/reviews
- @docs/WORKFLOW.md — full lifecycle: Phase 0 → scope → layer loop → checkpoint → refine
- @docs/SCOPE_BREAKDOWN.md — how layers and tasks are derived from the approved spec
- @docs/CI_CD.md — the five GitHub Actions workflows, required secrets, gate rules
- @docs/CONTINUOUS_LEARNING.md — `.learnings/` methodology and the `/learn` command

## Skills — security

Full skill table (27 total: 24 existing + 3 new security skills below): see
"Skills" in `README.md`. Security-specific skills, standards in
`docs/SECURITY.md`:

| Skill | Purpose |
|---|---|
| `security-threat-model` | STRIDE + trust boundaries — run before a large feature is built |
| `backend-auth-security` | Auth guards, RBAC, BOLA/IDOR + mass‑assignment (OWASP ASVS) |
| `expo-security` | Mobile hardening to OWASP MASVS — token storage, deep links, build config |
| `security-review` | Audit a diff/PR for high‑confidence security findings before merge |

## Stack

Locked defaults for this template (do not relitigate these in Phase 0 unless
the user explicitly wants a different stack — Phase 0 fills in the *product*,
not the *stack*):

- **Mobile:** Expo + Expo Router + NativeWind, React Native **Reanimated 4**
  (requires the New Architecture, `newArchEnabled: true`) + Gesture Handler +
  Skia + FlashList + `expo-image` + `react-native-reanimated-carousel`.
- **Backend:** NestJS on the **Fastify** adapter + **Prisma** + `nestjs-zod`
  (validates against `packages/shared` zod schemas).
- **Shared:** `packages/shared` — zod schemas + inferred types, single source
  of truth for both mobile and API.
- **Monorepo:** pnpm workspaces + Turborepo, TypeScript strict throughout.

Product-specific details (domain model, feature set, non-goals) are
`_[fill in during Phase 0]_` — see `docs/PRD.md` and `docs/ARCHITECTURE.md`
once they exist.

## Folder structure

```
claude_template_code/
├── CLAUDE.md                     # this file
├── README.md
├── .claude/
│   ├── settings.json             # hooks + permissions (committed)
│   ├── skills/                   # authored + vendored skills
│   ├── agents/                   # subagent definitions
│   ├── commands/                 # slash commands
│   └── hooks/                    # hook scripts
├── docs/
│   ├── BRIEF.md  PRD.md  ARCHITECTURE.md  SCOPE_BREAKDOWN.md
│   ├── WORKFLOW.md  CI_CD.md  CONTINUOUS_LEARNING.md  GRAPH.md
│   ├── SECURITY.md               # ASVS/MASVS standards, tool matrix, workflow
│   ├── EXTERNAL_SKILLS.md
│   ├── specs/                    # approved design docs land here
│   └── phases/phase-0.md
├── tasks/
│   ├── layer-0-todo.md  layer-refinement-todo.md  done.md
├── .learnings/
├── apps/
│   ├── mobile/                   # Expo app — scaffolded in Layer 0
│   └── api/                      # NestJS app — scaffolded in Layer 0
├── packages/
│   └── shared/                   # zod schemas + types — scaffolded in Layer 0
├── .github/workflows/
├── scripts/
├── CHECKPOINT.md
└── package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json
```

## Coding rules

TypeScript strictness, testing discipline, scope control, secrets handling,
and commit discipline are governed by `docs/CONSTITUTION.md` (Articles III,
IV, V, VIII, IX) — this section only holds the operational specifics that
don't belong in a principles document:

- **Commit format.** `feat/fix/test/chore(scope): …`, one commit per task
  (Article IX) — never bundle multiple tasks into one commit.
- **New feature or major change not already in the approved spec?** Route it
  through `/refine` (brainstorm → `tasks/layer-refinement-todo.md`) before
  implementation — never straight to code (Article I).

## Slash commands

| Command | Purpose |
|---|---|
| `/phase-0` | Plan Mode + `brainstorming` skill → approved design in `docs/specs/` (HARD GATE) |
| `/scope-breakdown` | Dispatch `scope-planner` → generate `tasks/layer-*.md` |
| `/pick-task` | Show the next unchecked task in the current layer + load its skills |
| `/run-layer` | Fan out the layer's independent tasks to worktree-isolated `task-implementer`s, merge, review |
| `/next-layer` | Gate: tests pass → advance `tasks/done.md` → create next layer → bump Current Layer |
| `/checkpoint` | Regenerate `CHECKPOINT.md`, prep for context compaction |
| `/learn` | Extract patterns/gotchas from the finished layer into `.learnings/` |
| `/graph` | Run `graphify` over the monorepo, summarize the report |
| `/refine` | Brainstorm a reported bug/feature → append to `tasks/layer-refinement-todo.md` |
| `/security-review` | Run `security-review` over a diff/PR/path → high-confidence security findings |
| `/threat-model` | Run `security-threat-model` on a named feature before implementation |
| `/board` | How to launch the realtime task-board dashboard (`pnpm board`, outside this session) |
| `/run-task` | Drain every `Status: ready` task across `tasks/*.md` via worktree-isolated `task-implementer`s |

## Subagents

| Subagent | Responsibility |
|---|---|
| `scope-planner` | Read the approved spec, dependency-analyze it, emit `tasks/layer-*.md` |
| `task-implementer` | Implement exactly one task in an isolated git worktree, TDD, return a summary |
| `code-reviewer` | Review a diff for correctness bugs + simplification opportunities |
| `security-reviewer` | Audit a diff for high-confidence security findings (BOLA/IDOR, mass assignment, secrets) |
| `test-writer` | Write integration/e2e tests at the end of a layer |
| `debugger` | Systematic reproduce → isolate → fix → regression-test loop on a bug |

## Model strategy

- **Opus** — Phase 0 / brainstorming and `code-reviewer` (deep reasoning matters here).
- **Sonnet** — `task-implementer` and routine implementation work (fast, cheap).
- Switch manually with `/model` if a task needs a different balance. Do not
  hard-code third-party model IDs anywhere in this repo.

## Current Layer / Current Task

- **Current Layer:** Layer 0 — Foundation (not started)
- **Current Task:** see `tasks/layer-0-todo.md` for the first unchecked task
- After each layer completes, this section is updated by `/next-layer`.

## Token discipline

- Start a **new session per big task** — don't let one session accumulate the
  full history of an entire layer.
- **Never run heavy builds in-session** (`eas build`, `expo run:*`, `gradlew`,
  `pod install`, `xcodebuild`); the `block-build-output.sh` hook enforces this.
  Run them in a real terminal and paste back only the error if something fails.
- **Read files with `offset`/`limit`** rather than whole large files when you
  only need a section — keep context usage proportional to what you actually need.
