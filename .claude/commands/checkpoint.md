---
description: Regenerate CHECKPOINT.md via the checkpoint script, fill in its decisions/API-contracts/known-issues sections, and prep the session for context compaction.
allowed-tools: Bash, Read, Edit
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
3. Tell the user `CHECKPOINT.md` is ready and this is a good point to
   **compact context** or start a fresh session for the next layer — per
   `CLAUDE.md`'s token-discipline rule (new session per big task).
