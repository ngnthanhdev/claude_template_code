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
