---
description: Dispatch the scope-planner subagent against the approved spec in docs/specs/ to produce the next tasks/layer-N-todo.md.
---

Confirm an approved design document exists under `docs/specs/` (not just
`.gitkeep`). If none exists, stop and tell the user to run `/phase-0` first —
do not attempt to invent a spec.

Otherwise, dispatch the `scope-planner` subagent with:

- The most recent approved design doc in `docs/specs/`.
- `docs/SCOPE_BREAKDOWN.md` for the layering methodology.
- `tasks/done.md` (if present) so it knows what earlier layers already shipped.

`scope-planner` will extract the feature/component list from the spec,
dependency-analyze it, and emit exactly one new file:
`tasks/layer-N-todo.md` for the next unbuilt layer (Layer 0 is the
foundation layer — `apps/mobile`, `apps/api`, `packages/shared`, CI — unless
`tasks/layer-0-todo.md` already exists and is complete).

After it returns, show the user the generated task file and confirm it
looks right before moving on to `/pick-task` or `/run-layer`.
