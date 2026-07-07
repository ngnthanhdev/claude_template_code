# Dependency graphing (`graphify`)

`/graph` runs [`graphify`](https://github.com/Graphify-Labs/graphify) over the
monorepo to give a quick, objective sanity check on the codebase's dependency
shape as it grows — a complement to the `scope-planner`-derived layering in
`docs/SCOPE_BREAKDOWN.md`, not a replacement for it.

This is optional tooling: nothing else in this template requires `graphify`
to be installed, and `/graph` fails gracefully (with install instructions)
if it isn't.

## The skill is already vendored — you only need the CLI

This template already vendors graphify's Claude Code skill at
`.claude/skills/graphify/` (pinned commit, see `docs/EXTERNAL_SKILLS.md`), so
you do **not** need to run upstream's `graphify install` step to register the
skill. The only thing you need locally is the `graphify` CLI binary itself,
since that's what actually walks the repo and produces the graph output.

## Install

The CLI is distributed on PyPI as **`graphifyy`** (double `y`) but installs a
command named **`graphify`** — don't confuse the two. Install it via
[`uv`](https://docs.astral.sh/uv/), Astral's Python package/tool manager:

```bash
# 1. install uv, if you don't already have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. install the graphify CLI (package name is graphifyy, command is graphify)
uv tool install graphifyy
```

`pipx install graphifyy` works the same way if you use `pipx` instead of `uv`.

Verify both are on `PATH`:

```bash
command -v uv && command -v graphify
```

If `graphify` isn't found right after installing, your shell's `PATH` likely
hasn't picked up `uv`'s tool bin directory yet — run `uv tool update-shell`
and open a new shell.

Prefer not to install anything permanently? Run it ad hoc instead:

```bash
uvx --from graphifyy graphify .
```

## Running it

From the repo root, either invoke the vendored skill from an assistant
session:

```
/graphify .
```

or run the CLI directly from a terminal:

```bash
graphify .
```

Both produce the same output. Other useful invocations the CLI (and the
vendored skill) support:

```bash
graphify query "<question>"     # ask an ad-hoc question over the existing graph
graphify path A B                # find the relationship path between two nodes
graphify explain "X"             # explain what a node/concept is and how it connects
```

Output lands in `graphify-out/` — a generated directory, **gitignored** (see
`.gitignore`), so graph output never gets committed or reviewed as if it were
source. It contains three files:

- `graph.html` — an interactive visualization you can open in a browser.
- `GRAPH_REPORT.md` — the plain-language summary (see below).
- `graph.json` — the raw, GraphRAG-ready graph data.

Optionally, run `graphify hook install` once to add a post-commit hook that
auto-rebuilds the graph after every commit, so `graphify-out/` never goes
stale between `/graph` runs.

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

1. Confirms the `graphify` CLI is on `PATH`; if not, tells you how to
   install it (`uv tool install graphifyy`) and stops rather than guessing.
2. Invokes the vendored graphify skill over the repo root (`/graphify .`).
3. Reads `graphify-out/GRAPH_REPORT.md` and summarizes the three points above
   for you.

Run it between layers, alongside `/checkpoint` and `/learn` (see
`docs/WORKFLOW.md`'s "between layers" step), or any time the codebase feels
like its dependency shape may have drifted from the plan.
