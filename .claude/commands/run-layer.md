---
description: Implement the current layer — fan out independent tasks to worktree-isolated task-implementers (3+ tasks) or sequentially on the main thread (<=2 tasks), merge, then run the reviewer on the diff.
---

Assumes `scope-planner`'s self-check passed when this layer file was
generated (or the user chose to proceed despite open flags) — this command
does not re-run that check itself.

Read the current `tasks/layer-N-todo.md` (per `CLAUDE.md`'s "Current Layer"
pointer) and identify every task whose `Status` is still `todo` or `ready`
and whose **Files** list does not overlap with another such task's — those
are safe to run **in parallel** this round. If two not-yet-done tasks do
share files, run them sequentially instead and note that in your plan.

## 0. Small layer? Skip the fan-out

If the layer has **≤ 2 runnable tasks**, do not create worktrees or
dispatch subagents — implement the tasks sequentially on the main thread
(TDD, same per-task discipline as `task-implementer`), then jump to step 3
(Review). Subagent + worktree overhead outweighs parallelism at this size.

## 1. Fan out — one worktree per task

For each independent task, following `superpowers:using-git-worktrees`:

1. Create an isolated git worktree for that task (its own branch off the
   current layer branch, its own working directory) so parallel tasks
   cannot step on each other's uncommitted state.
2. Set the task's `Status` to `in-progress` (via `tools/board/lib/tasks.ts`'s
   `patchTask`, or by hand) before dispatching it, so the board reflects
   that work has started the moment it has.
3. Dispatch a `task-implementer` subagent scoped to exactly that one task,
   pointed at its worktree. Do this for all independent tasks in the same
   turn so they genuinely run concurrently.
4. Wait for each `task-implementer` to return its summary (files changed,
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

Once all of this round's tasks are merged, set each merged task's `Status`
to `review` — the diff exists and is merged, but hasn't cleared review yet.

Dispatch `reviewer` on the combined diff for the layer so far (or
per-task diff if that's clearer for the user to act on) — one pass covers
correctness, simplification, and the security lens. If this layer touches
auth, payments, or a new trust boundary, invoke it with `model: opus`
instead of its sonnet default. Report findings ranked by severity.

If the reviewer comes back clean (no unresolved high-confidence findings)
for a task, set its `Status` to `done`. If a finding needs a follow-up fix,
leave it at `review` (or move it back to `in-progress` once you start the
fix) until it's actually resolved — `Status: done` means review is
satisfied, not just that code was written.

## 4. Report

Summarize: tasks completed this round (and their resulting `Status`), any
merge conflicts surfaced and their resolution status, and the reviewer's
findings. Remind the user that `/next-layer` still requires the layer's
tests to be green before advancing.
