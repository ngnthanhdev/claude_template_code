---
description: "Run the security-review skill over a diff/PR/path (default: the current working diff) and report only high-confidence security findings."
argument-hint: "[diff|PR#|path] (default: working diff)"
allowed-tools: Read, Grep, Glob, Bash
---

Target: $ARGUMENTS

1. Resolve the target:
   - No argument → the uncommitted working diff (`git diff`), or if clean,
     the current branch vs `main` (`git diff main...HEAD`).
   - A PR number → fetch it (`gh pr diff <PR#>`).
   - A path → review that file/directory's current state, not a diff.
2. Run the `security-review` skill over the resolved target: trace every
   untrusted input (mobile deep link, HTTP body/query/param) to its sink,
   and apply the skill's checklist — BOLA/IDOR, mass assignment, DTO
   validation, injection, file upload, secrets, rate limiting, error leakage.
3. Report **only** findings that survive the skill's high-confidence bar, in
   its exact format: severity, file:line, exploitation scenario, impact,
   concrete remediation, regression test, and ASVS (`apps/api`) or MASVS
   (`apps/mobile`) category. If nothing high-confidence was found, say so
   explicitly rather than padding the report with speculative items.

This complements `/run-layer`'s `code-reviewer` step, which reviews the same
kind of diff for correctness and simplification — this command is the
security lens only, not a replacement for that pass.
