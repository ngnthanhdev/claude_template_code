#!/usr/bin/env bash
# Stop: remind to commit (1 commit = 1 task). Never auto-commits.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo '{"systemMessage":"Uncommitted changes present. Rule: 1 commit = 1 task — consider committing before the next task."}'
else
  echo '{}'
fi
