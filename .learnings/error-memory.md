# Error memory (`.learnings/error-memory.md`)

Structured, chronological record of failures `debugger` has actually
root-caused in this project — distinct from the free-form topic files in
`.learnings/` (see `docs/CONTINUOUS_LEARNING.md`). Every test/build/lint/
review failure `debugger` resolves gets appended here with the same
seven-field schema, so a later failure with a matching **Pattern** can be
fixed from this file instead of being re-diagnosed from scratch.

## Schema

Each entry is a dated heading followed by six labeled fields:

```markdown
## YYYY-MM-DD — <short error name>

- **Task:** layer-N / T-xxxxxx
- **Error:** <type> — <message>
- **Root Cause:** <the actual mechanism, not the symptom>
- **Fix:** <what changed to resolve it>
- **Pattern:** <the general, reusable lesson — what to recognize next time>
- **Prevention:** <concrete step to avoid recurrence, if any>
```

- **Task** — the layer/task this surfaced in (`layer-2/T-a3f9c1`), or
  `refine/<slug>` / `ad hoc` if it wasn't tied to a task.
- **Error** — the failure's type (test failure, build error, lint
  violation, review finding, runtime exception) and its literal message or
  a close paraphrase.
- **Root Cause** — per `debugger`'s process, the actual mechanism, never a
  symptom restatement ("the mock didn't match the new signature," not "the
  test failed").
- **Pattern** — written generally enough to match a *future* error, not
  just restate this one — this is the field `debugger` checks first and
  `/checkpoint` (learn step) scans for recurrence.
- **Prevention** — optional if there's nothing actionable beyond "don't
  repeat the mistake"; omit rather than pad.

## How this is used

- `debugger` consults this file **first** on any test/build/lint/review
  failure — if an existing **Pattern** matches, it applies the known fix
  directly instead of re-running full root-cause analysis. Only once no
  matching pattern exists (or the known fix doesn't actually resolve it)
  does it fall back to the full reproduce → isolate → fix → regression-test
  loop, then **appends** a new entry here once the failure is actually
  resolved. See `.claude/agents/debugger.md`.
- `/checkpoint` (learn step) reviews entries accumulated during the just-finished layer and
  promotes any **Pattern** that recurred into the owning skill's gotchas —
  see `.claude/commands/checkpoint.md` and `docs/CONTINUOUS_LEARNING.md`.
- Entries are **appended**, never rewritten or deleted — this file is a
  chronological log, not a curated summary (the curated form is the skill
  gotcha `/checkpoint` (learn step) promotes it into).

## Entries

_No errors recorded yet — `debugger` appends here the first time it
resolves a test/build/lint/review failure._
