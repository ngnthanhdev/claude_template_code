---
description: Fan out every independent task in the current layer to its own worktree-isolated task-implementer, merge the results, then run code-reviewer on each diff.
allowed-tools: Bash, Read, Grep, Glob
---

Read the current `tasks/layer-N-todo.md` (per `CLAUDE.md`'s "Current Layer"
pointer) and identify every task whose acceptance criteria are still
unchecked and whose **Files** list does not overlap with another such task's
— those are safe to run **in parallel** this round. If two unchecked tasks
do share files, run them sequentially instead and note that in your plan.

## 1. Fan out — one worktree per task

For each independent task, following `superpowers:using-git-worktrees`:

1. Create an isolated git worktree for that task (its own branch off the
   current layer branch, its own working directory) so parallel tasks
   cannot step on each other's uncommitted state.
2. Dispatch a `task-implementer` subagent scoped to exactly that one task,
   pointed at its worktree. Do this for all independent tasks in the same
   turn so they genuinely run concurrently.
3. Wait for each `task-implementer` to return its summary (files changed,
   how it was tested).

## 2. Merge

For each finished worktree, merge its branch back into the layer branch:

- If the merge is clean, proceed.
- **If a merge conflict occurs** — meaning two tasks touched overlapping
  files despite the dependency analysis — **surface it explicitly**: show
  which files conflict and which two tasks are responsible. Do not silently
  auto-resolve a conflict with `-X ours`/`-X theirs` or similar; present it
  and let the user (or a follow-up decision) decide how to reconcile it.

## 3. Review

Once all of this round's tasks are merged, dispatch `code-reviewer` on the
combined diff for the layer so far (or per-task diff if that's clearer for
the user to act on). Report its findings ranked by severity.

## 4. Report

Summarize: tasks completed this round, any merge conflicts surfaced and
their resolution status, and code-reviewer's findings. Remind the user that
`/next-layer` still requires the layer's tests to be green (via
`test-writer`) before advancing.
