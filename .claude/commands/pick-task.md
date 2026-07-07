---
description: Show the next unchecked task in the current layer, load its named skills, and restate its acceptance criteria.
---

1. Read `CLAUDE.md`'s "Current Layer" pointer to find the active
   `tasks/layer-N-todo.md`.
2. Find the **first task block with an unchecked acceptance-criteria box**
   (`- [ ]`) in that file — this is "the next task."
3. Show the user:
   - The task's name and its **Files** list.
   - Its **Skills** list.
   - Its full **Acceptance criteria** checklist, verbatim.
4. Load each skill named in the task's **Skills** field now (read the
   relevant `.claude/skills/<name>/SKILL.md`) so the context is ready before
   implementation starts.
5. Do not start implementing yet unless the user explicitly asks you to —
   this command is for orientation. If the user wants to implement it
   directly in this session (rather than via `/run-layer`'s worktree
   fan-out), confirm that's their intent first, since it bypasses the
   isolation `/run-layer` normally provides.
