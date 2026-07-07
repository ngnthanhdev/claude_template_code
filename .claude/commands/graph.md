---
description: Run graphify over the monorepo and summarize GRAPH_REPORT.md as a dependency-graph sanity check.
allowed-tools: Bash, Read
---

1. Confirm the `graphify` CLI is on `PATH` (`command -v graphify`) — see
   `docs/GRAPH.md` for install instructions. If missing, tell the user to
   run `uv tool install graphifyy` (package name is `graphifyy`, the CLI
   command it installs is `graphify`) and stop. The graphify skill itself is
   already vendored in this template (`.claude/skills/graphify/`), so only
   the CLI needs installing — nothing to register.
2. Invoke the vendored graphify skill over the repo root:
   ```
   /graphify .
   ```
   Output lands in the gitignored `graphify-out/` directory as three files:
   `graph.html`, `GRAPH_REPORT.md`, `graph.json`.
3. Read `GRAPH_REPORT.md` and summarize for the user:
   - Any circular dependency it flags.
   - Modules with unexpectedly high fan-in/fan-out (candidates for
     splitting or for `packages/shared` promotion).
   - Whether the dependency shape matches what `scope-planner` assumed when
     laying out layers — flag any mismatch as input for the next
     `/scope-breakdown` or `/refine`.

For ad-hoc questions beyond the report (e.g. "what depends on this module?"
or "how are these two files connected?"), graphify also supports
`graphify query "<question>"`, `graphify path A B`, and
`graphify explain "X"` — see `docs/GRAPH.md`.
