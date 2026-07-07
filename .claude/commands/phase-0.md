---
description: Enter Plan Mode and run the brainstorming skill to produce an approved design doc in docs/specs/ before any code is written (HARD GATE).
---

Enter **Plan Mode** for this session before doing anything else.

Then invoke the `brainstorming` skill and follow it exactly:

1. Read whatever the user has already written: `docs/BRIEF.md`, an existing
   `docs/PRD.md` / `docs/SPECIFICATIONS.md`, or a brain-dump paragraph the
   user pastes in.
2. Ask clarifying questions **one at a time**, preferring multiple-choice
   framing so answers are fast.
3. Propose **2–3 concrete approaches** with a recommendation and trade-offs
   before settling on one — don't jump straight to a single design.
4. Write the agreed design **section by section**, checking in with the
   user as you go rather than producing one giant document at the end.
5. Save the finished design to `docs/specs/YYYY-MM-DD-<topic>-design.md`.
6. Self-review the document for internal consistency (naming, scope,
   contradictions between sections) before handing it to the user.
7. Wait for **explicit user approval**. Do not scaffold, install a
   dependency, or write any application code in this command.

## HARD GATE reminder

`docs/specs/` is currently empty (only `.gitkeep`) or does not yet contain an
approved design for what's being asked. Per `CLAUDE.md`'s first-time-setup
gate: **no code, app, or scaffold work happens until this phase produces an
approved spec.** If the user pushes back and asks to skip straight to code,
explain the gate and continue with Phase 0 anyway rather than complying.

Once the user approves, tell them the next step is `/scope-breakdown`.
