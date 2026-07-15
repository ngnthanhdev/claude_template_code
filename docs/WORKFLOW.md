# Workflow

This is the full lifecycle this template drives you through: from a fresh
clone with no code, to a tested, CI-gated product, one dependency-ordered
layer at a time. `CLAUDE.md` `@`-imports this file so Claude always has it in
context.

## The lifecycle at a glance

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

Every stage below expands one line of that diagram.

## Phase 0 — Brainstorm and design (HARD GATE)

A fresh clone of a project built from this template has an empty
`docs/specs/` (only `.gitkeep`). That emptiness *is* the trigger: `CLAUDE.md`'s
first-time-setup gate checks for it every session and refuses to let any code,
scaffold, or `apps/*` change happen until an approved design exists.

`/phase-0` puts Claude into Plan Mode and invokes the `brainstorming` skill,
which:

1. Reads whatever the user has already written (`docs/BRIEF.md`, an existing
   `docs/SPECIFICATIONS.md`, or a brain-dump paragraph).
2. Asks clarifying questions **one at a time**, preferring multiple-choice
   framing so the user can answer quickly.
3. Proposes **2–3 concrete approaches** with a recommendation and trade-offs,
   rather than jumping straight to one design.
4. Writes the agreed design **section by section** so the user can correct
   direction early, rather than reviewing one giant document at the end.
5. Saves the result to `docs/specs/YYYY-MM-DD-<topic>-design.md`.
6. Self-reviews the doc for internal consistency before handing it to the user.
7. Waits for explicit user approval. Nothing past this point happens without it.

Only after this approval does `docs/specs/` stop being empty, and only then
does the gate in `CLAUDE.md` open. See `docs/phases/phase-0.md` for the
detailed step-by-step instructions Claude follows during this phase.

For a feature large enough to introduce a new trust boundary, data flow, or
privilege level, run **`/threat-model`** during this Phase 0 pass (or during
`/refine` for a feature-sized change later) — before the design doc is
finalized, not after. See `docs/SECURITY.md` for the full workflow.

## Scope breakdown

Once a design is approved, `/scope-breakdown` dispatches the `scope-planner`
subagent (model: Opus — this is a reasoning-heavy dependency analysis, not
routine implementation). It reads the approved spec and produces
`tasks/layer-0-todo.md`, the first in a series of `tasks/layer-N-todo.md`
files. Layer 0 is always the foundation layer: scaffolding the Expo app, the
NestJS API, `packages/shared`, and wiring CI, per the approved stack. See
`docs/SCOPE_BREAKDOWN.md` for the full layering methodology.

## The layer loop

Each layer is worked through the same four-step loop:

1. **`/run-layer`** — Claude reads the current layer's task file
   (`tasks/layer-N-todo.md`) and fans out every task that has no dependency on
   another task in the same layer to its own `task-implementer` subagent
   (model: Sonnet), each running in an **isolated git worktree** so parallel
   tasks cannot step on each other's working-tree state. Each
   `task-implementer` picks up its one task, loads the skills that task names,
   writes a failing test, implements until it passes, and returns a summary —
   files changed and how it was tested.
2. **Merge** — worktrees are merged back into the layer branch. If two tasks
   touched overlapping files despite the dependency analysis, the merge step
   surfaces the conflict explicitly rather than silently resolving it —
   Claude (or the user) decides how to reconcile it.
3. **`code-reviewer`** (model: Opus) reviews each merged diff for correctness
   bugs and simplification/reuse opportunities, and reports findings ranked by
   severity.
4. **`security-reviewer`** (model: Opus) runs after `code-reviewer` on the
   same diff — the security lens (BOLA/IDOR, mass assignment, DTO
   validation, secrets, rate limiting) rather than correctness/simplification.
   Reports only high-confidence findings, per `docs/SECURITY.md`.
5. **`test-writer`** (model: Sonnet) adds the integration/e2e coverage that a
   single-task unit test can't reach — Jest+Supertest flows for the API,
   React Testing Library flows for mobile, Maestro flows once a release is
   near.

Only once every task in the layer is done, reviewed, and its tests are green
does `/next-layer` run:

- Verifies the gate: **all tests pass**. If not, the layer isn't finished —
  loop back into `/run-layer` or `/refine` a fix.
- Appends the layer's completed tasks to `tasks/done.md`.
- Creates the next `tasks/layer-N+1-todo.md`.
- Bumps the "Current Layer" / "Current Task" pointers in `CLAUDE.md`.

## Between layers

Between finishing one layer and starting the next, run three commands to keep
the project's memory durable and the session's context small:

- **`/checkpoint`** — regenerates `CHECKPOINT.md` from `git log`, `tasks/done.md`,
  and the layer's key decisions, API contracts, and known issues. Do this
  before compacting or ending a long session so nothing is lost.
- **`/learn`** — extracts durable patterns and gotchas discovered in the
  layer into `.learnings/<topic>.md`, so future layers (and future sessions)
  don't rediscover the same trap.
- **`/graph`** — runs `graphify` over the monorepo and summarizes
  `GRAPH_REPORT.md`, giving a quick dependency-graph sanity check as the
  codebase grows.

## Task board (PM view)

`tools/board/` is a small realtime dashboard over `tasks/*.md` — run it with
`pnpm board` (outside the Claude Code session; see `/board`). It's the PM
view onto the same layer loop above: swimlanes by layer, columns by
`Status`. Dragging a card into **Ready** is how a human queues a task for AI
without going through `/pick-task`; `/run-task` drains that queue the same
way `/run-layer` drains a layer file, honoring layer order and `Depends`.
The board reflects every `Status` change — whether made by a
`task-implementer`, `/run-task`, or a manual drag — live, because it watches
`tasks/*.md` directly; it never edits task content itself.

## Refinement

Once the initial layers are built, ongoing bug reports and feature requests
don't skip the discipline — they go through `/refine`: Claude brainstorms the
item briefly (what's actually being asked, is it a bug or a new feature, what
does "done" look like), then appends it to `tasks/layer-refinement-todo.md`
using the same task-block format as any other layer task, ready to be picked
up by `/run-layer`.

## Command / subagent map

| Phase | Command | Subagent invoked | Model |
|---|---|---|---|
| Design | `/phase-0` | — (`brainstorming` skill, main thread) | Opus |
| Scope | `/scope-breakdown` | `scope-planner` | Opus |
| Pick work | `/pick-task` | — | — |
| Implement | `/run-layer` | `task-implementer` (fan-out) | Sonnet |
| Review | `/run-layer` (post-merge step) | `code-reviewer` | Opus |
| Security review | `/run-layer` (post-code-reviewer step) / `/security-review` | `security-reviewer` | Opus |
| Layer tests | `/next-layer` (pre-gate step) | `test-writer` | Sonnet |
| Advance | `/next-layer` | — | — |
| Checkpoint | `/checkpoint` | — | — |
| Learn | `/learn` | — | — |
| Graph | `/graph` | — | — |
| Bug/feature | `/refine` | — (brainstorm, main thread) | Opus |
| Threat model | `/threat-model` | — (`security-threat-model` skill, main thread) | Opus |
| Debug | — (ad hoc) | `debugger` | Opus |

## The three discipline gates

These three rules are what keep the workflow from degrading into "just start
coding":

1. **No code before spec approval.** `docs/specs/` must contain an approved
   design document before any `apps/*` file is touched. Enforced by the
   `CLAUDE.md` hard gate and, for anything not caught there, by good judgment —
   if asked to skip Phase 0, don't.
2. **No advancing layers before tests pass.** `/next-layer` refuses to create
   the next layer file or bump the Current Layer pointer while any test in the
   current layer is red or missing. A layer isn't "done" because the code
   exists — it's done because it's proven to work.
3. **No hard-coded secrets.** Every credential, API key, or environment-
   specific value lives in `.env` (gitignored, see `.env.example` for the
   shape) or in `packages/shared/config`, never inline in application code,
   never committed in plaintext.
