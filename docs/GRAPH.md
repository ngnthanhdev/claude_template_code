# Dependency graphing (`graphify`)

`/graph` runs [`graphify`](https://github.com/) over the monorepo to give a
quick, objective sanity check on the codebase's dependency shape as it grows —
a complement to the `scope-planner`-derived layering in
`docs/SCOPE_BREAKDOWN.md`, not a replacement for it.

This is optional tooling: nothing else in this template requires `graphify`
to be installed, and `/graph` fails gracefully (with install instructions)
if it isn't.

## Install

`graphify` is installed via [`uv`](https://docs.astral.sh/uv/), Astral's
Python package/tool manager:

```bash
# 1. install uv, if you don't already have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. install graphify as a uv tool
uv tool install graphify
```

Verify both are on `PATH`:

```bash
command -v uv && command -v graphify
```

## Running it

From the repo root:

```bash
graphify .
```

Output lands in `graphify-out/` — a generated directory, **gitignored** (see
`.gitignore`), so graph output never gets committed or reviewed as if it were
source. The most useful file inside it is `graphify-out/GRAPH_REPORT.md`.

## Reading `GRAPH_REPORT.md`

When reading the report (yourself, or via `/graph`), look for:

- **Circular dependencies** — anything the report flags as a cycle between
  `apps/*` or `packages/*` modules is a design smell worth fixing before it
  gets worse, not something to route around.
- **High fan-in/fan-out modules** — a file imported from everywhere is a
  `packages/shared` promotion candidate; a file importing everywhere is a
  splitting candidate.
- **Shape mismatch vs. the layer plan** — if the actual dependency graph
  doesn't match what `scope-planner` assumed when it grouped tasks into
  layers (see `docs/SCOPE_BREAKDOWN.md`), that's a signal to feed into the
  next `/scope-breakdown` or `/refine`, not something to silently ignore.

## The `/graph` command

`/graph` (see `.claude/commands/graph.md`) automates the flow above:

1. Confirms `graphify` and `uv` are on `PATH`; if not, tells you how to
   install them and stops rather than guessing.
2. Runs `graphify .` from the repo root.
3. Reads `graphify-out/GRAPH_REPORT.md` and summarizes the three points above
   for you.

Run it between layers, alongside `/checkpoint` and `/learn` (see
`docs/WORKFLOW.md`'s "between layers" step), or any time the codebase feels
like its dependency shape may have drifted from the plan.
