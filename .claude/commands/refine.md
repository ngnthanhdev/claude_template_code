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
   format `scope-planner` uses for any other layer task:
   ```markdown
   ### Task: <short name>

   **Files:** <concrete paths expected to change>

   **Skills:** <.claude/skills/* to load>

   **Acceptance criteria:**
   - [ ] <checkable condition>
   ```
3. Tell the user it's queued and ready to be picked up by `/run-layer` (or
   `/pick-task` first, if they want to review it before implementation).
