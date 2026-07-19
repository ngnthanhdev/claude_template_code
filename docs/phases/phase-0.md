# Phase 0 — Brainstorming and design

This is the detailed step-by-step Claude follows when `/phase-0` runs (or when
the `CLAUDE.md` hard gate triggers it automatically on a fresh clone). It is
the same loop the `brainstorming` skill implements — this document is the
narrative version for humans reading the template; the skill is the version
Claude loads at runtime.

## <HARD-GATE>

No code, no scaffold, no `apps/*` change happens until this phase produces an
approved design document in `docs/specs/`. A fresh clone's `docs/specs/`
contains only `.gitkeep` — that emptiness is what triggers this phase. The
gate is not satisfied by a partial answer, a verbal description in chat, or a
promise to "write it up later." It is satisfied only by a written, approved
file in `docs/specs/`.

## Step 1 — Read what already exists

Before asking the user anything, read:

- `docs/CONSTITUTION.md` — the governing principles the design you're about
  to write must comply with.
- `docs/BRIEF.md` — whatever brain-dump or summary the user (or
  `scripts/start-project.*`) already put there.
- `docs/SPECIFICATIONS.md`, if `scripts/start-project.*` copied one in from an
  existing spec file.
- `docs/PRD.md` and `docs/ARCHITECTURE.md`, in case a prior partial pass left
  useful fragments.

Don't ask the user to repeat anything already written down. Summarize what
was found and confirm the summary is still accurate before moving on.

## Step 2 — Clarify, one question at a time

Ask clarifying questions **one at a time**, not as a giant intake form. For
each question:

- Prefer multiple-choice or a short list of options over an open-ended
  question — it's faster for the user to answer and easier for Claude to act on.
- Ask about the things that actually change the design: who the primary user
  is, what the core action/value loop is, what's explicitly out of scope for
  v1, any hard technical constraints (offline support, real-time updates,
  specific integrations), and anything about the stack the user wants to
  override from this template's locked defaults (Expo/NativeWind, NestJS on
  Fastify/Prisma/nestjs-zod, Reanimated 4).
- Stop asking once the answers are sufficient to write a design a competent
  engineer could start from — don't over-interview.

## Step 3 — Propose 2–3 approaches

Before writing the full design, present **2–3 concrete approaches** to the
overall product or to any major open architectural question (e.g., "real-time
via WebSocket vs. polling," "single vs. multi-tenant data model"). For each
approach, give a one-paragraph description, the trade-offs, and a
recommendation. Let the user pick or redirect before the design doc is fully
written — this is much cheaper than rewriting a finished document.

## Step 4 — Write the design, section by section

Write the design **in sections**, checking in after each one rather than
producing the whole document at once and hoping it's all correct. A useful
section order:

1. Goal and locked decisions (mirroring this template's own design doc shape).
2. Repository/feature structure (what's genuinely new vs. what the template
   already provides).
3. Data model and API surface (endpoints, key schemas).
4. Mobile screens and navigation.
5. Testing strategy for this project's specific risk areas.
6. Non-goals — explicitly what's *not* being built in v1, to prevent scope
   creep once implementation starts.

## Step 5 — Save the design

Write the approved content to:

```
docs/specs/YYYY-MM-DD-<topic>-design.md
```

using today's date and a short kebab-case topic slug. This is the file whose
mere existence (with user approval) satisfies the hard gate.

## Step 6 — Self-review

Before handing the document to the user for final approval, re-read it for
internal consistency: do the API endpoints match the mobile screens that call
them? Do the data models match what the features section describes? Is
anything asserted in one section contradicted in another? Fix what's found
before asking for approval — don't make the user do Claude's proofreading.

Also check the design against `docs/CONSTITUTION.md`. If a requirement in
this design genuinely needs to break a governing Article, that is not a
silent violation — propose a constitution amendment (bump `Version`, add a
dated Changelog entry with rationale) and surface it to the user for
explicit approval alongside the design itself.

## Step 7 — User approval

Explicitly ask the user to approve the design before moving on. Do not treat
silence, a topic change, or "looks fine, keep going" buried in an unrelated
message as approval — ask directly, and wait for a direct yes.

## Step 8 — Hand off to scope breakdown

Once approved, the hard gate is satisfied. The next step is `/scope-breakdown`,
which dispatches `scope-planner` against the newly-approved spec to produce
`tasks/layer-0-todo.md`. See `docs/SCOPE_BREAKDOWN.md` for how that works.

## Restated: the gate

**Approved design in `docs/specs/` → only then → any code, scaffold, or
`apps/*` change.** Every other phase in `docs/WORKFLOW.md` assumes this gate
already passed. If it's ever unclear whether it has, check `docs/specs/` — if
it holds only `.gitkeep`, the gate has not been satisfied, no matter what else
has been discussed in the current session.
