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

## Architecture

- `server.ts` — Node `http` server (no framework): serves the UI, a
  `GET /api/tasks` snapshot, a `PATCH /api/tasks/:id` write path, a
  locally-served copy of `sortablejs` (no CDN), and a `ws` WebSocket channel
  fed by a `chokidar` watcher on `tasks/`.
- `ui/index.html` — the entire client: one self-contained file (no build
  step), vanilla JS, SortableJS for drag-and-drop, a plain `WebSocket` for
  the realtime feed.
- `lib/tasks.ts` — the parser/serializer foundation (pre-existing); the
  board only ever calls its public `parseTasksDir`/`patchTask` API, it does
  not touch the task-block text format directly.

No build step anywhere in this package — `tsx` runs the TypeScript server
file directly, and the UI is plain HTML/CSS/JS.
