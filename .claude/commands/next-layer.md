---
description: Gate the current layer on all tests passing, then advance tasks/done.md, create the next layer file, and bump Current Layer in CLAUDE.md.
---

1. **Gate: verify tests pass.** Dispatch `test-writer` (if it hasn't already
   run for this layer) to add the integration/e2e coverage the layer needs,
   then confirm the full test suite for every package touched by this layer
   is green. If anything is red or missing, **stop here** — do not advance.
   Report what's failing and suggest looping back into `/run-layer` or
   `/refine` a fix.
2. **Append to `tasks/done.md`.** Once green, move this layer's completed
   task blocks (with their checked acceptance criteria) into `tasks/done.md`.
3. **Create the next layer.** Dispatch `scope-planner` (same as
   `/scope-breakdown`) to emit `tasks/layer-(N+1)-todo.md`, now that this
   layer's actual implementation (not just the spec) is available as
   context for dependency analysis.
4. **Bump `CLAUDE.md`.** Update the "Current Layer" / "Current Task"
   section to point at the new layer and its first unchecked task.
5. Suggest `/checkpoint` next, so the layer's decisions and API contracts
   are captured before context grows further.
