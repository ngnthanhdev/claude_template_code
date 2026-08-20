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
(`feat(skill): animations recipe library`, `fix(auth): rotate refresh
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
- [ ] `reviewer`'s findings (if it ran on this diff) are addressed or
      explicitly deferred with a reason, not silently ignored.

## Rollback & checkpoints

Every scenario below assumes the commit discipline above (one commit per
task, conventional messages) — that discipline is what makes each of these
precise instead of a guess about what a bigger revert might take with it.

### Checkpoint tags — `layer-N-done`

Once a layer's gate passes (`/next-layer`'s test-green check), it stamps a
tag:

```bash
git tag layer-2-done
```

This is a checkpoint, not a branch — a fixed point you can always reset or
diff against, even after several more layers have landed on top. See
`.claude/commands/next-layer.md` (it tags automatically before bumping
`CLAUDE.md`'s Current Layer) and `docs/WORKFLOW.md`.

### Stash before a risky operation

Before anything that could discard uncommitted work (a rebase, an
experimental change you might back out of, a merge you're not sure will go
cleanly):

```bash
git stash push -u -m "safety-<what-youre-about-to-try>"
```

`-u` includes untracked files. Restore with `git stash pop` (or
`git stash apply` to keep it in the stash list until you're sure you don't
need it again).

### Revert one task

A single task's commit is wrong and hasn't been built on yet:

```bash
git reset --soft HEAD~1   # undoes the commit, keeps the changes staged
```

Use `--soft` (not `--hard`) unless you're certain you want the file
changes gone too, not just the commit. If other commits already sit on top
of the one you want gone, use `git revert <sha>` instead — it adds a new
commit undoing that one rather than rewriting history other commits may
depend on.

### Revert a whole layer

A layer turned out fundamentally wrong and you want to go back to the last
known-good checkpoint — the previous layer's tag (if this layer tagged
`layer-3-done`, the checkpoint to go back to is `layer-2-done`):

```bash
git reset --hard layer-2-done
```

This throws away every commit made since that checkpoint — confirm
`git log layer-2-done..HEAD --oneline` shows only work you actually intend
to lose before running it, and stash anything uncommitted first (see
above). Prefer a range `git revert` over `reset --hard` if the layer's
commits have already been pushed and someone else may have pulled them.

### Abandon or revert an autonomous-runner branch

The task board (`tools/board/`) runs each autonomous task in its own
worktree/branch — `.board-worktrees/<id>` on branch `auto/<id>` (see
`tools/board/README.md`). To abandon a run that hasn't merged anywhere,
substitute the task's id for `$id` (unquoted `<`/`>` are shell redirection
operators, so don't paste the angle-bracket form directly):

```bash
id=a1b2c3
git worktree remove ".board-worktrees/$id" --force
git branch -D "auto/$id"
```

To undo a run whose `auto/<id>` branch was **already merged** into the
layer branch, don't delete anything — `git revert` the merge (or the
individual commits it brought in) instead, the same as any other
already-shared history:

```bash
git revert -m 1 abc1234   # abc1234 = the merge commit; -m 1 keeps the branch you merged into
```

## Do

- Write commit subjects in the imperative mood, under ~70 characters,
  `type(scope): subject`.
- Keep exactly one task's changes per commit; stage specific paths.
- Name branches/worktrees `layer-<N>/<slug>`, `refine/<slug>`, or
  `fix/<slug>` depending on where the work came from.
- Run the PR checklist above before merging a layer, not after something
  breaks downstream.
- Tag `layer-N-done` once a layer's gate passes, and stash (`-u`) before
  any operation that could discard uncommitted work — see "Rollback &
  checkpoints" above.

## Don't

- Don't bundle two tasks (or a task plus an unrelated drive-by fix) into one
  commit — split them, even if it means committing twice in quick
  succession.
- Don't use `git add -A`/`git add .` without reviewing `git status` first.
- Don't force-push over `main`, or use `--no-verify`/`--no-gpg-sign` to skip
  a failing hook — fix what the hook caught instead.
- Don't merge a layer's PR with a red `lint`/`typecheck`/`test` job "to fix
  in a follow-up" — that's the exact gate `/next-layer` exists to enforce.
- Don't `git reset --hard` without checking `git log <target>..HEAD` and
  stashing first, and don't delete an already-merged `auto/<id>` branch —
  `git revert` it instead (see "Rollback & checkpoints").
