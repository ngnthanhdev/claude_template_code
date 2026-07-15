---
description: Drain every Status:ready task across tasks/*.md (honoring layer order + Depends), dispatching worktree-isolated task-implementers and moving each to review/done or blocked as it resolves.
---

This is the board's counterpart to `/run-layer` — instead of fanning out a
single layer file's `todo`/`ready` tasks, it drains whatever the task board
(or a human) has manually dragged into **Ready**, across every `tasks/*.md`
file, in dependency-safe order.

## 1. Select the ready queue

1. Parse every `tasks/*.md` file (via `tools/board/lib/tasks.ts`'s
   `parseTasksDir`, or by reading them directly) and collect every task
   whose `Status` is `ready`.
2. Order that queue by **layer** first (numeric layers ascending, then
   `refinement`), then filter by **Depends**: a ready task whose `Depends`
   names another task that is not yet `Status: done` cannot run this round —
   leave it at `ready` and note it as waiting; don't guess at reordering or
   satisfying its dependency for it.
3. Whatever's left with no unmet `Depends` is safe to fan out **in
   parallel** this round, the same rule `/run-layer` uses: only dispatch two
   tasks in the same turn if their `Files` lists don't overlap. If they do,
   run them sequentially instead.

If the queue is empty, tell the user there's nothing in `Ready` right now
and stop — don't invent work.

## 2. Fan out — one worktree per task

For each task selected this round, following `superpowers:using-git-worktrees`:

1. Set the task's `Status` to `in-progress` via `patchTask` **before**
   dispatching it, so the board reflects that work has started the moment
   it has (the board's chokidar watcher broadcasts this within ~100ms).
2. Create an isolated git worktree for that task (its own branch, its own
   working directory) so parallel tasks can't step on each other's
   uncommitted state.
3. Dispatch a `task-implementer` subagent scoped to exactly that one task,
   pointed at its worktree. Dispatch every independent task selected this
   round in the same turn so they genuinely run concurrently.
4. Wait for each `task-implementer` to return its summary (files changed,
   how it was tested).

## 3. Resolve each task's outcome

For each finished worktree:

- **Merges cleanly, tests green** → merge its branch back into the current
  layer branch, then set `Status` to `review` — the same convention
  `/run-layer` uses (`done` means a reviewer has also signed off, not just
  that code was written and merged). Only use `done` directly if the user
  has told you this class of task can skip review.
- **Merge conflict** (two tasks touched overlapping files despite the
  `Files`-overlap check) → surface it explicitly, showing which files and
  which two tasks are responsible. Do not auto-resolve with `-X ours`/
  `-X theirs`. Leave the task at `in-progress` until it's reconciled.
- **`task-implementer` reports it's blocked** (missing context, a decision
  only a human can make, a dependency that turned out unmet) → set `Status`
  to `blocked` and record exactly why in your report, rather than guessing
  at a fix or silently retrying.

## 4. Report

Summarize: which tasks were picked up this round and their resulting
`Status`, which tasks stayed in `ready` waiting on an unmet `Depends`, any
merge conflicts and their resolution state, and any `blocked` tasks with the
reason. Remind the user that `review`-status tasks still need `code-reviewer`
(and `security-reviewer`, per `docs/WORKFLOW.md`) before they're truly
`done`, and that `/next-layer` still gates on the whole layer's tests
passing before advancing.
