# External skills — provenance and re-sync

This template vendors a small set of external, community-maintained skills
into `.claude/skills/` alongside the skills authored for this repo (Layers
1–3). Vendoring means the upstream skill content is copied in-tree, at a
pinned commit, with its license preserved — not installed as a live
dependency. This keeps the skill set reproducible (no surprise upstream
changes between sessions) and keeps attribution intact.

5 external skills are vendored. Everything else in `.claude/skills/` is
authored for this template.

## Vendored skills

| Skill | Source repo | Pinned commit | License | Re-sync command |
|---|---|---|---|---|
| `react-native-best-practices` | [software-mansion-labs/skills](https://github.com/software-mansion-labs/skills) | `17642737c22758c808004a3d0e64092cf04ae722` | MIT (declared in README + `.claude-plugin/marketplace.json`; no top-level `LICENSE` file upstream — see the vendored `LICENSE` for the reproduced text and provenance note) | `tmp=$(mktemp -d) && git clone --depth 1 https://github.com/software-mansion-labs/skills "$tmp/swm" && rm -rf .claude/skills/react-native-best-practices && cp -R "$tmp/swm/skills/react-native-best-practices" .claude/skills/react-native-best-practices && ( cd "$tmp/swm" && git rev-parse HEAD ) > .claude/skills/react-native-best-practices/.upstream-commit && rm -rf "$tmp"` |
| `react-native-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `f8a72b9603728bb92a217a879b7e62e43ad76c81` | MIT (declared in README "License" section + the skill's own `SKILL.md` frontmatter; no top-level `LICENSE` file upstream — see the vendored `LICENSE`) | `tmp=$(mktemp -d) && git clone --depth 1 https://github.com/vercel-labs/agent-skills "$tmp/vercel" && rm -rf .claude/skills/react-native-guidelines && cp -R "$tmp/vercel/skills/react-native-skills" .claude/skills/react-native-guidelines && ( cd "$tmp/vercel" && git rev-parse HEAD ) > .claude/skills/react-native-guidelines/.upstream-commit && rm -rf "$tmp"` |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `12b486b22e67f5d887962ef8351c1ac863bfaeb9` | MIT (top-level `LICENSE` file, copied verbatim) | `tmp=$(mktemp -d) && git clone --depth 1 https://github.com/nextlevelbuilder/ui-ux-pro-max-skill "$tmp/uiux" && rm -rf .claude/skills/ui-ux-pro-max && cp -R "$tmp/uiux/.claude/skills/ui-ux-pro-max" .claude/skills/ui-ux-pro-max && ( cd "$tmp/uiux" && git rev-parse HEAD ) > .claude/skills/ui-ux-pro-max/.upstream-commit && rm -rf "$tmp"` |
| `ponytail` | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | `1b2760d384c44e573a9d8c7a729fac616e5c3a76` | MIT (top-level `LICENSE` file, copied verbatim) | `tmp=$(mktemp -d) && git clone --depth 1 https://github.com/DietrichGebert/ponytail "$tmp/ponytail" && rm -rf .claude/skills/ponytail && cp -R "$tmp/ponytail/skills/ponytail" .claude/skills/ponytail && ( cd "$tmp/ponytail" && git rev-parse HEAD ) > .claude/skills/ponytail/.upstream-commit && rm -rf "$tmp"` |
| `graphify` | [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) | `53efaf89b68190d367feb73f9ef5dba15899377c` | MIT (top-level `LICENSE` file, copied verbatim) | `tmp=$(mktemp -d) && git clone --depth 1 https://github.com/Graphify-Labs/graphify "$tmp/graphify" && rm -rf .claude/skills/graphify && mkdir -p .claude/skills/graphify && cp "$tmp/graphify/graphify/skill.md" .claude/skills/graphify/SKILL.md && cp -R "$tmp/graphify/graphify/skills/claude/references" .claude/skills/graphify/references && cp "$tmp/graphify/LICENSE" .claude/skills/graphify/LICENSE && ( cd "$tmp/graphify" && git rev-parse HEAD ) > .claude/skills/graphify/.upstream-commit && rm -rf "$tmp"` |

Each vendored folder contains, in addition to the skill content:

- `SKILL.md` — valid frontmatter (`name:` + `description:`), required for
  Claude Code to discover and load the skill.
- `LICENSE` — the upstream license (copied verbatim where a `LICENSE` file
  existed upstream; reproduced with a provenance note where the repo only
  declared its license in prose — see the per-skill notes below).
- `.upstream-commit` — the exact commit the vendored copy was cut from. Diff
  against a fresh clone at this commit to see if upstream has drifted.

No skill was left install-only — all 5 requested skills carried a
redistribution-permissive license (MIT in every case), so all 5 were vendored
in full rather than recorded as an `npx`/plugin-install pointer. `graphify` is
the one exception to "no live dependency": the skill content itself is fully
vendored, but the skill is only *useful* once its companion CLI is installed
separately (see its per-skill note below) — it's a documentation/knowledge
skill wrapping an external runtime tool, not a self-contained skill like the
other four.

### Per-skill notes

- **`react-native-best-practices`** — upstream folder: `skills/react-native-best-practices/`
  in `software-mansion-labs/skills`. Ships a top-level `SKILL.md` plus a
  `references/` tree (animations, gestures, SVG, JSI, multithreading,
  on-device AI, audio, rich text) — vendored whole. The same upstream repo
  also contains a `skills/radon-mcp/` skill; **that one is intentionally
  excluded** (not selected for this template — Radon IDE/MCP debugging tooling
  is out of scope here).
- **`react-native-guidelines`** — upstream folder: `skills/react-native-skills/`
  in `vercel-labs/agent-skills` (upstream `SKILL.md` frontmatter names it
  `vercel-react-native-skills`). Renamed to `react-native-guidelines` on
  vendor so the skill's `name:` matches this template's folder name and the
  task's requested identifier; the original upstream name is preserved in
  `metadata.upstream_name` in the frontmatter and called out in a note at the
  top of the vendored `SKILL.md` body. Content (the `rules/` directory of
  focused React Native/Expo lint-style rules) is otherwise unmodified.
- **`ui-ux-pro-max`** — upstream ships a pre-built, ready-to-use Claude Code
  skill directory at `.claude/skills/ui-ux-pro-max/` (there's also a
  `src/ui-ux-pro-max/` "source of truth" used by the repo's own build/CLI to
  generate per-platform variants — that one has extra/different CSV rows for
  stacks this template doesn't target, e.g. WPF/UWP/JavaFX, and lacks a
  `SKILL.md`). We vendored the already-built `.claude/skills/ui-ux-pro-max/`
  directory: `SKILL.md`, `data/*.csv` (styles, colors, typography, product
  types, UX guidelines, charts, and 16 per-stack CSVs including
  `react-native.csv`), and `scripts/*.py` (a small BM25 search engine over
  the CSVs). No CLI or database initialization is required — the scripts are
  self-contained stdlib Python 3 that read the local CSVs directly.
- **`ponytail`** — upstream repo ships the same "lazy senior dev" behavior as
  a skill, a slash command, and native integrations for several other coding
  agents (Cursor rules, Cline rules, Windsurf rules, OpenCode plugin, Gemini
  extension, Codex/Devin plugins, etc.), plus a family of sibling skills
  (`ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`,
  `ponytail-review`) not requested here. Only the Claude-Code-relevant piece
  was vendored: `skills/ponytail/SKILL.md`, which is already a complete,
  self-contained Claude Code skill (valid `name:`/`description:`/`license:`
  frontmatter, no external references). The plugin/hook/command scaffolding
  for other agents was left upstream, not vendored.
- **`graphify`** — upstream repo: [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify).
  `SKILL.md` is copied from upstream `graphify/skill.md`; the `references/`
  directory is copied from upstream `graphify/skills/claude/references/`
  (8 files: extraction spec, query, update, exports, hooks, add-watch,
  transcribe, github-and-merge); `LICENSE` is the upstream top-level file,
  copied verbatim. Unlike the other four vendored skills, `graphify` is not
  fully self-contained: the skill content only documents how to *use* the
  tool, and running it for real needs the `graphify` CLI on `PATH`, installed
  separately with `uv tool install graphifyy` (PyPI package name is
  `graphifyy`, double `y`; the command it installs is `graphify`). See
  `docs/GRAPH.md` for the full install/usage flow and `/graphify .` for the
  vendored skill's invocation.

## `ponytail` vs the built-in `/simplify` skill — when to use which

Both push toward less/simpler code, but they act at different points in the
workflow and with different scope:

| | `ponytail` (vendored) | `/simplify` (built-in) |
|---|---|---|
| **When it runs** | Proactively, while code is being written — a standing posture ("ACTIVE EVERY RESPONSE") that shapes the first draft of a solution. | Reactively, after a diff already exists — reviews changed code and applies fixes. |
| **Scope** | Any coding task, any file, before a line is written: "does this need to exist", stdlib-first, fewest files, YAGNI. | The current diff only: reuse, simplification, efficiency, and "altitude" cleanups on code that's already there. |
| **Output style** | Governs the *shape* of the solution itself (ladder of "simplest thing that holds"), plus terse output discipline (code first, ≤3 lines of explanation). | A review pass — reports/applies findings, doesn't dictate how the original code should have been written. |
| **Use when** | Starting a new task, feature, or fix, especially if there's a risk of over-engineering it from the outset, or the user says "keep it simple" / "lazy mode" / "yagni". | After implementation, before committing/PR — a final quality pass on a diff that's otherwise done, independent of whether ponytail was active while writing it. |

In short: reach for `ponytail` to shape how code gets written in the first
place; reach for `/simplify` to clean up code that's already written. They're
complementary, not redundant — running `/simplify` after a ponytail-written
diff is still useful (it catches leftover complexity ponytail's per-response
posture missed), and running ponytail doesn't replace a review pass before
merge.

## Re-syncing a vendored skill

To pick up upstream changes, re-run that skill's re-sync command above, then
diff the result against the currently vendored folder before committing —
upstream authors may rename files, change frontmatter, or (as with
`ui-ux-pro-max`) restructure between a "source" layout and a "built" layout.
After re-syncing, re-run the frontmatter check from Task 24:

```bash
for f in .claude/skills/*/SKILL.md; do
  grep -q "^name:" "$f" && grep -q "^description:" "$f" || echo "BAD: $f"
done
```

Commit format for a re-sync: `chore(skill): re-sync <name> to <short-sha>`.
