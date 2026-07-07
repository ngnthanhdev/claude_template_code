---
name: git-workflow
description: Use when creating a commit, naming a branch/worktree, or opening a PR anywhere in this repo — conventional commit format, the 1-commit-per-task rule, branch naming, and the PR checklist before merging a layer.
---

# git-workflow

The commit and branch discipline this template runs on: conventional
commits, exactly one commit per task (never a bundle of unrelated changes),
a fixed branch-naming scheme that matches the layer/task structure in
`tasks/layer-N-todo.md`, and a PR checklist before a layer's work merges.

## Goal

`git log --oneline` reads as a changelog — every commit is one task, its
subject says what and its type says what kind. Any commit can be reverted
alone without unpicking an unrelated change bundled into it. Every PR that
merges a layer has already passed the same gate `/next-layer` checks:
lint/typecheck/test green.

## Conventional commits

```
<type>(<scope>): <subject>
```

| Type | Use for |
|---|---|
| `feat` | A new capability (a skill, an endpoint, a screen, a config addition) |
| `fix` | A bug fix — behavior was wrong, now it isn't |
| `test` | Test-only changes (new coverage, no production code change) |
| `docs` | Documentation-only changes (`docs/`, `README.md`, comments) |
| `chore` | Tooling/dependency/config maintenance with no behavior change |
| `refactor` | Restructuring code with no behavior change (not a `feat` or `fix`) |
| `perf` | A performance improvement, verified, with no behavior change |
| `ci` | Changes to `.github/workflows/*` |

`scope` is the area touched — a skill name, a module, a package
(`feat(skill): mobile-animations recipe library`, `fix(auth): rotate refresh
token before expiry`, `chore(deps): bump nestjs-zod`). Keep the subject line
imperative and under ~70 characters (`add`, not `added`/`adds`); put any
necessary detail in the body, not a run-on subject.

## Branch naming

| Prefix | For |
|---|---|
| `layer-<N>/<task-slug>` | A task from `tasks/layer-N-todo.md` — matches the isolated worktree a `task-implementer` works in (`superpowers:using-git-worktrees`) |
| `refine/<slug>` | Work picked up from `tasks/layer-refinement-todo.md` via `/refine` |
| `fix/<slug>` | A hotfix outside the normal layer flow |

Example: task 22 in layer 3 (this task) would be `layer-3/backend-skills` if
it were worked in its own worktree rather than directly on `main`. The slug
is short and kebab-case, describing the task, not the ticket number alone
(`layer-3/backend-skills`, not `layer-3/task-22`) — a slug should be
readable in `git branch` output without cross-referencing the task file.

## 1 commit = 1 task

Straight from `CLAUDE.md`'s coding rules: a task's commit contains exactly
the files that task's acceptance criteria named, nothing from a different
task riding along. This is why `task-implementer` runs each task in its own
git worktree (`superpowers:using-git-worktrees`) — physical isolation makes
it impossible to accidentally stage another task's in-progress file.

- If mid-task you discover you need to touch a file outside that task's
  declared scope, stop and say so (per `task-implementer`'s hard
  constraints) rather than silently expanding the commit.
- If a task's implementation naturally splits into "add the failing test"
  and "make it pass," that's still **one** commit — TDD's red/green cycle is
  an internal workflow step, not a reason to fragment the history.
- Never combine two tasks' worth of changes into one commit because they
  touched adjacent files — merge/reconcile conflicts explicitly instead (see
  `docs/WORKFLOW.md`'s merge step), don't paper over them with a joint commit.

## Writing the commit

```bash
git add .claude/skills/git-workflow
git commit -m "feat(skill): shared-contracts, typescript-strict, git-workflow"
```

- Stage specific paths, never `git add -A`/`git add .` blindly — review
  `git status` first so an unrelated in-progress file (or a `.env`) doesn't
  ride along.
- Use a heredoc for any commit message with a body, so formatting/quoting
  survives:

```bash
git commit -m "$(cat <<'EOF'
fix(auth): rotate refresh token before expiry instead of on 401

The previous check only refreshed reactively after a request already
failed with 401, costing one extra round trip on every session near
expiry. Proactively refresh when the token has under 60s left instead.
EOF
)"
```

## PR checklist

Before opening a PR that merges a layer (or a single task, if working
outside the fan-out flow):

- [ ] `pnpm turbo run lint typecheck test` is green locally (the same
      command CI's `quality` job runs).
- [ ] Every commit in the PR is one task, conventionally formatted, per the
      rules above — `git log --oneline main..HEAD` should read cleanly as a
      changelog.
- [ ] No secret, API key, or `.env` file is staged — check `git status`/the
      diff, not just the filename, before pushing (a file with an innocuous
      name can still contain a leaked credential).
- [ ] The PR description states which layer/task(s) it covers and links the
      relevant `tasks/layer-N-todo.md` entries.
- [ ] If the PR changes `packages/shared`, both `apps/api` and `apps/mobile`
      were checked against the new contract shape (`shared-contracts`) —
      not just one consumer.
- [ ] `code-reviewer`'s findings (if it ran on this diff) are addressed or
      explicitly deferred with a reason, not silently ignored.

## Do

- Write commit subjects in the imperative mood, under ~70 characters,
  `type(scope): subject`.
- Keep exactly one task's changes per commit; stage specific paths.
- Name branches/worktrees `layer-<N>/<slug>`, `refine/<slug>`, or
  `fix/<slug>` depending on where the work came from.
- Run the PR checklist above before merging a layer, not after something
  breaks downstream.

## Don't

- Don't bundle two tasks (or a task plus an unrelated drive-by fix) into one
  commit — split them, even if it means committing twice in quick
  succession.
- Don't use `git add -A`/`git add .` without reviewing `git status` first.
- Don't force-push over `main`, or use `--no-verify`/`--no-gpg-sign` to skip
  a failing hook — fix what the hook caught instead.
- Don't merge a layer's PR with a red `lint`/`typecheck`/`test` job "to fix
  in a follow-up" — that's the exact gate `/next-layer` exists to enforce.
