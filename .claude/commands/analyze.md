---
description: Read-only consistency gate that cross-checks the approved spec(s), the layering methodology, and the generated tasks/layer-*.md against each other and against docs/CONSTITUTION.md — run after /scope-breakdown and before /run-layer.
argument-hint: '[layer file or "all"] (default: all layers + current spec)'
allowed-tools: Read, Grep, Glob
---

Target: $ARGUMENTS

Resolve the target layer file(s): a specific `tasks/layer-N-todo.md` (or
`tasks/layer-refinement-todo.md`) if named, otherwise every `tasks/layer-*.md`
present. Always cross-check against the most recent approved design doc(s)
in `docs/specs/`.

This command is **read-only** — it reports findings, it never edits
`docs/specs/`, `docs/SCOPE_BREAKDOWN.md`, or any `tasks/*.md` file. It runs
on the main thread; no subagent is dispatched.

## 1. Load the artifacts

- The approved spec(s) in `docs/specs/` — stop and tell the user to run
  `/phase-0` first if none exists.
- `docs/SCOPE_BREAKDOWN.md` for the layering methodology tasks are expected
  to follow.
- Every in-scope `tasks/layer-*.md`.
- `docs/CONSTITUTION.md` for the governing Articles every task and plan
  must comply with.

## 2. Coverage

- For every requirement in the spec (screen, endpoint, data model,
  cross-cutting concern), find at least one task that implements it. Flag
  any spec requirement with **no task** covering it.
- For every task, find the spec requirement it traces back to. Flag any
  task with **no spec basis** as scope creep.

## 3. Consistency

Cross-check spec ↔ `docs/SCOPE_BREAKDOWN.md` ↔ tasks for contradictions:

- **Stack** — does a task assume a library/pattern the spec or `CLAUDE.md`'s
  locked stack doesn't use?
- **Data shapes** — does a task's `Files`/`Acceptance` imply a schema that
  disagrees with the spec's data model?
- **Ordering** — does a task assume something exists that only a strictly
  later layer builds?

## 4. Constitution compliance

Check every task, and the layer file as a whole, against
`docs/CONSTITUTION.md`. Common violations to check explicitly: a task with
no test named in its `Acceptance` (Article IV), a task whose `Files` scope
is broader than the spec requires (Article VIII), a task touching
`apps/api` authorization/data-access with no server-side ownership check in
its `Acceptance` (Article VI), a task implying a hard-coded secret instead
of `.env`/`packages/shared/config` (Article V). Cite the specific Article
number for every finding in this category.

## 5. Structural gaps

For every task in scope, verify:

- Has a non-empty `Acceptance` field.
- `Depends` (if present) names a real `T-xxxxxx` id in the same layer file
  — flag a dangling reference, and flag a cycle (A depends on B depends on A).
- `Files` doesn't overlap another task's `Files` in the same layer — an
  overlap breaks `/run-layer`'s parallel-safety assumption.
- Sits in the layer its own dependencies allow — a task depending on
  something only a later layer builds is mis-layered.

## 6. Report a structured verdict

- **PASS** — state it plainly, list what was checked, and confirm it's safe
  to proceed to `/run-layer`.
- **Otherwise** — a ranked list of issues, most-blocking first, each as:
  **type** (coverage / consistency / constitution / structural) · **where**
  (file + task id, or spec section) · **fix** (the concrete next step — e.g.
  re-run `/scope-breakdown` for a coverage/consistency gap, or hand-edit the
  task file for a structural gap).

This gate is advisory, not hook-enforced: fix what it finds — by re-running
`/scope-breakdown` or editing the task file directly — before running
`/run-layer`. If you proceed to `/run-layer` despite open findings, say so
explicitly and name what's still outstanding.
