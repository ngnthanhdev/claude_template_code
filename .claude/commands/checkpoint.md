---
description: End-of-layer pass — regenerate CHECKPOINT.md, extract durable learnings into .learnings/, and prep the session for context compaction. (Absorbs the old /learn command.)
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

1. Run the checkpoint generator:
   ```bash
   npm run checkpoint
   ```
   This refreshes `CHECKPOINT.md` with the recent `git log` and the current
   `tasks/done.md` contents, leaving the manual sections marked
   `<!-- fill: ... -->`.
2. Fill in the manual sections yourself, from what actually happened in
   this session/layer (do not leave the `<!-- fill: ... -->` markers in the
   committed file):
   - **Architecture** — a short text diagram of what now exists.
   - **Key decisions (WHY)** — decisions made and their rationale, not just
     what was built.
   - **API contracts (signatures only)** — the `packages/shared` zod
     contract shapes now in play, signatures only (not full schema bodies).
   - **Known issues & gotchas** — anything the next layer must avoid
     repeating (a trap discovered, a workaround applied).
3. **Extract learnings** (the old `/learn` step, now part of this pass).
   Review what building the layer actually surfaced — not what the spec
   predicted:
   - Gotchas that cost real time (a library quirk, a Reanimated/New-Arch
     setup trap, a Prisma migration surprise, a Fastify incompatibility).
   - Patterns worth reusing verbatim in future layers.
   - Anything `reviewer` or `debugger` flagged that's likely to recur.
   For each distinct topic, write or append to `.learnings/<topic>.md`:
   one-line summary, the concrete trap/pattern, and where it was learned.
   Keep entries short and skimmable; append dated entries to existing
   topic files rather than rewriting them.
4. **Promote recurring error-memory patterns.** Scan
   `.learnings/error-memory.md` (see `docs/CONTINUOUS_LEARNING.md`) for any
   **Pattern** that recurred — matched another entry, or was applied more
   than once by `debugger`'s consult-first step. Promote each into the
   owning skill's gotchas section (e.g. a Reanimated worklet trap into
   `animations`, a Prisma surprise into `backend-patterns`) as a concise
   reusable lesson. Leave the original entry in place — the log is
   append-only. Skip if nothing recurred.
5. Tell the user `CHECKPOINT.md` and `.learnings/` are updated and this is
   a good point to **compact context** or start a fresh session for the
   next layer — per `CLAUDE.md`'s token-discipline rule.
