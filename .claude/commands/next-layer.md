---
description: Gate the current layer on all tests passing, then advance tasks/done.md, create the next layer file, and bump Current Layer in CLAUDE.md.
---

1. **Gate: verify tests pass.** If the layer has cross-task flows (an
   endpoint a screen calls, a schema both sides share, a release-relevant
   journey), dispatch `test-writer` to cover those seams — skip it for
   layers whose tasks are independent (task-level tests already exist per
   Article IV). Then confirm the full test suite for every package touched
   by this layer is green. If anything is red or missing, **stop here** —
   do not advance. Report what's failing and suggest looping back into
   `/run-layer` or `/refine` a fix.
2. **Tag the checkpoint.** Once the gate passes, stamp
   `git tag layer-N-done` (N = the layer that just finished). This is the
   rollback point the "Rollback & checkpoints" section of
   `.claude/skills/git-workflow/SKILL.md` resets to if the layer ever needs
   to be undone — do this before any of the steps below change `tasks/*.md`
   or `CLAUDE.md`.
3. **Append to `tasks/done.md`.** Move this layer's completed task blocks
   (with their checked acceptance criteria) into `tasks/done.md`.
4. **Create the next layer.** Dispatch `scope-planner` (same as
   `/scope-breakdown`) to emit `tasks/layer-(N+1)-todo.md`, now that this
   layer's actual implementation (not just the spec) is available as
   context for dependency analysis.
5. **Bump `CLAUDE.md`.** Update the "Current Layer" / "Current Task"
   section to point at the new layer and its first unchecked task.
6. Suggest `/checkpoint` next — it captures the layer's decisions and API
   contracts AND extracts durable learnings into `.learnings/` in the same
   pass, before context grows further.
