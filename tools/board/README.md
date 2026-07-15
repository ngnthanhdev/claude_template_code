# Task board

A tiny, dependency-light realtime kanban dashboard over `tasks/*.md`. It's a
**PM/human-facing view**, not part of the template's Claude Code engine — it
runs as a plain Node process, entirely outside any Claude Code session.

## Run it

```bash
pnpm board
```

Starts the server at `http://127.0.0.1:4319` and prints the exact URL, e.g.
`Board for "my-project" → http://127.0.0.1:4319`. Open that URL in a browser.
Stop it with Ctrl-C in the terminal it's running in — it's a long-running
foreground process, so run it in its own real terminal, not inside a Claude
Code session (see `/board`).

### Port selection (multi-project friendly)

- **Default:** the board starts at `4319`. If that port is busy, it
  **auto-advances** to the next free port up to `4339`, so several project
  boards can run at once without colliding. The startup log always prints the
  port it actually bound.
- **Force a port:** `BOARD_PORT=<port> pnpm board` binds exactly that port and
  does **not** auto-advance — if it's busy the board exits with a clear
  message (you asked for that specific port).
- The Host/Origin allowlist is always derived from the **actually-bound**
  port, so an auto-advanced board only trusts its own real port.

Each board serves only its own repository's `tasks/` — the project name shown
in the page header and browser-tab title (from the root `package.json` "name",
falling back to the repo-root directory name) makes two open boards instantly
distinguishable. It's also available at `GET /api/meta` →
`{ project, port }`.

## Two-way sync model

- **`tasks/*.md` is the single source of truth.** The board never invents,
  deletes, or rewrites task content.
- **The board only ever PATCHes `Status` and `Assignee`** — dragging a card
  to a new column, or (in principle) reassigning it, is the only write path
  it has. Everything else about a task (title, `Files`, `Acceptance`,
  `Skills`, `Depends`, notes) is owned by Claude / `scope-planner` /
  `/refine`, never the board.
- **Claude → board is realtime, one-way, file-driven.** The server watches
  `tasks/*.md` with `chokidar`; any change (a `task-implementer` finishing a
  task, `/run-task` flipping a status, a hand edit) is re-parsed and
  broadcast to every connected browser over WebSocket within ~100ms — no
  polling, no refresh.
- **Board → Claude is asynchronous, via the files.** Dragging a card issues
  a `PATCH /api/tasks/:id` that calls `patchTask()` (from
  `tools/board/lib/tasks.ts`), which rewrites only the `Status`/`Assignee`
  line for that task, byte-for-byte elsewhere. Claude picks that change up
  the next time it reads the task file (in practice, via `/run-task`, which
  is built specifically to drain whatever's sitting in `Ready`).

## Status columns

The six columns match the schema in `tools/board/lib/tasks.ts` and
`docs/SCOPE_BREAKDOWN.md`, left to right: **Todo → Ready → In Progress →
Blocked → Review → Done**. Dragging a card into **Ready** is the "assign to
AI" action — it's the queue `/run-task` drains. Cards are grouped into
swimlanes by `layer` (Layer 0, Layer 1, ..., Refinement); a card can move
between columns within its own lane, but not across lanes (layer isn't a
patchable field).

## Autonomous runner (opt-in, OFF by default)

The board can optionally *implement* ready tasks for you, unattended, by
spawning headless `claude` runs. This is powerful and risky, so it is
**off by default** and cannot be turned on from the browser on a plain board.

### ⚠️ Read before enabling

- It spends **real Claude API budget** — every picked task is a full agent run.
- It **changes code unattended** in isolated git worktrees.
- It requires a **logged-in `claude` CLI on your machine** — this template
  ships no credentials and never will; the runner just spawns whatever
  `claude` (or `BOARD_CLAUDE_BIN`) resolves to, using your own login.
- It **never pushes and never merges.** Every run lands on a throwaway
  `auto/<id>` branch in its own worktree; a human reviews and merges. Nothing
  reaches your working branch automatically.

### How to enable / disable

```bash
pnpm board:auto      # start the server auto-CAPABLE (still disarmed)
```

`pnpm board` (the normal command) starts the server with the runner **fully
inert**: `GET /api/runner` reports `{available:false}`, the arm switch does
nothing, and nothing can ever spawn. Only `pnpm board:auto` (which sets
`BOARD_AUTO=1`) makes the runner *capable* of arming.

Even when auto-capable, the runner starts **disarmed**. Arm it from the board
UI's **Auto-run** switch (a red ARMED banner appears), or via
`POST /api/runner {"enabled":true}`. Disarm the same way — disarming stops it
picking up any new tasks (in-flight runs finish or you stop the server).

### Safety model

- **Off by default; browser can't weaponize a plain board.** The autonomous
  capability exists only in a process started with `pnpm board:auto`. A plain
  board's runner is constructed unavailable and ignores every arm request.
- **Only `Status: ready` + `Assignee: ai` tasks** whose `Depends` are all
  `done` are ever eligible. Nothing else is touched.
- **Worktree isolation, no auto-merge/push.** Each task runs in its own
  `git worktree` under the gitignored `.board-worktrees/<id>` on branch
  `auto/<id>` off current HEAD. Success → `Status: review` (you review + merge
  the branch). Failure/timeout → `Status: blocked`, and its worktree + branch
  are removed. There is deliberately no push or merge anywhere in the runner.
- **Caps.** Max 2 tasks concurrently by default (`BOARD_MAX_CONCURRENT`), and
  only tasks with **disjoint `Files`** lists run together. Each task has a hard
  wall-clock timeout (`BOARD_TASK_TIMEOUT_MS`, default 15 min); on exceed the
  child is killed and the task is set `blocked`. A turn/cost cap is passed to
  `claude` too (see below).
- **Command-injection safe.** `claude` is spawned with an **args array**, never
  a shell string; the task title/acceptance travel in `argv`, never
  interpolated into a shell. The worktree/branch name uses the validated
  `T-xxxxxx` id (`/^T-[0-9a-f]{6}$/`), never the title.
- **The repo's hooks still apply to the child.** The worktree checkout carries
  `.claude/settings.json`, so `block-build-output` still rejects heavy mobile
  builds inside a run. The headless session's permission bypass is contained to
  the worktree cwd; it is never pointed at the main repo.

### Configuration (env)

| Var | Default | Meaning |
|---|---|---|
| `BOARD_AUTO` | unset | `1` makes the runner auto-capable (set by `pnpm board:auto`). |
| `BOARD_CLAUDE_BIN` | `claude` | Binary to spawn per task (injectable for testing). |
| `BOARD_MAX_CONCURRENT` | `2` | Max tasks running at once. |
| `BOARD_TASK_TIMEOUT_MS` | `900000` | Hard per-task timeout (15 min). |
| `BOARD_MAX_TURNS` | `25` | Turn cap fed into the default limit args. |
| `BOARD_PERMISSION_MODE` | `bypassPermissions` | `--permission-mode` for the headless run (contained to the worktree). |
| `BOARD_CLAUDE_LIMIT_ARGS` | `--max-turns <n>` | Turn/cost-cap args. **Note:** some installed `claude` builds expose `--max-budget-usd` instead of `--max-turns` — set e.g. `BOARD_CLAUDE_LIMIT_ARGS="--max-budget-usd 2"` on those. The hard timeout above is the version-independent containment guarantee. |
| `BOARD_CLAUDE_EXTRA_ARGS` | (none) | Extra `claude` flags appended verbatim. |

## Architecture

- `server.ts` — Node `http` server (no framework): serves the UI, a
  `GET /api/tasks` snapshot, a `PATCH /api/tasks/:id` write path, the
  `GET/POST /api/runner` endpoints, a locally-served copy of `sortablejs` (no
  CDN), and a `ws` WebSocket channel fed by a `chokidar` watcher on `tasks/`.
- `runner.ts` — the opt-in autonomous runner (worktree isolation, per-task
  `claude` spawn, caps, `review`/`blocked` transitions). Inert unless the
  server was started with `BOARD_AUTO=1`.
- `ui/index.html` — the entire client: one self-contained file (no build
  step), vanilla JS, SortableJS for drag-and-drop, a plain `WebSocket` for
  the realtime feed, and the Auto-run indicator/switch.
- `lib/tasks.ts` — the parser/serializer foundation (pre-existing); the
  board only ever calls its public `parseTasksDir`/`patchTask` API, it does
  not touch the task-block text format directly.

No build step anywhere in this package — `tsx` runs the TypeScript server
file directly, and the UI is plain HTML/CSS/JS.
