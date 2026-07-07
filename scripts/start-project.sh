#!/usr/bin/env bash
# Bootstraps a new project from this template: names the project, seeds
# docs/BRIEF.md (or docs/SPECIFICATIONS.md if you already have a spec), makes
# sure docs/specs/ stays empty (the Phase 0 hard gate depends on that), and
# optionally resets git history + creates a GitHub repo via `gh`.
#
# POSIX-safe: avoids bash-4+-only features (no arrays, no `${var,,}`, no
# `readarray`) so it behaves the same under the bash 3.2 that ships with
# macOS and newer bash/dash on Linux.
set -eu

echo "=== start-project ==="
echo

printf "Project name: "
read -r PROJECT_NAME
if [ -z "$PROJECT_NAME" ]; then
  PROJECT_NAME="my-project"
fi

printf "Path to an existing spec file, if you have one (leave blank to skip): "
read -r SPEC_PATH

DOCS_DIR="docs"
SPECS_DIR="$DOCS_DIR/specs"
mkdir -p "$DOCS_DIR" "$SPECS_DIR"

if [ -n "$SPEC_PATH" ] && [ -f "$SPEC_PATH" ]; then
  cp "$SPEC_PATH" "$DOCS_DIR/SPECIFICATIONS.md"
  cat > "$DOCS_DIR/BRIEF.md" <<EOF
# Brief

Project: $PROJECT_NAME

A full specification was supplied at bootstrap time and copied to
\`docs/SPECIFICATIONS.md\`. Run \`/phase-0\` to turn it into an approved
design in \`docs/specs/\`.
EOF
  echo "Copied $SPEC_PATH -> $DOCS_DIR/SPECIFICATIONS.md"
  echo "Wrote $DOCS_DIR/BRIEF.md"
else
  echo
  echo "No spec file provided. Give a quick brain-dump of the idea instead"
  echo "(one line is fine -- Phase 0 will ask clarifying questions). End with"
  echo "an empty line."
  BRAINDUMP=""
  while IFS= read -r LINE; do
    [ -z "$LINE" ] && break
    BRAINDUMP="$BRAINDUMP$LINE
"
  done
  if [ -z "$BRAINDUMP" ]; then
    BRAINDUMP="_[fill in during Phase 0]_"
  fi
  cat > "$DOCS_DIR/BRIEF.md" <<EOF
# Brief

Project: $PROJECT_NAME

## The idea, in a few sentences

$BRAINDUMP

## Who it's for

_[fill in during Phase 0]_

## Why it matters

_[fill in during Phase 0]_

## Rough scope

_[fill in during Phase 0]_

## Anything you already know you don't want

_[fill in during Phase 0]_

## Constraints

_[fill in during Phase 0]_

---

Run \`/phase-0\` to turn this into a PRD and an approved design in
\`docs/specs/\`.
EOF
  echo "Wrote $DOCS_DIR/BRIEF.md"
fi

# Phase 0's hard gate depends on docs/specs/ being empty (only .gitkeep) --
# never let this script leave anything else there.
find "$SPECS_DIR" -mindepth 1 ! -name ".gitkeep" -exec rm -rf {} + 2>/dev/null || true
touch "$SPECS_DIR/.gitkeep"

echo
echo "docs/specs/ is empty (Phase 0 gate intact)."
echo
echo "Next steps:"
echo "  Open in Claude Code -> Phase 0 auto-starts via CLAUDE.md"

if command -v gh >/dev/null 2>&1; then
  printf "Reset git history and create a new GitHub repo for '%s' now? [y/N] " "$PROJECT_NAME"
  read -r ANSWER
  case "$ANSWER" in
    y|Y|yes|YES)
      rm -rf .git
      git init
      git add -A
      git commit -m "chore: bootstrap $PROJECT_NAME from claude_template_code"
      gh repo create "$PROJECT_NAME" --source=. --private --push
      echo "Created and pushed GitHub repo: $PROJECT_NAME"
      ;;
    *)
      echo "Skipped git/GitHub setup."
      ;;
  esac
else
  echo "(gh CLI not found -- skipping optional GitHub repo creation. Install"
  echo " it from https://cli.github.com/ if you want this step automated.)"
fi

echo
echo "Done."
