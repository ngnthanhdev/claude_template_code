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

`scope-planner` ends with a built-in self-check (coverage, consistency,
constitution compliance, structural gaps — see its definition) before
returning, so no separate gate command is needed.

After it returns, show the user the generated task file, relay anything the
self-check flagged but could not resolve, and confirm it looks right before
anything is picked up by `/pick-task` or `/run-layer`.
