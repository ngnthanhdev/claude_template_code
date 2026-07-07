---
description: Run graphify over the monorepo and summarize GRAPH_REPORT.md as a dependency-graph sanity check.
allowed-tools: Bash, Read
---

1. Confirm `graphify` and `uv` are available (`command -v graphify`,
   `command -v uv`) — see `docs/GRAPH.md` for install instructions. If
   missing, tell the user how to install them and stop.
2. Run it over the repo root:
   ```bash
   graphify .
   ```
   Output lands in the gitignored `graphify-out/` directory, including
   `GRAPH_REPORT.md`.
3. Read `GRAPH_REPORT.md` and summarize for the user:
   - Any circular dependency it flags.
   - Modules with unexpectedly high fan-in/fan-out (candidates for
     splitting or for `packages/shared` promotion).
   - Whether the dependency shape matches what `scope-planner` assumed when
     laying out layers — flag any mismatch as input for the next
     `/scope-breakdown` or `/refine`.
