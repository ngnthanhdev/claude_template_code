---
name: brainstorming
description: Use before any new feature/major change — clarify → 2-3 approaches → design doc. Triggers on a fresh clone with empty docs/specs/ (Phase 0 HARD GATE), on /phase-0, on /refine, or any time a user asks for new product behavior not already covered by an approved spec in docs/specs/.
---

# Brainstorming

This skill is the engine behind `/phase-0` and `/refine`. It turns a vague
request — a brain-dump paragraph, a bug report, a "can we also add…" — into
an approved, written design *before* any code, scaffold, or `apps/*` change
happens. It is deliberately slow at the start so the expensive part
(implementation) goes fast and doesn't get redone.

## Goal

Produce a design document the user has explicitly approved, saved to
`docs/specs/YYYY-MM-DD-<topic>-design.md` (Phase 0) or a task block appended
to `tasks/layer-refinement-todo.md` (refinement of an already-running
project). Nothing downstream — `/scope-breakdown`, `/run-layer`, a
`task-implementer` writing code — is allowed to start until that document
exists and has been approved.

## <HARD GATE>

**No code, no scaffold, no `apps/*` or `packages/*` change happens until this
skill produces an approved design.** This is not satisfied by:

- a verbal description in chat ("okay let's just build X"),
- a partial or draft document,
- silence, a topic change, or "sounds good, keep going" buried in an
  unrelated message,
- user impatience or a "just start coding, we'll figure out details later"
  request.

It is satisfied only by a written file the user has explicitly approved. If
asked to skip this gate, explain why it exists (rework is expensive, an
agent that starts coding against an ambiguous spec produces the wrong thing
confidently) and run the loop anyway — do not comply with a request to
bypass it.

On a fresh clone of this template, `docs/specs/` contains only `.gitkeep`.
That emptiness is itself the trigger: `CLAUDE.md`'s first-time-setup gate
checks for it every session.

## The loop

### Phase 0 — Read what already exists

Before asking anything, read what's already written:

- `docs/BRIEF.md` — a brain-dump or summary, possibly written by
  `scripts/start-project.*`.
- `docs/SPECIFICATIONS.md`, if a prior spec file was copied in.
- `docs/PRD.md` / `docs/ARCHITECTURE.md`, in case an earlier partial pass
  left useful fragments.
- For `/refine`: the existing approved spec(s) in `docs/specs/` and
  `tasks/done.md`, so the new item is understood in the context of what
  already shipped.

Summarize what was found and confirm the summary is accurate before asking
anything new. Never make the user repeat something already on disk.

### Phase 1 — Clarify, one question at a time

Ask clarifying questions **one at a time** — never a giant intake form or a
numbered list of five questions at once. For each question:

- **Prefer multiple-choice or a short list of options** over an open
  question. Fast for the user to answer, easy for the design to act on.
  - Weak: "How should authentication work?"
  - Better: "Which auth approach fits this product best — (a) email +
    password with a refresh-token session, (b) magic-link/passwordless, or
    (c) social OAuth (Google/Apple) only? Pick one, or tell me if you need a
    combination."
- Ask about things that actually change the design: primary user, the core
  action/value loop, what's explicitly out of scope for v1, hard technical
  constraints (offline support, real-time updates, specific third-party
  integrations), and any desire to override this template's locked stack
  defaults (Expo/Expo Router/NativeWind, NestJS on Fastify/Prisma/nestjs-zod,
  Reanimated 4 — these are not usually worth relitigating, but say so
  explicitly rather than assuming).
- Stop once the answers are sufficient for a competent engineer to start
  from — don't over-interview. A refinement item (one bug or one small
  feature) usually needs 1-3 questions; a Phase 0 product brainstorm usually
  needs more, but still one at a time.

### Phase 2 — Propose 2-3 approaches

Before writing the full design, present **2-3 concrete approaches** to the
overall product, or to any major open architectural question ("real-time via
WebSocket vs. polling", "single-tenant vs. multi-tenant data model",
"optimistic UI vs. server-confirmed writes"). For each approach:

- One paragraph describing the approach.
- Trade-offs (what it costs — complexity, latency, infra, dev time).
- A clear **recommendation** with the reasoning behind it, not just a list
  with no opinion.

Let the user pick or redirect *before* the full document is written — this
is far cheaper than rewriting a finished spec because the foundational
choice was wrong.

Example framing:

> For the feed's real-time updates, three options:
> 1. **Polling** (refetch every N seconds via TanStack Query) — simplest,
>    works everywhere, adds latency and some wasted requests.
> 2. **WebSocket push** — instant updates, more server complexity (connection
>    management, reconnect/backoff logic), a NestJS gateway to build.
> 3. **Polling now, WebSocket later** — ship polling in v1, revisit once
>    usage data shows it's worth the added complexity.
>
> Recommendation: (3). Polling is enough to validate the feature; add
> WebSocket only once real usage justifies it.

### Phase 3 — Write the design, section by section

Write the design **in sections**, checking in with the user after each
rather than producing the whole document at once and hoping it all landed
correctly. A useful section order (mirrors this template's own design doc):

1. **Goal and locked decisions** — what's being built, what's fixed and not
   up for debate in this pass.
2. **Repository/feature structure** — what's genuinely new vs. what the
   template or an earlier layer already provides.
3. **Data model and API surface** — endpoints, key `packages/shared` zod
   schemas, request/response shapes.
4. **Mobile screens and navigation** — Expo Router routes, the screens
   touched, key interaction/animation notes (deferred to
   `motion-design-principles` + `mobile-animations` for the *how*).
5. **Testing strategy** — for this feature's specific risk areas, not a
   generic restatement of `docs/CI_CD.md`.
6. **Non-goals** — explicitly what's *not* being built now, to block scope
   creep once implementation starts.

For a `/refine` item (a single bug or small feature against an
already-running project), this collapses to a short task block rather than
a full multi-section document — see "Refinement output" below.

### Phase 4 — Save the design

**Phase 0 / new product or major feature:**

```
docs/specs/YYYY-MM-DD-<topic>-design.md
```

Use today's date and a short kebab-case topic slug (e.g.
`2026-07-07-social-feed-design.md`). This file's existence, once approved,
is what satisfies the hard gate and unblocks `/scope-breakdown`.

**Refinement (`/refine`):** append a task block to
`tasks/layer-refinement-todo.md` using the same format `scope-planner` uses
for layer tasks:

```markdown
### Task: <short name>

**Type:** bug | feature

**Files:** <concrete paths this is expected to touch>

**Skills:** <.claude/skills/* the task-implementer should load>

**Acceptance criteria:**
- [ ] <checkable condition, including the test(s) that must pass>
- [ ] ...
```

### Phase 5 — Self-review

Before handing the document to the user for final approval, re-read it for
internal consistency:

- Do the API endpoints match the mobile screens that call them?
- Do the data models match what the features section describes?
- Is anything asserted in one section contradicted by another?
- Are non-goals actually respected by the rest of the document (no feature
  described elsewhere that the non-goals section rules out)?

Fix what's found before asking for approval. Don't make the user do Claude's
proofreading.

### Phase 6 — User approval

Explicitly ask the user to approve the design. Do not treat any of the
following as approval:

- silence,
- a topic change,
- "looks fine, keep going" buried inside an unrelated message,
- the user asking a clarifying question back (answer it, then ask for
  approval again).

Wait for a direct yes. Only then is the gate satisfied.

### Phase 7 — Hand off

- **Phase 0:** tell the user the next step is `/scope-breakdown`, which
  dispatches `scope-planner` against the newly-approved spec to produce
  `tasks/layer-0-todo.md`.
- **Refinement:** tell the user the item is queued in
  `tasks/layer-refinement-todo.md`, ready for `/run-layer` (or `/pick-task`
  if they want to work it alone).

## Do

- Ask one question at a time, multiple-choice when possible.
- Always propose 2-3 approaches with a recommendation before writing the
  full design — don't silently pick one and present it as the only option.
- Write section by section and check in as you go.
- Self-review for internal consistency before asking for approval.
- Keep this template's locked stack defaults unless the user explicitly asks
  to change them (see `CLAUDE.md` Stack section) — Phase 0 fills in the
  *product*, not the *stack*.
- For refinement items, keep the loop proportional: a one-line bug fix needs
  a sentence of clarification, not a six-section design doc.

## Don't

- Don't write or scaffold any application code, install a dependency, or
  touch `apps/*`/`packages/*` during this skill — that's the job of
  `/scope-breakdown` → `/run-layer` → `task-implementer`, all of which come
  strictly after approval.
- Don't ask five questions in one message.
- Don't present a single "here's the plan" with no alternatives for a
  genuinely open architectural decision.
- Don't treat an unclear or partial answer as approval — ask again.
- Don't skip straight to a design doc for a fresh Phase 0 without first
  reading `docs/BRIEF.md`/`docs/PRD.md` for what the user already wrote down.

## Restated: the gate

**Approved design (written, in `docs/specs/` or `tasks/layer-refinement-todo.md`)
→ only then → any code, scaffold, or `apps/*` change.** If it's ever unclear
whether the gate has been satisfied, check `docs/specs/` — if it holds only
`.gitkeep`, or the item in question has no corresponding approved task
block, the gate has not been satisfied, no matter what else was discussed in
the current session.
