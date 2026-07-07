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
Task block format used by /refine when appending below. One block per task:

### [ ] Task: <short imperative title>

**Files:** <the concrete paths this task is expected to touch>

**Skills:** <relevant .claude/skills/* to load, if any>

**Acceptance criteria:**
- <checkable condition>
- <checkable condition>

**Depends on:** <other task in this file, or "none">

(Delete this comment block's content when the first real task is added; keep
the format itself as the template for every task appended after it.)
-->
