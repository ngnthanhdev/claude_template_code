# Refinement backlog

Status: **empty — no refinement tasks yet**

This file holds bug fixes and feature requests reported *after* the initial
layers have shipped. It is never hand-written directly — `/refine` brainstorms
each reported item first (what's actually being asked, bug vs. feature, what
"done" looks like) and then appends it below using the task block format, so
refinement tasks stay implementable through the same `/run-layer` loop as any
other layer.

Do not add tasks here without going through `/refine` — the brainstorming
step is what keeps a one-line bug report from turning into an underspecified
task that a `task-implementer` can't act on.

---

<!--
Task block format used by /refine when appending below. One block per task —
a level-3 heading with a stable T-xxxxxx id, then a metadata list:

### T-a3f9c1 — <short imperative title>
- **Status:** todo        <!-- todo | ready | in-progress | blocked | review | done -->
- **Assignee:** ai        <!-- ai | human, per what /refine decided -->
- **Files:** <the concrete paths this task is expected to touch>
- **Acceptance:** <checkable definition of done>
- **Skills:** <relevant .claude/skills/* to load, if any>
- **Depends:** <other T-xxxxxx in this file, omit if none>

<optional free-form notes below, e.g. bug-vs-feature context from the brainstorm>

A new task always starts at `Status: todo`, with `Assignee: ai` unless the
brainstorm surfaced a decision only a human can make (`Assignee: human`).

(Delete this comment block's content when the first real task is added; keep
the format itself as the template for every task appended after it.)
-->
