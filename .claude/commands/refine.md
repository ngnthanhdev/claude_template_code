---
description: Brainstorm a reported bug or feature request, then append it to tasks/layer-refinement-todo.md using the standard task-block format.
argument-hint: <bug|feature description>
---

The user has reported: $ARGUMENTS

1. Brainstorm this briefly before writing anything down:
   - What is actually being asked — restate it in your own words and
     confirm you've understood correctly if it's at all ambiguous.
   - Is this a **bug** (existing behavior is wrong relative to the approved
     spec/tests) or a **feature** (new behavior not covered by the approved
     spec)? If it's a feature not already covered by `docs/specs/`, this is
     the discipline gate from `CLAUDE.md` — it goes through this brainstorm,
     never straight to code.
   - What does "done" look like — a concrete, testable acceptance criterion.
   - If it's a bug, is the fix obvious enough to scope directly, or does it
     need a `debugger` pass first to find the root cause before it can be
     scoped as a task?
2. Append it to `tasks/layer-refinement-todo.md` using the same task-block
   format `scope-planner` uses for any other layer task — a level-3 heading
   with a fresh, stable `T-xxxxxx` id (`T-` + 6 lowercase hex, never reused),
   followed by its metadata list:
   ```markdown
   ### T-a3f9c1 — <short name>
   - **Status:** todo
   - **Assignee:** ai
   - **Files:** <concrete paths expected to change>
   - **Acceptance:** <checkable condition(s) — a single line, or an indented sub-list for more than one>
   - **Skills:** <.claude/skills/* to load>
   - **Depends:** <other T-xxxxxx in this file, omit if none>
   ```
   A new refinement task always starts at `Status: todo`. Set
   `Assignee: ai` unless step 1's brainstorm surfaced a decision only a human
   can make (e.g. a product trade-off the report didn't resolve), in which
   case use `Assignee: human`.
3. Tell the user it's queued and ready to be picked up by `/run-layer` (or
   `/pick-task` first, if they want to review it before implementation).
