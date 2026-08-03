---
description: Extract durable patterns and gotchas discovered in the just-finished layer into .learnings/<topic>.md.
allowed-tools: Read, Write, Grep, Glob
---

Review what was actually discovered while building the layer just
completed — not what the spec said would happen, but what implementation,
review, and debugging actually surfaced:

- Gotchas that cost real time (a library quirk, a New Architecture/Reanimated
  setup trap, a Prisma migration surprise, a Fastify adapter incompatibility).
- Patterns worth reusing verbatim in future layers (a working shape for a
  `nestjs-zod` DTO, a FlashList perf pattern, an animation recipe that
  turned out better than the one in `mobile-animations`).
- Anything `code-reviewer` or `debugger` flagged that's likely to recur.

For each distinct topic, write or append to `.learnings/<topic>.md` with:
a one-line summary, the concrete trap/pattern, and (if relevant) the file or
commit where it was learned. Keep entries short and skimmable — this file
is read at the start of future layers, not as a full retrospective.

Do not duplicate what's already in `.learnings/`; if a topic file exists,
append a new dated entry rather than rewriting it.

## Promote recurring error-memory Patterns

Read `.learnings/error-memory.md` (see `docs/CONTINUOUS_LEARNING.md` for
how it differs from a topic file) and look for any **Pattern** that
recurred — matches another entry, or was applied more than once by
`debugger`'s consult-first step. For each one:

1. Identify the owning skill — the `.claude/skills/<skill>/SKILL.md` whose
   domain the pattern belongs to (e.g. a Reanimated worklet trap belongs to
   `mobile-animations`, a Prisma migration surprise to `database-orm`).
2. Promote it into that skill's gotchas section (or the closest equivalent
   — e.g. `mobile-animations`' "Setup gotchas" — creating a short one if
   the skill has none) as a concise, reusable lesson, not a copy-paste of
   the raw entry.
3. Leave the original `error-memory.md` entry in place — it's an
   append-only chronological log, not something this step deletes from.

Skip this step if no `error-memory.md` entry recurred since the last time
`/learn` ran.
