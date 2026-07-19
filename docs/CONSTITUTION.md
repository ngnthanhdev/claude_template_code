# Constitution

**Version:** 1.0.0
**Ratified:** _[set on project init]_
**Last amended:** _[set on project init]_

This is the authoritative, versioned set of governing principles for this
project. Every design spec (`docs/specs/`), scope-breakdown plan
(`tasks/layer-*.md`), individual task, and review (`code-reviewer`,
`security-reviewer`, `/analyze`) must comply with the Articles below. They
state **what** this project always upholds and **why** — not **how**; the
how-to lives in `CLAUDE.md`, `docs/WORKFLOW.md`, `docs/SECURITY.md`, and the
skills each Article points to.

**This constitution is the highest authority in this repository.** Where
any skill, subagent definition, slash command, or `CLAUDE.md` guidance
conflicts with an Article here, this document wins — the conflicting
guidance must be reconciled (updated to match, or this document amended)
rather than followed as written. A spec, plan, task, or review that
knowingly departs from an Article must do so through an explicit amendment
(see below), never a silent violation.

## Article I — Spec Before Code

No code, scaffold, or change under `apps/*`/`packages/*` happens before an
approved design document exists in `docs/specs/` (Phase 0) or an approved
task block exists in `tasks/layer-refinement-todo.md` (`/refine`). This is
the hard gate: catching a misunderstanding in a design conversation is
cheap; catching it after implementation is expensive. See `docs/WORKFLOW.md`
and the `brainstorming` skill for how this is enforced.

## Article II — Dependency-Layered Delivery

Work ships in dependency-ordered layers, never a flat backlog. A layer's
tasks are independent of each other and safe to parallelize; a layer may
depend only on layers strictly before it. No layer is "done" because its
code exists — it is done only once every task in it is complete and the
layer's tests are green. No later layer begins before that gate passes. See
`docs/SCOPE_BREAKDOWN.md`.

## Article III — TypeScript Strict, No `any`

All TypeScript in this monorepo runs under `tsconfig.base.json`'s strict
flags. `any` is never an acceptable escape hatch for a type that's
inconvenient to express — narrowing, discriminated unions, and `satisfies`
take its place. See the `typescript-strict` skill.

## Article IV — Tests Accompany Code

No task is complete without a test proving its acceptance criteria, written
as part of that same task — never deferred to a later cleanup pass. A red
or untested change does not advance to the next task.

## Article V — Secrets Never in Code

Every credential, API key, or environment-specific value lives in `.env`
(gitignored) or `packages/shared/config` — never hard-coded, never
committed in plaintext, regardless of how low-risk it looks in the moment.

## Article VI — Security & Privilege Boundaries

The mobile client is untrusted input. Every authorization decision it
implies is re-checked server-side: no lookup trusts a bare client-supplied
id without scoping it to the authenticated user or the resource's owner
(BOLA/IDOR), and no service spreads a client DTO straight into a
persistence write without an explicit allowlist (mass assignment). Backend
work is verified against OWASP ASVS, mobile work against OWASP MASVS. See
`docs/SECURITY.md`.

## Article VII — Shared Contracts Are the Single Source of Truth

`packages/shared`'s zod schemas are the one place a request/response shape
is defined. Both `apps/mobile` and `apps/api` derive their types and
runtime validation from them — a shape is never redefined independently on
either side. See the `shared-contracts` skill.

## Article VIII — Minimal, Scoped Change

YAGNI, KISS, and DRY, in that order. A task touches only the files its
acceptance criteria name; discovering a real need to go wider is a signal
to stop and say so, not to silently expand scope. An abstraction earns its
place by removing real, present complexity — never by pre-building for a
hypothetical future need.

## Article IX — One Commit, One Task

Each commit maps to exactly one task, in conventional commit format
(`feat/fix/test/chore(scope): …`). Commits are never bundled across tasks —
history stays reviewable and revertible one unit of work at a time.

## Article X — Motion With Meaning

Animation earns its place only when it communicates state, direction, or
causality — never as decoration for its own sake. Every animation respects
`useReducedMotion()`. The taste layer (`motion-design-principles`) decides
whether and how much to animate before the recipe layer
(`mobile-animations`) is used to implement anything.

## Amendments

This constitution changes only by deliberate amendment, never by silent
drift:

1. Edit this file directly.
2. Bump **Version** using semver — patch for wording/clarity, minor for a
   new Article or materially expanded scope, major for removing or
   reversing an existing Article.
3. Add a dated entry to the Changelog below stating the rationale.
4. Update **Last amended** to the date of the change.

A spec, plan, task, or review that needs to knowingly break an Article does
not do so silently — it proposes an amendment (steps 1-4 above), surfaces it
to the user for explicit approval, and only proceeds once the amendment is
ratified. Any spec, plan, or review that relies on a specific principle
should cite the Article number it relies on (or amends), so a later reader
can trace the decision back to its governing rule.

## Changelog

- **1.0.0** — _[set on project init]_ — Initial ratification. Distilled from
  `CLAUDE.md`'s hard gate and coding rules, the three discipline gates in
  `docs/WORKFLOW.md`, and `docs/SECURITY.md`.
