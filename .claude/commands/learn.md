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
