# Build Claude Code Full‑Stack Template — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native‑first Claude Code starter template for an Expo mobile + NestJS API monorepo, driving a Brainstorm→Design→Layer→Implement→Test→Checkpoint→Refine workflow, tuned for Reanimated‑v4 smooth animations.

**Architecture:** The deliverable is mostly *content* (markdown skills/agents/commands/docs) plus monorepo *config*. `apps/*` and `packages/*` ship empty (`.gitkeep`) — a real project scaffolds them in its own Layer 0. Verification = config validity (pnpm/turbo/tsc/JSON parse, bash syntax) and skill/agent/command frontmatter validity, since the template has no runtime app code of its own.

**Tech Stack:** pnpm workspaces + Turborepo · TypeScript strict · Expo/Expo Router/NativeWind · React Native Reanimated 4 + Gesture Handler + Skia · NestJS (Fastify adapter) + Prisma + nestjs-zod · Maestro · GitHub Actions + EAS · Claude Code skills/subagents/commands/hooks.

**Source of truth:** `docs/build/2026-07-07-claude-fullstack-template-design.md` (this repo, moved from `docs/specs/` in Task 1).

**Convention for this plan:** Because these files have no unit tests, each task's "verify" step is a concrete shell command with expected output. Config files ship complete content in the plan. Prose files (skills/docs) ship a *content spec* — exact path, required frontmatter, mandatory sections, and must‑include facts — which the implementer expands into final prose (drawing on the vendored SWM/Vercel skills and the design spec). Commit after every task with the shown message.

---

## File Structure Map

```
CLAUDE.md                         # L1  root source of truth (lean, @-imports)
README.md                         # L0  human-facing intro
package.json                      # L0  workspace root
pnpm-workspace.yaml .npmrc        # L0
turbo.json                        # L0
tsconfig.base.json                # L0
.gitignore .env.example eas.json  # L0
apps/mobile/.gitkeep              # L0  (empty; scaffolded per-project)
apps/api/.gitkeep                 # L0
packages/shared/.gitkeep          # L0
.claude/
  settings.json                   # L2
  settings.local.json.example     # L2
  hooks/{block-build-output,auto-format,suggest-commit}.sh   # L2
  agents/{scope-planner,task-implementer,code-reviewer,test-writer,debugger}.md  # L2
  commands/{phase-0,scope-breakdown,pick-task,run-layer,next-layer,checkpoint,learn,graph,refine}.md  # L2
  skills/
    brainstorming/ SKILL.md                                  # L3
    mobile-app-agent/ expo-router-nativewind/ ...            # L3 (8 mobile)
    mobile-animations/ motion-design-principles/             # L3
    api-design/ nestjs-backend/ database-orm/                # L3 (5 backend)
    backend-auth-security/ backend-testing/
    shared-contracts/ typescript-strict/ git-workflow/       # L3 (3 shared)
    react-native-best-practices/ react-native-guidelines/    # L4 vendored
    ui-ux-pro-max/ ponytail/                                 # L4 vendored
docs/
  BRIEF.md PRD.md ARCHITECTURE.md                            # L1 end-user placeholders
  WORKFLOW.md SCOPE_BREAKDOWN.md                             # L1
  CI_CD.md CONTINUOUS_LEARNING.md GRAPH.md EXTERNAL_SKILLS.md # L5/L4
  phases/phase-0.md                                          # L1
  specs/.gitkeep                                             # L1 (empty for end users)
  build/…                                                    # meta (this plan + spec)
tasks/{layer-0-todo,layer-refinement-todo,done}.md           # L1
.learnings/.gitkeep                                          # L5
CHECKPOINT.md                                                # L5 template
scripts/{start-project.sh,.ps1,.bat,checkpoint.js}           # L5
.github/workflows/{ci,eas-preview,eas-production,api-deploy}.yml  # L5
```

---

## Layer 0 — Repo foundation & monorepo skeleton

### Task 1: Relocate build-meta so end-user Phase 0 works

**Files:**
- Move: `docs/specs/2026-07-07-claude-fullstack-template-design.md` → `docs/build/2026-07-07-claude-fullstack-template-design.md`
- Create: `docs/specs/.gitkeep` (empty), `docs/build/.gitkeep`

- [ ] **Step 1: Move the spec and keep specs/ empty**
```bash
cd /Users/nguyenthanh/Documents/claude_template_code
git mv docs/specs/2026-07-07-claude-fullstack-template-design.md docs/build/2026-07-07-claude-fullstack-template-design.md
touch docs/specs/.gitkeep docs/build/.gitkeep
```
- [ ] **Step 2: Verify specs/ holds only .gitkeep**
```bash
ls -A docs/specs        # expect: .gitkeep
```
Expected: only `.gitkeep` (so a fresh clone triggers Phase 0).
- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "chore: move build spec to docs/build, keep docs/specs empty for end users"
```

### Task 2: Workspace root — package.json, pnpm-workspace.yaml, .npmrc

**Files:** Create `package.json`, `pnpm-workspace.yaml`, `.npmrc`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```
- [ ] **Step 2: Create `.npmrc`**
```
auto-install-peers=true
node-linker=hoisted
```
(Expo/React Native need a hoisted node_modules layout.)
- [ ] **Step 3: Create `package.json`**
```json
{
  "name": "claude-template-code",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20" },
  "scripts": {
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "build": "turbo run build",
    "checkpoint": "node scripts/checkpoint.js"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.6.0",
    "prettier": "^3.3.0"
  }
}
```
- [ ] **Step 4: Verify install resolves the workspace**
```bash
pnpm install
```
Expected: completes without error; creates `pnpm-lock.yaml` and `node_modules/`.
- [ ] **Step 5: Commit**
```bash
git add package.json pnpm-workspace.yaml .npmrc pnpm-lock.yaml
git commit -m "chore: pnpm workspace root + scripts"
```

### Task 3: Turborepo pipeline — turbo.json

**Files:** Create `turbo.json`

- [ ] **Step 1: Create `turbo.json`**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".expo/**"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] }
  }
}
```
- [ ] **Step 2: Verify turbo parses config**
```bash
pnpm turbo run lint --dry=json > /dev/null && echo OK
```
Expected: `OK` (no packages yet, but config is valid).
- [ ] **Step 3: Commit**
```bash
git add turbo.json && git commit -m "chore: turborepo pipeline config"
```

### Task 4: Base TypeScript config — tsconfig.base.json

**Files:** Create `tsconfig.base.json`

- [ ] **Step 1: Create `tsconfig.base.json`**
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "baseUrl": ".",
    "paths": { "@shared/*": ["packages/shared/src/*"] }
  }
}
```
- [ ] **Step 2: Verify JSON validity**
```bash
node -e "JSON.parse(require('fs').readFileSync('tsconfig.base.json','utf8')); console.log('valid')"
```
Expected: `valid`.
- [ ] **Step 3: Commit**
```bash
git add tsconfig.base.json && git commit -m "chore: strict base tsconfig with @shared alias"
```

### Task 5: Ignore, env, EAS templates

**Files:** Create `.gitignore`, `.env.example`, `eas.json`

- [ ] **Step 1: Create `.gitignore`**
```gitignore
node_modules/
.pnpm-store/
dist/
.turbo/
coverage/
# expo / rn
.expo/
*.orig.*
web-build/
ios/
android/
# graphify output (generated)
graphify-out/
# env & secrets
.env
.env.*.local
.claude/settings.local.json
# os
.DS_Store
```
(Note: keep `.learnings/` tracked — do NOT ignore it.)
- [ ] **Step 2: Create `.env.example`**
```
# API
DATABASE_URL="postgresql://user:pass@localhost:5432/app?schema=public"
JWT_SECRET="change-me"
API_PORT=3000
# Mobile
EXPO_PUBLIC_API_URL="http://localhost:3000"
# EAS
EAS_PROJECT_ID=""
```
- [ ] **Step 3: Create `eas.json`**
```json
{
  "cli": { "version": ">= 12.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "channel": "preview" },
    "production": { "channel": "production", "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```
- [ ] **Step 4: Verify JSON files parse**
```bash
node -e "JSON.parse(require('fs').readFileSync('eas.json','utf8'));console.log('eas ok')"
```
Expected: `eas ok`.
- [ ] **Step 5: Commit**
```bash
git add .gitignore .env.example eas.json && git commit -m "chore: gitignore, env example, eas profiles"
```

### Task 6: Empty workspace placeholders

**Files:** Create `apps/mobile/.gitkeep`, `apps/api/.gitkeep`, `packages/shared/.gitkeep`

- [ ] **Step 1: Create placeholders**
```bash
mkdir -p apps/mobile apps/api packages/shared
touch apps/mobile/.gitkeep apps/api/.gitkeep packages/shared/.gitkeep
```
- [ ] **Step 2: Verify**
```bash
find apps packages -name .gitkeep    # expect 3 lines
```
- [ ] **Step 3: Commit**
```bash
git add -A && git commit -m "chore: empty apps/* and packages/shared placeholders (scaffolded in project Layer 0)"
```

### Task 7: README.md (human-facing)

**Files:** Create `README.md`

**Content spec** — sections (English): title + one‑line pitch; "What this is" (native‑first Claude Code template for Expo + NestJS monorepo); Requirements (Claude Code, Node ≥20, pnpm, git, watchman/Xcode/Android for mobile, optional graphify+uv); Quick start (`scripts/start-project.sh` → open in Claude Code → Phase 0 auto‑starts); Repo structure tree (from spec §3); Workflow summary (Phase 0 → scope → layers → checkpoint → refine, from spec §6); Slash commands table (spec §4.2); Skills table (authored + vendored, spec §5); Animation note (Reanimated v4 + New Arch + `motion-design-principles`); CI/CD summary (spec §8); License MIT. Must‑include facts: `apps/*` are empty until a project's Layer 0; HARD GATE — no code before approved spec.

- [ ] **Step 1: Write `README.md`** per the content spec above.
- [ ] **Step 2: Verify** markdown has no unresolved `[TODO]`:
```bash
! grep -n "TODO\|TBD" README.md && echo clean
```
Expected: `clean`.
- [ ] **Step 3: Commit**
```bash
git add README.md && git commit -m "docs: human-facing README"
```

---

## Layer 1 — CLAUDE.md + workflow docs + tasks

### Task 8: CLAUDE.md (root source of truth)

**Files:** Create `CLAUDE.md`

**Content spec** (English, lean — heavy detail lives in @-imported docs):
- Top: "Source of truth. Claude reads this first every session."
- **FIRST-TIME SETUP block** with `<HARD-GATE>`: if `docs/specs/` has no design doc → run `/phase-0` before any code/scaffold. Prerequisites (Node ≥20, pnpm, optional graphify+uv).
- **@-imports:** `@docs/WORKFLOW.md`, `@docs/SCOPE_BREAKDOWN.md`, `@docs/CI_CD.md`, `@docs/CONTINUOUS_LEARNING.md`.
- **Stack** section (fill‑after‑Phase‑0 placeholder + the locked defaults: Expo/Expo Router/NativeWind; NestJS+Fastify+Prisma+nestjs-zod; Reanimated 4).
- **Folder structure** (monorepo tree).
- **Coding rules:** TS strict no `any`; test right after each task; 1 commit = 1 task (`feat/fix/test/chore(scope): …`); scope control; secrets in `.env`/`packages/shared/config` only; brainstorm before new feature.
- **Slash commands** quick list (spec §4.2).
- **Subagents** quick list (spec §4.1).
- **Model strategy:** Opus for Phase 0 + code-review; Sonnet for implementation; `/model` to switch (no third‑party IDs).
- **Current Layer / Current Task** pointers (Layer 0 — Foundation, not started; see `tasks/layer-0-todo.md`).
- **Token discipline:** new session per big task; never run heavy builds in-session (enforced by hook); read files with offset/limit.

- [ ] **Step 1: Write `CLAUDE.md`** per spec.
- [ ] **Step 2: Verify @-import targets will exist** (created in later tasks) — list them:
```bash
grep -o "@docs/[A-Za-z_]*\.md" CLAUDE.md
```
Expected: WORKFLOW, SCOPE_BREAKDOWN, CI_CD, CONTINUOUS_LEARNING.
- [ ] **Step 3: Commit**
```bash
git add CLAUDE.md && git commit -m "docs: CLAUDE.md root source of truth"
```

### Task 9: docs/WORKFLOW.md

**Content spec:** Full lifecycle from spec §6 as prose + the ASCII flow; the three discipline gates; how commands/subagents map to each phase; per‑layer loop detail (run-layer → worktree task-implementer → merge → code-reviewer → test-writer → next-layer gate); between-layers checkpoint/learn/graph.

- [ ] **Step 1: Write `docs/WORKFLOW.md`.**
- [ ] **Step 2: Commit** `git add docs/WORKFLOW.md && git commit -m "docs: end-to-end workflow guide"`

### Task 10: docs/SCOPE_BREAKDOWN.md

**Content spec:** Dependency‑driven layering methodology (Layer 0 foundation = scaffold Expo+API+shared; Layer N depends on 0..N-1; tasks in a layer run parallel; no advancing until tests pass). How `scope-planner` produces `tasks/layer-*.md`. Example layer breakdown for a typical Expo+NestJS product.

- [ ] **Step 1: Write `docs/SCOPE_BREAKDOWN.md`.**
- [ ] **Step 2: Commit** `git add docs/SCOPE_BREAKDOWN.md && git commit -m "docs: dependency-driven scope breakdown"`

### Task 11: docs/phases/phase-0.md

**Content spec:** Detailed Phase 0 brainstorming instructions (mirror the template's own gate): read BRIEF/SPEC → clarify one question at a time → 2‑3 approaches → present design per section → write `docs/specs/YYYY-MM-DD-<topic>-design.md` → self-review → user approve → scope breakdown. HARD GATE restated.

- [ ] **Step 1: Write `docs/phases/phase-0.md`.**
- [ ] **Step 2: Commit** `git add docs/phases/phase-0.md && git commit -m "docs: phase-0 brainstorming instructions"`

### Task 12: End-user doc placeholders — BRIEF, PRD, ARCHITECTURE

**Content spec:** Each is a *template* for the end user to fill, with clearly-marked `[fill in Phase 0]` sections and a top note "Filled during Phase 0 for YOUR project." BRIEF = brain-dump summary skeleton; PRD = problem/users/goals/features/non-goals skeleton; ARCHITECTURE = filled after Phase 0 (system diagram placeholder, components, data flow).

- [ ] **Step 1: Write `docs/BRIEF.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`.**
- [ ] **Step 2: Commit** `git add docs/BRIEF.md docs/PRD.md docs/ARCHITECTURE.md && git commit -m "docs: end-user BRIEF/PRD/ARCHITECTURE templates"`

### Task 13: tasks/ scaffolding

**Files:** Create `tasks/layer-0-todo.md`, `tasks/layer-refinement-todo.md`, `tasks/done.md`

**Content spec — `layer-0-todo.md`:** Foundation task list a project starts from, e.g.: scaffold Expo app in `apps/mobile` (Expo Router + NativeWind + New Arch `newArchEnabled:true`); install animation stack (reanimated@4, gesture-handler, worklets, skia, flash-list, expo-image, reanimated-carousel); scaffold NestJS in `apps/api` (Fastify adapter + Prisma + nestjs-zod); init `packages/shared` (zod schemas + tsconfig extends base); wire CI. Each as a checkbox with acceptance criteria + "how to create layer-1-todo.md next" note. `layer-refinement-todo.md` = empty template with the Task block format from spec §After-Completion. `done.md` = header only.

- [ ] **Step 1: Write the three task files.**
- [ ] **Step 2: Commit** `git add tasks/ && git commit -m "docs: task layer scaffolding (layer-0 foundation, refinement, done)"`

---

## Layer 2 — .claude native engine

### Task 14: Hooks scripts

**Files:** Create `.claude/hooks/block-build-output.sh`, `auto-format.sh`, `suggest-commit.sh`

- [ ] **Step 1: `block-build-output.sh`** — reads hook JSON on stdin, denies heavy build commands.
```bash
#!/usr/bin/env bash
# PreToolUse(Bash): block token-heavy build commands inside a session.
set -euo pipefail
input="$(cat)"
cmd="$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)".*/\1/p')"
case "$cmd" in
  *"eas build"*|*"expo run:"*|*"gradlew"*|*"pod install"*|*"xcodebuild"*)
    echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Heavy build detected. Run it in a real terminal, then paste only the error here (keeps session tokens low)."}}'
    exit 0 ;;
esac
echo '{}'
```
- [ ] **Step 2: `auto-format.sh`** — formats the edited file if prettier is available.
```bash
#!/usr/bin/env bash
# PostToolUse(Edit|Write): format the touched file, best-effort.
set -euo pipefail
input="$(cat)"
file="$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
[ -n "${file:-}" ] && [ -f "$file" ] || exit 0
case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md)
    npx --no-install prettier --write "$file" >/dev/null 2>&1 || true ;;
esac
exit 0
```
- [ ] **Step 3: `suggest-commit.sh`** — reminder only, never commits.
```bash
#!/usr/bin/env bash
# Stop|SubagentStop: remind to commit (1 commit = 1 task). Never auto-commits.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo '{"systemMessage":"Uncommitted changes present. Rule: 1 commit = 1 task — consider committing before the next task."}'
else
  echo '{}'
fi
```
- [ ] **Step 4: Make executable + syntax check**
```bash
chmod +x .claude/hooks/*.sh
for f in .claude/hooks/*.sh; do bash -n "$f" && echo "$f ok"; done
```
Expected: three `... ok` lines.
- [ ] **Step 5: Commit** `git add .claude/hooks && git commit -m "feat: hooks — block heavy builds, auto-format, commit reminder"`

### Task 15: settings.json + local example

**Files:** Create `.claude/settings.json`, `.claude/settings.local.json.example`

- [ ] **Step 1: `.claude/settings.json`**
```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "permissions": {
    "allow": [
      "Bash(pnpm:*)", "Bash(npx turbo:*)", "Bash(git:*)",
      "Bash(node:*)", "Bash(npx prettier:*)", "Bash(npx eslint:*)",
      "Bash(npx tsc:*)", "Bash(npx expo lint:*)"
    ],
    "deny": [
      "Bash(rm -rf /*)", "Bash(git push --force:*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/block-build-output.sh" }] }
    ],
    "PostToolUse": [
      { "matcher": "Edit|Write", "hooks": [{ "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/auto-format.sh" }] }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/suggest-commit.sh" }] }
    ]
  }
}
```
- [ ] **Step 2: `.claude/settings.local.json.example`**
```json
{
  "//": "Copy to settings.local.json (gitignored) for per-developer overrides/secrets.",
  "env": { "EXPO_PUBLIC_API_URL": "http://localhost:3000" }
}
```
- [ ] **Step 3: Verify JSON parses**
```bash
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'));console.log('settings ok')"
```
Expected: `settings ok`.
- [ ] **Step 4: Commit** `git add .claude/settings.json .claude/settings.local.json.example && git commit -m "feat: .claude settings — permissions + hook wiring"`

### Task 16: Subagents

**Files:** Create `.claude/agents/{scope-planner,task-implementer,code-reviewer,test-writer,debugger}.md`

Each file: YAML frontmatter `name`, `description` (when-to-use), `tools`, `model`; then a system prompt body. Concrete definitions:

- [ ] **Step 1: `scope-planner.md`** — `model: opus`, tools read/write/grep/glob. Body: read approved spec in `docs/specs/`, do dependency analysis, emit `tasks/layer-0-todo.md` (+ later layers) with tasks that are independent within a layer; each task has files, acceptance criteria, and relevant skills to load.
- [ ] **Step 2: `task-implementer.md`** — `model: sonnet`, full tools. Body: implement exactly ONE task in an isolated git worktree; load the task's named skills; TDD (test → implement → pass); return a summary (files changed, how tested). Must NOT run heavy builds. Must stay within the task's file scope.
- [ ] **Step 3: `code-reviewer.md`** — `model: opus`, read/grep/glob + bash. Body: review a diff for correctness bugs + simplification/reuse; report findings ranked; verdict per finding.
- [ ] **Step 4: `test-writer.md`** — `model: sonnet`. Body: write integration/e2e tests at layer end (Jest+Supertest for api, RTL for mobile, Maestro flows before release).
- [ ] **Step 5: `debugger.md`** — `model: opus`. Body: systematic debugging — reproduce, isolate, hypothesize, fix minimally, add regression test.
- [ ] **Step 6: Verify each has required frontmatter**
```bash
for f in .claude/agents/*.md; do grep -q "^name:" "$f" && grep -q "^description:" "$f" && echo "$f ok" || echo "$f MISSING"; done
```
Expected: five `... ok`.
- [ ] **Step 7: Commit** `git add .claude/agents && git commit -m "feat: subagents — scope-planner, task-implementer, code-reviewer, test-writer, debugger"`

### Task 17: Slash commands

**Files:** Create `.claude/commands/{phase-0,scope-breakdown,pick-task,run-layer,next-layer,checkpoint,learn,graph,refine}.md`

Each: optional frontmatter (`description`, `argument-hint`, `allowed-tools`) + a prompt body. Concrete bodies:

- [ ] **Step 1:** `phase-0.md` — instruct: enter Plan Mode, invoke brainstorming skill, read BRIEF/SPEC, produce approved design in `docs/specs/`; HARD GATE reminder.
- [ ] **Step 2:** `scope-breakdown.md` — dispatch `scope-planner` subagent against the approved spec; write `tasks/layer-0-todo.md`.
- [ ] **Step 3:** `pick-task.md` — show next unchecked task in current layer; load its named skills; restate acceptance criteria.
- [ ] **Step 4:** `run-layer.md` — for each independent task in the current layer, dispatch a `task-implementer` in its own git worktree (reference superpowers:using-git-worktrees), then merge and run `code-reviewer` on each diff; surface merge conflicts explicitly.
- [ ] **Step 5:** `next-layer.md` — verify all tests pass (gate); append completed tasks to `tasks/done.md`; create next `layer-N-todo.md`; bump "Current Layer" in CLAUDE.md.
- [ ] **Step 6:** `checkpoint.md` — run `npm run checkpoint`; then fill CHECKPOINT.md decisions/API-contracts/known-issues; instruct context compaction.
- [ ] **Step 7:** `learn.md` — extract patterns/gotchas from the layer into `.learnings/<topic>.md`.
- [ ] **Step 8:** `graph.md` — run graphify over the monorepo (`graphify .`), summarize `GRAPH_REPORT.md`.
- [ ] **Step 9:** `refine.md` — `argument-hint: <bug|feature description>`; brainstorm the item, then append to `tasks/layer-refinement-todo.md` using the standard task block.
- [ ] **Step 10: Verify count**
```bash
ls .claude/commands/*.md | wc -l    # expect 9
```
- [ ] **Step 11: Commit** `git add .claude/commands && git commit -m "feat: slash commands for the full workflow"`

---

## Layer 3 — Authored skills

> Each skill = `.claude/skills/<name>/SKILL.md` with frontmatter `name` + `description` (the description drives triggering — write it as "Use when …"). Bodies follow the SWM/Vercel skill style: goals, do/don't, concrete snippets. Commit per group.

### Task 18: brainstorming skill

**Content spec:** `name: brainstorming`; description "Use before any new feature/major change — clarify → 2‑3 approaches → design doc." Body: the Phase 0 loop (one question at a time, multiple‑choice preferred, approaches with recommendation, per‑section design, write to `docs/specs/`, self‑review). HARD GATE.

- [ ] **Step 1: Write `.claude/skills/brainstorming/SKILL.md`.**
- [ ] **Step 2: Commit** `git add .claude/skills/brainstorming && git commit -m "feat(skill): brainstorming"`

### Task 19: Mobile foundation & feature skills (8)

For each, write `.claude/skills/<name>/SKILL.md` with `name`, a "Use when …" `description`, and a body covering the bullets:

- [ ] **Step 1: `mobile-app-agent`** — screen composition, Expo Router navigation, device APIs/permissions, offline-aware state, perf guardrails (FlashList, memoization, avoid JS-thread work). Expo-first.
- [ ] **Step 2: `expo-router-nativewind`** — foundation: root `_layout`, SafeArea, GestureHandlerRootView, Reanimated setup, NativeWind config, theme provider, route groups. **Must set `newArchEnabled: true`** (Reanimated 4) and note `react-native-worklets` install.
- [ ] **Step 3: `mobile-auth-state`** — auth flows, `expo-secure-store` token storage, refresh, auth-gated routes, persisted session store (Zustand).
- [ ] **Step 4: `mobile-api-integration`** — TanStack Query, typed API client consuming `@shared` zod contracts, retry/error, offline cache/invalidations.
- [ ] **Step 5: `mobile-data-forms`** — `react-hook-form` + zod (`@shared` schemas), FlashList lists, mutations, optimistic updates.
- [ ] **Step 6: `mobile-i18n-theme`** — i18n (i18next/expo-localization), light/dark theme tokens with NativeWind, RTL note.
- [ ] **Step 7: `mobile-testing-release`** — Jest + RTL unit/component, Maestro e2e flows, release checklist (EAS profiles).
- [ ] **Step 8: `expo-eas-pipeline`** — `eas.json` profiles, build/submit/update, channels, secrets via EAS env.
- [ ] **Step 9: Commit** `git add .claude/skills && git commit -m "feat(skill): mobile skills (8)"`

### Task 20: mobile-animations skill (recipe library)

**Content spec:** `name: mobile-animations`; description "Use when implementing animations/gestures/transitions in the Expo app (Reanimated v4)." Body = recipe library, each recipe with a canonical snippet + perf caveat + "check `motion-design-principles` first":
- Setup gotchas: New Arch required; `react-native-worklets` separate package; `useReducedMotion()` fallback.
- **Scroll-driven 3D cards** snippet: `useAnimatedScrollHandler` + `interpolate(scroll, inputRange, outputRange, Extrapolation.CLAMP)` → `transform:[{perspective:800},{rotateX},{scale},{translateY}]`.
- **Swipe-to-island morph** snippet: `Gesture.Pan()` + shared value + `LinearTransition`/`entering`/`exiting` to morph a list item into a floating in-app island pill; Skia option for fluid morph.
- **Gesture interactions**, **carousel** (`react-native-reanimated-carousel` 3D modes), **Skia effects** (particles/shader/blur).
- Deep source pointer: vendored `react-native-best-practices`.

- [ ] **Step 1: Write `.claude/skills/mobile-animations/SKILL.md` with real snippets.**
- [ ] **Step 2: Commit** `git add .claude/skills/mobile-animations && git commit -m "feat(skill): mobile-animations recipe library (Reanimated v4)"`

### Task 21: motion-design-principles skill

**Content spec:** `name: motion-design-principles`; description "Use when deciding WHETHER/how much to animate a screen or interaction." Body: when-to-animate (state change, continuity, gesture feedback, purposeful delight) vs when-to-restrain (high-frequency actions, dense scroll, input-blocking, low-end/battery, Reduce Motion on); hard rules (`useReducedMotion()`, 200–350ms, springs, cap concurrent heavy effects, UI thread); a **decision checklist** the agent runs before adding any animation; explicit handoff to `mobile-animations` for implementation.

- [ ] **Step 1: Write `.claude/skills/motion-design-principles/SKILL.md`.**
- [ ] **Step 2: Commit** `git add .claude/skills/motion-design-principles && git commit -m "feat(skill): motion-design-principles (when to animate)"`

### Task 22: Backend skills (5, NestJS)

- [ ] **Step 1: `api-design`** — REST resource design, request/response shape, versioning, pagination, error envelope, HTTP status conventions.
- [ ] **Step 2: `nestjs-backend`** — modules/controllers/providers, DI, guards/interceptors/pipes, DTOs; **Fastify adapter** setup; **`nestjs-zod` `ZodValidationPipe`** reusing `@shared` schemas; config module; exception filter.
- [ ] **Step 3: `database-orm`** — Prisma schema, migrations (`prisma migrate`), relations, `PrismaModule`/`PrismaService`, query optimization, transactions.
- [ ] **Step 4: `backend-auth-security`** — Nest Guards + Passport (JWT/session), RBAC, CORS/CSRF, helmet, secrets via config, OWASP top-10 notes.
- [ ] **Step 5: `backend-testing`** — Jest unit + Supertest integration against the Nest app, fixtures, mocking Prisma, coverage target.
- [ ] **Step 6: Commit** `git add .claude/skills && git commit -m "feat(skill): backend skills (NestJS, 5)"`

### Task 23: Shared/cross-cutting skills (3)

- [ ] **Step 1: `shared-contracts`** — `packages/shared` layout: zod schemas + inferred types + API contract objects consumed by both mobile (TanStack Query) and api (`nestjs-zod`); single source of truth; export map + `@shared/*` alias.
- [ ] **Step 2: `typescript-strict`** — no `any`, narrowing, discriminated unions, `satisfies`, inference patterns; strict flags rationale.
- [ ] **Step 3: `git-workflow`** — conventional commits, branch naming, 1 commit = 1 task, PR checklist.
- [ ] **Step 4: Commit** `git add .claude/skills && git commit -m "feat(skill): shared-contracts, typescript-strict, git-workflow"`

### Task 24: Validate all authored skill frontmatter

- [ ] **Step 1: Frontmatter presence check**
```bash
missing=0
for f in .claude/skills/*/SKILL.md; do
  grep -q "^name:" "$f" && grep -q "^description:" "$f" || { echo "BAD: $f"; missing=1; }
done
[ "$missing" = 0 ] && echo "all skills valid"
```
Expected: `all skills valid`.
- [ ] **Step 2: Commit (only if any fixes were needed)** `git commit -am "fix(skill): frontmatter corrections" || true`

---

## Layer 4 — Vendored external skills

> Vendor by copying the upstream skill folder into `.claude/skills/`, preserving its LICENSE + attribution. If a repo's license forbids redistribution, DO NOT vendor it — instead record its install command in `EXTERNAL_SKILLS.md` and skip. Pin the source commit.

### Task 25: Vendor SWM react-native-best-practices

**Files:** `.claude/skills/react-native-best-practices/` (copied) + `LICENSE`/attribution

- [ ] **Step 1: Fetch upstream into a temp dir**
```bash
tmp=$(mktemp -d)
git clone --depth 1 https://github.com/software-mansion-labs/skills "$tmp/swm"
```
- [ ] **Step 2: Confirm license permits redistribution**
```bash
ls "$tmp/swm" | grep -i license && sed -n '1,5p' "$tmp/swm"/LICENSE*
```
Expected: an MIT/Apache-style license. If none/incompatible → abort this task, add to EXTERNAL_SKILLS.md as install-only.
- [ ] **Step 3: Copy the react-native-best-practices skill + license**
```bash
# adjust path to the skill folder within the repo as needed
cp -R "$tmp/swm"/skills/react-native-best-practices .claude/skills/react-native-best-practices
cp "$tmp/swm"/LICENSE* .claude/skills/react-native-best-practices/ 2>/dev/null || true
( cd "$tmp/swm" && git rev-parse HEAD ) > .claude/skills/react-native-best-practices/.upstream-commit
```
- [ ] **Step 4: Verify frontmatter present**
```bash
grep -q "^name:" .claude/skills/react-native-best-practices/SKILL.md && echo ok
```
- [ ] **Step 5: Commit** `git add .claude/skills/react-native-best-practices && git commit -m "feat(skill): vendor SWM react-native-best-practices (pinned)"`

### Task 26: Vendor Vercel react-native-guidelines

- [ ] **Step 1–5:** Same procedure as Task 25 against `https://github.com/vercel-labs/agent-skills`, skill `react-native-guidelines`. Confirm license, copy folder + LICENSE + `.upstream-commit`, verify frontmatter, commit `feat(skill): vendor Vercel react-native-guidelines (pinned)`.

### Task 27: Vendor ui-ux-pro-max

- [ ] **Step 1–5:** Same procedure against `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill`. This skill carries data (CSV) + scripts — copy the whole skill folder. Confirm license; if it requires a CLI/DB init, note that in EXTERNAL_SKILLS.md. Commit `feat(skill): vendor ui-ux-pro-max (pinned)`.

### Task 28: Vendor ponytail

- [ ] **Step 1–5:** Same procedure against `https://github.com/DietrichGebert/ponytail`. Ponytail ships commands/plugin content — vendor the skill/command files relevant to Claude Code. Confirm license. Commit `feat(skill): vendor ponytail (pinned)`.
- [ ] **Step 6: Cleanup temp** `rm -rf "$tmp"` (if still set).

### Task 29: docs/EXTERNAL_SKILLS.md

**Content spec:** Table of vendored skills — name, source repo URL, pinned commit (from `.upstream-commit`), license, and the re‑sync command (`git clone … && cp -R …`). Note which (if any) were left install-only. Note `radon-mcp` intentionally excluded. Document ponytail vs built‑in `/simplify` overlap (when to use which).

- [ ] **Step 1: Write `docs/EXTERNAL_SKILLS.md`.**
- [ ] **Step 2: Commit** `git add docs/EXTERNAL_SKILLS.md && git commit -m "docs: external skills provenance + re-sync"`

---

## Layer 5 — CI/CD, scripts, learning/graph

### Task 30: CI workflow

**Files:** Create `.github/workflows/ci.yml`

- [ ] **Step 1: Write `ci.yml`**
```yaml
name: CI
on:
  pull_request:
  push: { branches: [main, develop] }
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint typecheck test
```
- [ ] **Step 2: Verify YAML parses**
```bash
node -e "require('fs').readFileSync('.github/workflows/ci.yml','utf8')" && python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('yaml ok')"
```
Expected: `yaml ok`.
- [ ] **Step 3: Commit** `git add .github/workflows/ci.yml && git commit -m "ci: quality gate (lint/typecheck/test via turbo)"`

### Task 31: EAS + API deploy workflows

**Files:** Create `eas-preview.yml`, `eas-production.yml`, `api-deploy.yml`

- [ ] **Step 1: `eas-preview.yml`** — trigger `push` to `develop` + `workflow_dispatch`; setup node/pnpm/expo; `eas build --profile preview --platform all --non-interactive` guarded by `if: env.EXPO_TOKEN` secret. Comment that `EXPO_TOKEN` secret is required.
- [ ] **Step 2: `eas-production.yml`** — `workflow_dispatch` only; `environment: production`; `eas build --profile production` + optional `eas submit`.
- [ ] **Step 3: `api-deploy.yml`** — build the API Docker image (`docker build apps/api`); a **provider-agnostic** deploy step left as a documented placeholder (`# TODO: add your host's deploy step`).
- [ ] **Step 4: Verify all YAML parse**
```bash
for f in .github/workflows/*.yml; do python3 -c "import yaml;yaml.safe_load(open('$f'))" && echo "$f ok"; done
```
Expected: four `... ok`.
- [ ] **Step 5: Commit** `git add .github/workflows && git commit -m "ci: EAS preview/production + provider-agnostic api-deploy"`

### Task 32: checkpoint.js script

**Files:** Create `scripts/checkpoint.js`

- [ ] **Step 1: Write `scripts/checkpoint.js`** — Node script (no deps): read git log since last checkpoint tag/commit, read `tasks/done.md`, write/refresh `CHECKPOINT.md` with sections (Architecture, Key decisions, API contracts, Known issues, Completed summary) leaving manual sections marked `<!-- fill: ... -->`.
```js
#!/usr/bin/env node
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const log = execSync("git log --oneline -20", { encoding: "utf8" });
const done = fs.existsSync("tasks/done.md") ? fs.readFileSync("tasks/done.md", "utf8") : "";
const out = `# Checkpoint

## Recent commits
\`\`\`
${log}\`\`\`

## Completed tasks
${done || "_none yet_"}

## Architecture
<!-- fill: text diagram -->

## Key decisions (WHY)
<!-- fill: decisions + rationale -->

## API contracts (signatures only)
<!-- fill: shared zod contract signatures -->

## Known issues & gotchas
<!-- fill: things next layer must avoid -->
`;
fs.writeFileSync("CHECKPOINT.md", out);
console.log("CHECKPOINT.md updated");
```
- [ ] **Step 2: Verify it runs**
```bash
node scripts/checkpoint.js && test -f CHECKPOINT.md && echo ok
```
Expected: `CHECKPOINT.md updated` then `ok`.
- [ ] **Step 3: Commit** `git add scripts/checkpoint.js CHECKPOINT.md && git commit -m "feat: checkpoint generator script + CHECKPOINT.md"`

### Task 33: start-project scripts (sh/ps1/bat)

**Files:** Create `scripts/start-project.sh`, `.ps1`, `.bat`

**Content spec (all three, same flow):** prompt project name; ask for an optional spec file path → copy to `docs/SPECIFICATIONS.md` + write a short `docs/BRIEF.md`; (else) prompt a brain-dump → write `docs/BRIEF.md`; ensure `docs/specs/` is empty; print next steps ("Open in Claude Code → Phase 0 auto-starts via CLAUDE.md"); optionally offer `git init` reset + GitHub repo create via `gh` (guarded by `command -v gh`). Keep POSIX-safe in `.sh`.

- [ ] **Step 1: Write the three scripts;** `chmod +x scripts/start-project.sh`.
- [ ] **Step 2: Verify sh syntax**
```bash
bash -n scripts/start-project.sh && echo ok
```
Expected: `ok`.
- [ ] **Step 3: Commit** `git add scripts/start-project.* && git commit -m "feat: start-project bootstrap scripts (sh/ps1/bat)"`

### Task 34: Learning + graph docs + .learnings

**Files:** Create `docs/CI_CD.md`, `docs/CONTINUOUS_LEARNING.md`, `docs/GRAPH.md`, `.learnings/.gitkeep`

- [ ] **Step 1: `docs/CI_CD.md`** — the 4 workflows, required secrets (`EXPO_TOKEN`), gate rules, provider-agnostic deploy note (spec §8).
- [ ] **Step 2: `docs/CONTINUOUS_LEARNING.md`** — `.learnings/` methodology; `/learn` extracts patterns/gotchas per layer; format of a learning file.
- [ ] **Step 3: `docs/GRAPH.md`** — graphify install (uv), `graphify .`, reading `GRAPH_REPORT.md`, `/graph` command, `graphify-out/` is gitignored.
- [ ] **Step 4: `.learnings/.gitkeep`.**
- [ ] **Step 5: Commit** `git add docs/CI_CD.md docs/CONTINUOUS_LEARNING.md docs/GRAPH.md .learnings && git commit -m "docs: CI/CD, continuous-learning, graph guides"`

---

## Layer 6 — Final verification & push

### Task 35: Whole-template validation sweep

- [ ] **Step 1: All JSON valid**
```bash
for f in package.json turbo.json tsconfig.base.json eas.json .claude/settings.json .claude/settings.local.json.example; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f ok"; done
```
Expected: every file `ok`.
- [ ] **Step 2: All skills/agents/commands have frontmatter**
```bash
bad=0
for f in .claude/skills/*/SKILL.md .claude/agents/*.md; do grep -q "^name:" "$f" && grep -q "^description:" "$f" || { echo "BAD $f"; bad=1; }; done
[ "$bad" = 0 ] && echo "frontmatter ok"
```
Expected: `frontmatter ok`.
- [ ] **Step 3: Hooks + scripts syntax**
```bash
for f in .claude/hooks/*.sh scripts/start-project.sh; do bash -n "$f" && echo "$f ok"; done
```
- [ ] **Step 4: Workspace installs clean**
```bash
pnpm install --frozen-lockfile && echo "install ok"
```
Expected: `install ok`.
- [ ] **Step 5: No placeholders left in shipped content**
```bash
grep -rn "TODO\|TBD\|FIXME" CLAUDE.md README.md docs .claude || echo "no stray placeholders"
```
Expected: only intentional `# TODO: add your host's deploy step` in `api-deploy.yml` (documented), else `no stray placeholders`.
- [ ] **Step 6: Verify Phase-0 trigger is intact** (docs/specs empty)
```bash
ls -A docs/specs   # expect only .gitkeep
```
- [ ] **Step 7: Commit any fixes** `git commit -am "fix: final validation sweep" || echo "nothing to fix"`

### Task 36: Push

- [ ] **Step 1: Push all layers to remote**
```bash
git push origin main
```
Expected: updates `https://github.com/ngnthanhdev/claude_template_code`.
- [ ] **Step 2: Report** the pushed commit range and a one-line summary of the finished template.

---

## Self-Review (author)

**Spec coverage:** §3 structure → Tasks 1–6,13; §4 engine → Tasks 14–17; §5 skills (authored) → Tasks 18–24; §5.2 vendored → Tasks 25–29; §6 workflow → Tasks 8–11,17; §7 monorepo config → Tasks 2–5; §8 CI/CD → Tasks 30–31; §9 testing → embedded in skills (Task 19,22,23) + agents (Task 16); §10 animation → Tasks 19(step2),20,21; §11 model strategy → Tasks 8,16; §12 success criteria → Task 35; §13 risks (licenses/worktree/reduce-motion/Phase-0 trigger) → Tasks 25–28,1,15,21. All covered.

**Placeholder scan:** Config/hook/CI/script files ship complete content. Prose skills/docs ship content specs (path + frontmatter + mandatory sections + must-include facts) — the accepted altitude for prose deliverables, not banned placeholders. The only literal `TODO` shipped is the documented provider-agnostic deploy line, asserted in Task 35 Step 5.

**Type/name consistency:** `@shared/*` alias (Task 4) matches `packages/shared/src/*` and shared-contracts (Task 23); `nestjs-zod ZodValidationPipe` consistent in spec §5/§11 and Tasks 22/23; `newArchEnabled:true` + `react-native-worklets` consistent across Tasks 19/20/21; hook filenames in Task 14 match settings wiring in Task 15; `checkpoint.js`/`npm run checkpoint` consistent across package.json (Task 2), checkpoint command (Task 17 step 6), and Task 32.
