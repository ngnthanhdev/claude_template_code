---
description: Explain how to launch the realtime task-board dashboard and what it shows.
---

The task board is a small local dashboard (`tools/board/`) that renders
`tasks/*.md` as a kanban board and updates live as those files change.

Do not start the server yourself in this session — `pnpm board` is a
long-running foreground process, and running it in-session would block this
conversation. Instead:

1. Tell the user to open a **separate, real terminal** (not this Claude Code
   session) and run:
   ```bash
   pnpm board
   ```
   This starts the board server at `http://127.0.0.1:4319` (override the port
   with `BOARD_PORT=<port> pnpm board`).
2. Tell them to open `http://127.0.0.1:4319` in a browser.
3. Explain what they'll see:
   - **Swimlanes** grouped by layer (Layer 0, Layer 1, ..., Refinement).
   - **Six columns** per lane, in order: Todo → Ready → In Progress →
     Blocked → Review → Done — the same `Status` values `tasks/*.md` uses.
   - Each card shows the task id, title, an AI/Human assignee badge, its
     skills, and a file count; Blocked and Review cards are visually
     distinct (color-coded) so they stand out at a glance.
   - **Dragging a card into Ready is the "assign to AI" action** — it PATCHes
     that task's `Status` to `ready` in its source `tasks/layer-*.md` file.
     Dragging between any other columns updates `Status` the same way.
     Cards can't be dragged between different layer swimlanes — layer isn't
     a patchable field, only `Status`/`Assignee` are.
   - The board only ever writes `Status`/`Assignee`. Task content (title,
     files, acceptance criteria, skills, notes) stays owned by Claude /
     `scope-planner` — the board never edits it.
4. Tell them: once a task is sitting in **Ready**, run `/run-task` here in
   Claude Code to pick it up — it implements the task in an isolated
   worktree and moves it to Review/Done (or Blocked) as it goes. The board
   reflects that progress live over its WebSocket connection; no refresh
   needed.
5. The server runs **outside** the Claude Code session entirely — it's a
   plain Node process. Stop it with Ctrl-C in the terminal it's running in.
