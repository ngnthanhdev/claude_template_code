import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseTaskFile, parseTasksDir, patchTask, STATUSES } from "./tasks.ts";

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "board-tasks-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const SAMPLE_MULTI_TASK = `# Layer 0 — Foundation

Status: **not started**

---

### T-13ab58 — Scaffold the Expo app in apps/mobile
- **Status:** todo
- **Assignee:** ai
- **Files:** apps/mobile/**, apps/mobile/app.json, apps/mobile/package.json
- **Acceptance:**
  - Expo app created with Expo Router as the navigation foundation.
  - NativeWind configured and a sample styled component renders correctly.
- **Skills:** expo-router-nativewind, mobile-app-agent

---

### T-804011 — Install the animation dependency stack
- **Status:** blocked
- **Assignee:** ai
- **Files:** apps/mobile/package.json
- **Acceptance:** Reanimated 4 stack installed and a trivial animation runs.
- **Skills:** mobile-animations, expo-router-nativewind
- **Depends:** T-13ab58

Some free-form notes about SDK version choice go here.
They can span multiple lines.

---
`;

test("parseTaskFile parses a sample multi-task file", () => {
  withTempDir((dir) => {
    const file = join(dir, "layer-0-todo.md");
    writeFileSync(file, SAMPLE_MULTI_TASK, "utf8");

    const tasks = parseTaskFile(file);
    assert.equal(tasks.length, 2);

    const [first, second] = tasks;

    assert.equal(first.id, "T-13ab58");
    assert.equal(first.title, "Scaffold the Expo app in apps/mobile");
    assert.equal(first.status, "todo");
    assert.equal(first.assignee, "ai");
    assert.equal(first.layer, "0");
    assert.deepEqual(first.files, [
      "apps/mobile/**",
      "apps/mobile/app.json",
      "apps/mobile/package.json",
    ]);
    assert.match(first.acceptance, /Expo Router as the navigation foundation/);
    assert.match(first.acceptance, /NativeWind configured/);
    assert.deepEqual(first.skills, ["expo-router-nativewind", "mobile-app-agent"]);
    assert.deepEqual(first.depends, []);
    assert.equal(first.notes, "");
    assert.equal(first.sourceFile, file);
    assert.equal(first.headingLine, 7);

    assert.equal(second.id, "T-804011");
    assert.equal(second.status, "blocked");
    assert.deepEqual(second.depends, ["T-13ab58"]);
    assert.match(second.notes, /free-form notes about SDK version choice/);
    assert.match(second.notes, /span multiple lines/);
  });
});

test("parseTaskFile is robust to tasks that omit optional fields", () => {
  withTempDir((dir) => {
    const file = join(dir, "layer-refinement-todo.md");
    writeFileSync(
      file,
      `### T-a463b5 — Minimal task with only required fields\n- **Status:** todo\n- **Assignee:** human\n`,
      "utf8",
    );

    const tasks = parseTaskFile(file);
    assert.equal(tasks.length, 1);
    const [task] = tasks;

    assert.equal(task.id, "T-a463b5");
    assert.equal(task.status, "todo");
    assert.equal(task.assignee, "human");
    assert.equal(task.layer, "refinement");
    assert.deepEqual(task.files, []);
    assert.equal(task.acceptance, "");
    assert.deepEqual(task.skills, []);
    assert.deepEqual(task.depends, []);
    assert.equal(task.notes, "");
  });
});

test("parseTaskFile throws when a required field is missing", () => {
  withTempDir((dir) => {
    const file = join(dir, "layer-0-todo.md");
    writeFileSync(
      file,
      `### T-f5834d — Task missing Assignee\n- **Status:** todo\n`,
      "utf8",
    );
    assert.throws(() => parseTaskFile(file), /missing required Assignee/);
  });
});

test("parseTasksDir returns tasks from every *.md file in the directory", () => {
  withTempDir((dir) => {
    writeFileSync(join(dir, "layer-0-todo.md"), SAMPLE_MULTI_TASK, "utf8");
    writeFileSync(
      join(dir, "done.md"),
      `# Done\n\n### T-9f7994 — Already finished task\n- **Status:** done\n- **Assignee:** ai\n`,
      "utf8",
    );
    writeFileSync(join(dir, "README.txt"), "not a task file", "utf8");

    const tasks = parseTasksDir(dir);
    const ids = tasks.map((t) => t.id).sort();
    assert.deepEqual(ids, ["T-13ab58", "T-804011", "T-9f7994"]);

    const done = tasks.find((t) => t.id === "T-9f7994")!;
    assert.equal(done.status, "done");
    assert.equal(done.layer, "done");
  });
});

test("patchTask changes only the target Status/Assignee line, byte for byte elsewhere", () => {
  withTempDir((dir) => {
    const file = join(dir, "layer-0-todo.md");
    writeFileSync(file, SAMPLE_MULTI_TASK, "utf8");
    const before = readFileSync(file, "utf8");

    patchTask(file, "T-804011", { status: "ready", assignee: "human" });
    const after = readFileSync(file, "utf8");

    assert.notEqual(after, before);

    const beforeLines = before.split("\n");
    const afterLines = after.split("\n");
    assert.equal(beforeLines.length, afterLines.length);

    const changedLines: number[] = [];
    for (let i = 0; i < beforeLines.length; i++) {
      if (beforeLines[i] !== afterLines[i]) changedLines.push(i);
    }

    // Only the Status and Assignee lines of T-804011 should differ.
    assert.equal(changedLines.length, 2);
    for (const i of changedLines) {
      assert.match(afterLines[i], /^- \*\*(Status|Assignee):\*\*/);
    }
    assert.match(afterLines[changedLines[0]], /ready|human/);

    // The other task (T-13ab58) and every other line must be untouched.
    const reparsed = parseTaskFile(file);
    const untouched = reparsed.find((t) => t.id === "T-13ab58")!;
    assert.equal(untouched.status, "todo");
    assert.equal(untouched.assignee, "ai");

    const patched = reparsed.find((t) => t.id === "T-804011")!;
    assert.equal(patched.status, "ready");
    assert.equal(patched.assignee, "human");
  });
});

test("patchTask with the same status/assignee is a byte-for-byte no-op", () => {
  withTempDir((dir) => {
    const file = join(dir, "layer-0-todo.md");
    writeFileSync(file, SAMPLE_MULTI_TASK, "utf8");
    const before = readFileSync(file, "utf8");

    patchTask(file, "T-13ab58", { status: "todo", assignee: "ai" });

    const after = readFileSync(file, "utf8");
    assert.equal(after, before);
  });
});

test("patchTask throws for an unknown task id", () => {
  withTempDir((dir) => {
    const file = join(dir, "layer-0-todo.md");
    writeFileSync(file, SAMPLE_MULTI_TASK, "utf8");
    assert.throws(() => patchTask(file, "T-ffffff", { status: "done" }), /not found/);
  });
});

test("parseTaskFile ignores schema examples inside fenced code blocks and HTML comments", () => {
  withTempDir((dir) => {
    const file = join(dir, "layer-0-todo.md");
    writeFileSync(
      file,
      [
        "# Layer 0",
        "",
        "Documented format:",
        "",
        "```markdown",
        "### T-a3f9c1 — <title>",
        "- **Status:** todo",
        "- **Assignee:** ai",
        "```",
        "",
        "<!--",
        "### T-b3f9c1 — another example",
        "- **Status:** todo",
        "- **Assignee:** ai",
        "-->",
        "",
        "---",
        "",
        "### T-13ab58 — Real task",
        "- **Status:** todo",
        "- **Assignee:** ai",
        "",
      ].join("\n"),
      "utf8",
    );

    const tasks = parseTaskFile(file);
    assert.deepEqual(
      tasks.map((t) => t.id),
      ["T-13ab58"],
    );
  });
});

test("STATUSES exposes the full status union in schema order", () => {
  assert.deepEqual(STATUSES, ["todo", "ready", "in-progress", "blocked", "review", "done"]);
});
