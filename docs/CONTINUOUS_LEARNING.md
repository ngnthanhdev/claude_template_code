# Continuous learning (`.learnings/`)

`CLAUDE.md` `@`-imports this file. `.learnings/` is this template's durable
memory for things that cost real time to discover once and shouldn't cost
time again in a later layer or a later session.

## Why this exists

A layer's `CHECKPOINT.md` captures architecture, decisions, and known issues
for the *next* layer to read on its way in. `.learnings/` is different: it's
not layer-scoped, it's topic-scoped, and it persists across the whole life of
the project. A gotcha about Reanimated 4's New Architecture requirement,
discovered in Layer 2, is just as true in Layer 9 — it belongs in
`.learnings/`, not buried in a layer's checkpoint that nobody rereads once
that layer is done.

## The `/learn` command

Run `/learn` between layers (see `docs/WORKFLOW.md`'s "between layers" step),
after `/checkpoint` and before `/graph`. It reviews what was *actually*
discovered while building the layer just finished — not what the spec
predicted, but what implementation, `code-reviewer`, and `debugger` actually
surfaced — and extracts:

- **Gotchas that cost real time** — a library quirk, a New
  Architecture/Reanimated setup trap, a Prisma migration surprise, a Fastify
  adapter incompatibility.
- **Reusable patterns** — a working shape for a `nestjs-zod` DTO, a
  FlashList perf pattern, an animation recipe that turned out better than the
  canonical one in `mobile-animations`.
- **Recurring review findings** — anything `code-reviewer` or `debugger`
  flagged that's likely to come up again in a future layer.

## Learning file format

One file per topic: `.learnings/<topic>.md` (e.g. `.learnings/reanimated.md`,
`.learnings/prisma-migrations.md`, `.learnings/fastify-adapter.md`). Each
entry inside a topic file is short and skimmable — this is read at the start
of future layers, not consumed as a retrospective:

```markdown
# <Topic>

## YYYY-MM-DD — <one-line summary>

<The concrete trap or pattern, in 2-4 sentences. Enough to avoid repeating
the mistake or to reuse the pattern verbatim, not a full narrative.>

Source: <file or commit where this was learned, if relevant>
```

If a topic file already exists, `/learn` **appends** a new dated entry rather
than rewriting the file — learnings accumulate, they don't get overwritten.

## What doesn't belong here

- Anything already covered by `CHECKPOINT.md` (layer-specific architecture,
  decisions, API contracts) — that's per-layer memory, not durable
  cross-project memory.
- Anything already documented in a skill under `.claude/skills/` — if a
  gotcha is general enough to be a reusable skill fact, it belongs in the
  skill's `SKILL.md`/references, not duplicated in `.learnings/`.
- Product-specific decisions that belong in `docs/PRD.md` or
  `docs/ARCHITECTURE.md`.
