import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  chmodSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  Runner,
  selectEligibleTasks,
  dependenciesSatisfied,
  compactProgress,
  TASK_ID_RE,
  runnerConfigFromEnv,
} from "./runner.ts";
import type { RunnerConfig, RunnerEvent, WorktreeManager } from "./runner.ts";
import { parseTasksDir } from "./lib/tasks.ts";
import type { Task, Status, Assignee } from "./lib/tasks.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeTask(partial: Partial<Task> & { id: string }): Task {
  return {
    id: partial.id,
    title: partial.title ?? `Task ${partial.id}`,
    status: partial.status ?? "ready",
    assignee: partial.assignee ?? "ai",
    layer: partial.layer ?? "0",
    files: partial.files ?? [],
    acceptance: partial.acceptance ?? "do the thing",
    skills: partial.skills ?? [],
    depends: partial.depends ?? [],
    notes: partial.notes ?? "",
    sourceFile: partial.sourceFile ?? "/tmp/fake.md",
    headingLine: partial.headingLine ?? 1,
  };
}

/** Renders a task-block file the real parser can round-trip. */
function taskBlock(t: {
  id: string;
  status: Status;
  assignee: Assignee;
  files?: string[];
  depends?: string[];
}): string {
  const lines = [
    `### ${t.id} — ${t.id} title`,
    `- **Status:** ${t.status}`,
    `- **Assignee:** ${t.assignee}`,
    `- **Files:** ${(t.files ?? []).join(", ")}`,
    `- **Acceptance:** implement ${t.id}`,
  ];
  if (t.depends && t.depends.length) lines.push(`- **Depends:** ${t.depends.join(", ")}`);
  return lines.join("\n") + "\n";
}

function writeTasksFile(
  dir: string,
  filename: string,
  blocks: Parameters<typeof taskBlock>[0][],
): void {
  const body = `# Layer 0\n\n${blocks.map(taskBlock).join("\n---\n\n")}`;
  writeFileSync(join(dir, filename), body, "utf8");
}

function makeStub(exitCode: number, delayMs = 0): string {
  const dir = mkdtempSync(join(tmpdir(), "board-stub-"));
  const path = join(dir, exitCode === 0 ? "claude-ok.sh" : "claude-fail.sh");
  const sleep = delayMs > 0 ? `sleep ${(delayMs / 1000).toFixed(3)}\n` : "";
  const script =
    `#!/bin/sh\n` +
    `printf '%s\\n' '{"type":"system","subtype":"init"}'\n` +
    sleep +
    `printf '%s\\n' '{"type":"result","subtype":"success","is_error":false}'\n` +
    `exit ${exitCode}\n`;
  writeFileSync(path, script, "utf8");
  chmodSync(path, 0o755);
  return path;
}

/** Fake worktree manager: no git, just records calls and hands back temp dirs. */
class FakeWorktrees implements WorktreeManager {
  created: string[] = [];
  removedWorktrees: string[] = [];
  removedBranches: string[] = [];
  private dirs = new Map<string, string>();

  create(id: string): Promise<string> {
    this.created.push(id);
    const d = mkdtempSync(join(tmpdir(), `board-wt-${id}-`));
    this.dirs.set(id, d);
    return Promise.resolve(d);
  }
  removeWorktree(id: string): Promise<void> {
    this.removedWorktrees.push(id);
    const d = this.dirs.get(id);
    if (d) rmSync(d, { recursive: true, force: true });
    return Promise.resolve();
  }
  removeBranch(id: string): Promise<void> {
    this.removedBranches.push(id);
    return Promise.resolve();
  }
  reconcileCalls = 0;
  reconcile(): Promise<void> {
    this.reconcileCalls++;
    return Promise.resolve();
  }
}

function testConfig(claudeBin: string, over: Partial<RunnerConfig> = {}): RunnerConfig {
  return {
    claudeBin,
    maxConcurrent: 2,
    timeoutMs: 5000,
    permissionMode: "bypassPermissions",
    limitArgs: [],
    extraArgs: [],
    worktreeDir: join(tmpdir(), "unused-worktree-dir"),
    ...over,
  };
}

async function withTasksDir<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "board-runner-tasks-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function waitFor(
  predicate: () => boolean,
  { timeoutMs = 8000, intervalMs = 20 } = {},
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function statusOf(dir: string, id: string): Status | undefined {
  return parseTasksDir(dir).find((t) => t.id === id)?.status;
}

// ---------------------------------------------------------------------------
// pure selection logic
// ---------------------------------------------------------------------------

test("TASK_ID_RE only accepts T- + 6 lowercase hex", () => {
  assert.ok(TASK_ID_RE.test("T-13ab58"));
  assert.ok(!TASK_ID_RE.test("T-13AB58"));
  assert.ok(!TASK_ID_RE.test("T-13ab5"));
  assert.ok(!TASK_ID_RE.test("T-13ab58x"));
  assert.ok(!TASK_ID_RE.test("../etc"));
});

test("selectEligibleTasks: only ready + ai + valid id are eligible", () => {
  const tasks = [
    makeTask({ id: "T-aaaaaa", status: "ready", assignee: "ai" }),
    makeTask({ id: "T-bbbbbb", status: "todo", assignee: "ai" }),
    makeTask({ id: "T-cccccc", status: "ready", assignee: "human" }),
    makeTask({ id: "T-dddddd", status: "in-progress", assignee: "ai" }),
    makeTask({ id: "T-eeeeee", status: "done", assignee: "ai" }),
    makeTask({ id: "T-BADID", status: "ready", assignee: "ai" }),
  ];
  const selected = selectEligibleTasks(tasks, {
    runningIds: new Set(),
    runningFiles: new Set(),
    runningExclusive: false,
    maxConcurrent: 10,
  });
  assert.deepEqual(
    selected.map((t) => t.id),
    ["T-aaaaaa"],
  );
});

test("dependenciesSatisfied: dep must be done", () => {
  const dep = makeTask({ id: "T-000001", status: "review" });
  const dependent = makeTask({ id: "T-000002", depends: ["T-000001"] });
  assert.equal(dependenciesSatisfied(dependent, [dep, dependent]), false);

  const depDone = makeTask({ id: "T-000001", status: "done" });
  assert.equal(dependenciesSatisfied(dependent, [depDone, dependent]), true);

  // Missing dep is treated as unsatisfied.
  assert.equal(dependenciesSatisfied(dependent, [dependent]), false);
});

test("selectEligibleTasks: unsatisfied Depends excludes the task", () => {
  const tasks = [
    makeTask({ id: "T-000001", status: "ready", assignee: "ai" }),
    makeTask({ id: "T-000002", status: "ready", assignee: "ai", depends: ["T-000001"] }),
  ];
  const selected = selectEligibleTasks(tasks, {
    runningIds: new Set(),
    runningFiles: new Set(),
    runningExclusive: false,
    maxConcurrent: 10,
  });
  // T-000002 depends on T-000001 which isn't done -> only T-000001 runs.
  assert.deepEqual(
    selected.map((t) => t.id),
    ["T-000001"],
  );
});

test("selectEligibleTasks: concurrency cap + Files-disjoint", () => {
  const tasks = [
    makeTask({ id: "T-aaaaaa", files: ["x"] }),
    makeTask({ id: "T-bbbbbb", files: ["y"] }),
    makeTask({ id: "T-cccccc", files: ["x"] }),
  ];
  // 2 slots: A(x) and B(y) are disjoint -> both; C(x) collides with A -> excluded.
  const selected = selectEligibleTasks(tasks, {
    runningIds: new Set(),
    runningFiles: new Set(),
    runningExclusive: false,
    maxConcurrent: 2,
  });
  assert.deepEqual(
    selected.map((t) => t.id),
    ["T-aaaaaa", "T-bbbbbb"],
  );

  // With A already running (holding "x"), C is still blocked by the file clash.
  const selected2 = selectEligibleTasks(tasks, {
    runningIds: new Set(["T-aaaaaa"]),
    runningFiles: new Set(["x"]),
    runningExclusive: false,
    maxConcurrent: 2,
  });
  assert.deepEqual(
    selected2.map((t) => t.id),
    ["T-bbbbbb"],
  );
});

test("selectEligibleTasks: an empty-Files task is exclusive (runs alone)", () => {
  const tasks = [
    makeTask({ id: "T-aaaaaa", files: [] }), // exclusive
    makeTask({ id: "T-bbbbbb", files: ["y"] }),
    makeTask({ id: "T-cccccc", files: [] }), // exclusive
  ];

  // Idle board, cap 2: the first (exclusive) task claims the whole round alone.
  const selected = selectEligibleTasks(tasks, {
    runningIds: new Set(),
    runningFiles: new Set(),
    runningExclusive: false,
    maxConcurrent: 2,
  });
  assert.deepEqual(
    selected.map((t) => t.id),
    ["T-aaaaaa"],
  );

  // An empty-Files task cannot start while anything else is running.
  const whileBusy = selectEligibleTasks(tasks, {
    runningIds: new Set(["T-bbbbbb"]),
    runningFiles: new Set(["y"]),
    runningExclusive: false,
    maxConcurrent: 2,
  });
  assert.deepEqual(
    whileBusy.map((t) => t.id),
    [], // T-aaaaaa/T-cccccc are exclusive; nothing else is eligible
  );

  // While an exclusive task is running, nothing new starts at all.
  const whileExclusive = selectEligibleTasks(tasks, {
    runningIds: new Set(["T-aaaaaa"]),
    runningFiles: new Set(),
    runningExclusive: true,
    maxConcurrent: 2,
  });
  assert.deepEqual(whileExclusive, []);
});

test("selectEligibleTasks: a non-exclusive task selected first blocks a later exclusive one", () => {
  const tasks = [
    makeTask({ id: "T-aaaaaa", files: ["x"] }),
    makeTask({ id: "T-bbbbbb", files: [] }), // exclusive, sorts after by id
  ];
  const selected = selectEligibleTasks(tasks, {
    runningIds: new Set(),
    runningFiles: new Set(),
    runningExclusive: false,
    maxConcurrent: 2,
  });
  // A is picked first; the exclusive B can't join a round that already has work.
  assert.deepEqual(
    selected.map((t) => t.id),
    ["T-aaaaaa"],
  );
});

test("compactProgress parses stream-json lines and ignores junk", () => {
  assert.equal(compactProgress('{"type":"system","subtype":"init"}'), "session started");
  assert.equal(
    compactProgress('{"type":"result","subtype":"success"}'),
    "result: success",
  );
  assert.equal(
    compactProgress(
      '{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Edit"}]}}',
    ),
    "tool:Edit",
  );
  assert.equal(compactProgress("not json"), null);
});

// ---------------------------------------------------------------------------
// Runner lifecycle (real spawn of a stub claude, fake worktrees)
// ---------------------------------------------------------------------------

test("Runner: ready+ai task goes in-progress -> review on stub success", async () => {
  await withTasksDir(async (dir) => {
    writeTasksFile(dir, "layer-0-todo.md", [
      { id: "T-aaaaaa", status: "ready", assignee: "ai", files: ["a"] },
    ]);
    const worktrees = new FakeWorktrees();
    const events: RunnerEvent[] = [];
    const runner = new Runner({
      available: true,
      repoRoot: dir,
      tasksDir: dir,
      config: testConfig(makeStub(0, 50)),
      onEvent: (e) => events.push(e),
      worktrees,
    });

    runner.setArmed(true);
    await waitFor(() => statusOf(dir, "T-aaaaaa") === "review");

    assert.deepEqual(worktrees.created, ["T-aaaaaa"]);
    assert.ok(events.some((e) => e.kind === "run-start" && e.id === "T-aaaaaa"));
    assert.ok(
      events.some((e) => e.kind === "run-end" && e.id === "T-aaaaaa" && e.result === "review"),
    );
    // review keeps the worktree/branch for the human.
    assert.deepEqual(worktrees.removedWorktrees, []);
    await runner.shutdown();
  });
});

test("Runner: stub failure -> blocked, worktree + branch removed", async () => {
  await withTasksDir(async (dir) => {
    writeTasksFile(dir, "layer-0-todo.md", [
      { id: "T-bbbbbb", status: "ready", assignee: "ai", files: ["b"] },
    ]);
    const worktrees = new FakeWorktrees();
    const events: RunnerEvent[] = [];
    const runner = new Runner({
      available: true,
      repoRoot: dir,
      tasksDir: dir,
      config: testConfig(makeStub(1)),
      onEvent: (e) => events.push(e),
      worktrees,
    });

    runner.setArmed(true);
    await waitFor(() => statusOf(dir, "T-bbbbbb") === "blocked");

    assert.ok(
      events.some(
        (e) => e.kind === "run-end" && e.id === "T-bbbbbb" && e.result === "blocked",
      ),
    );
    await waitFor(() => worktrees.removedWorktrees.includes("T-bbbbbb"));
    assert.ok(worktrees.removedBranches.includes("T-bbbbbb"));
    await runner.shutdown();
  });
});

test("Runner: respects concurrency cap and never runs Files-clashing tasks together", async () => {
  await withTasksDir(async (dir) => {
    // A(x), B(y), C(x) with cap 2: A+B run together, C waits for A to free "x".
    writeTasksFile(dir, "layer-0-todo.md", [
      { id: "T-aaaaaa", status: "ready", assignee: "ai", files: ["x"] },
      { id: "T-bbbbbb", status: "ready", assignee: "ai", files: ["y"] },
      { id: "T-cccccc", status: "ready", assignee: "ai", files: ["x"] },
    ]);
    const worktrees = new FakeWorktrees();
    const active = new Set<string>();
    let maxActive = 0;
    let aAndCEverConcurrent = false;

    const runner = new Runner({
      available: true,
      repoRoot: dir,
      tasksDir: dir,
      config: testConfig(makeStub(0, 120), { maxConcurrent: 2 }),
      onEvent: (e) => {
        if (e.kind === "run-start") active.add(e.id);
        if (e.kind === "run-end") active.delete(e.id);
        maxActive = Math.max(maxActive, active.size);
        if (active.has("T-aaaaaa") && active.has("T-cccccc")) aAndCEverConcurrent = true;
      },
      worktrees,
    });

    runner.setArmed(true);
    await waitFor(
      () =>
        statusOf(dir, "T-aaaaaa") === "review" &&
        statusOf(dir, "T-bbbbbb") === "review" &&
        statusOf(dir, "T-cccccc") === "review",
    );

    assert.ok(maxActive <= 2, `maxActive was ${maxActive}`);
    assert.equal(aAndCEverConcurrent, false, "A and C share a file and must not overlap");
    await runner.shutdown();
  });
});

test("Runner: empty-Files tasks are serialized, never run concurrently", async () => {
  await withTasksDir(async (dir) => {
    writeTasksFile(dir, "layer-0-todo.md", [
      { id: "T-aaaaaa", status: "ready", assignee: "ai", files: [] },
      { id: "T-bbbbbb", status: "ready", assignee: "ai", files: [] },
    ]);
    const worktrees = new FakeWorktrees();
    const active = new Set<string>();
    let maxActive = 0;
    const runner = new Runner({
      available: true,
      repoRoot: dir,
      tasksDir: dir,
      config: testConfig(makeStub(0, 100), { maxConcurrent: 2 }),
      onEvent: (e) => {
        if (e.kind === "run-start") active.add(e.id);
        if (e.kind === "run-end") active.delete(e.id);
        maxActive = Math.max(maxActive, active.size);
      },
      worktrees,
    });

    runner.setArmed(true);
    await waitFor(
      () =>
        statusOf(dir, "T-aaaaaa") === "review" && statusOf(dir, "T-bbbbbb") === "review",
    );

    // Even with 2 free slots, the two exclusive (empty-Files) tasks never overlap.
    assert.equal(maxActive, 1, `empty-Files tasks overlapped (maxActive=${maxActive})`);
    await runner.shutdown();
  });
});

test("Runner: a task that exceeds its timeout is killed and blocked", async () => {
  await withTasksDir(async (dir) => {
    writeTasksFile(dir, "layer-0-todo.md", [
      { id: "T-aaaaaa", status: "ready", assignee: "ai", files: ["a"] },
    ]);
    const worktrees = new FakeWorktrees();
    const events: RunnerEvent[] = [];
    const runner = new Runner({
      available: true,
      repoRoot: dir,
      tasksDir: dir,
      config: testConfig(makeStub(0, 4000), { timeoutMs: 250 }),
      onEvent: (e) => events.push(e),
      worktrees,
    });

    runner.setArmed(true);
    await waitFor(() => statusOf(dir, "T-aaaaaa") === "blocked", { timeoutMs: 10000 });

    const end = events.find((e) => e.kind === "run-end" && e.id === "T-aaaaaa");
    assert.ok(end && end.kind === "run-end" && end.result === "blocked");
    assert.match(String(end.reason), /timed out/);
    await runner.shutdown();
  });
});

test("Runner: reconcile runs on construction only when available", async () => {
  await withTasksDir(async (dir) => {
    const wtAvail = new FakeWorktrees();
    new Runner({
      available: true,
      repoRoot: dir,
      tasksDir: dir,
      config: testConfig("/bin/true"),
      onEvent: () => {},
      worktrees: wtAvail,
    });
    assert.equal(wtAvail.reconcileCalls, 1);

    const wtPlain = new FakeWorktrees();
    new Runner({
      available: false,
      repoRoot: dir,
      tasksDir: dir,
      config: testConfig("/bin/true"),
      onEvent: () => {},
      worktrees: wtPlain,
    });
    assert.equal(wtPlain.reconcileCalls, 0);
  });
});

test("Runner: disarming halts new picks", async () => {
  await withTasksDir(async (dir) => {
    writeTasksFile(dir, "layer-0-todo.md", [
      { id: "T-aaaaaa", status: "ready", assignee: "ai", files: ["a"] },
    ]);
    const worktrees = new FakeWorktrees();
    const events: RunnerEvent[] = [];
    const runner = new Runner({
      available: true,
      repoRoot: dir,
      tasksDir: dir,
      config: testConfig(makeStub(0, 30)),
      onEvent: (e) => events.push(e),
      worktrees,
    });

    // Arm -> the first task is picked up and completed.
    runner.setArmed(true);
    await waitFor(() => statusOf(dir, "T-aaaaaa") === "review");

    // Disarm, then introduce a brand-new ready task and poke repeatedly.
    runner.setArmed(false);
    writeTasksFile(dir, "layer-1-todo.md", [
      { id: "T-bbbbbb", status: "ready", assignee: "ai", files: ["b"] },
    ]);
    runner.poke();
    await new Promise((r) => setTimeout(r, 150));

    // The new task is never picked up while disarmed.
    assert.equal(statusOf(dir, "T-bbbbbb"), "ready");
    assert.deepEqual(worktrees.created, ["T-aaaaaa"]);
    assert.ok(!events.some((e) => e.kind === "run-start" && e.id === "T-bbbbbb"));
    await runner.shutdown();
  });
});

test("Runner: a plain (non-available) runner never arms and never spawns", async () => {
  await withTasksDir(async (dir) => {
    writeTasksFile(dir, "layer-0-todo.md", [
      { id: "T-aaaaaa", status: "ready", assignee: "ai", files: ["a"] },
    ]);
    const worktrees = new FakeWorktrees();
    const events: RunnerEvent[] = [];
    const runner = new Runner({
      available: false,
      repoRoot: dir,
      tasksDir: dir,
      config: testConfig(makeStub(0)),
      onEvent: (e) => events.push(e),
      worktrees,
    });

    runner.setArmed(true); // must be a no-op
    runner.poke();
    await new Promise((r) => setTimeout(r, 150));

    const st = runner.getState();
    assert.equal(st.available, false);
    assert.equal(st.armed, false);
    assert.deepEqual(st.running, []);
    assert.deepEqual(worktrees.created, []);
    assert.equal(statusOf(dir, "T-aaaaaa"), "ready");
    assert.ok(!events.some((e) => e.kind === "run-start"));
    await runner.shutdown();
  });
});

test("runnerConfigFromEnv: sensible defaults + worktree dir under repo root", () => {
  const cfg = runnerConfigFromEnv("/repo/root");
  assert.equal(cfg.maxConcurrent, 2);
  assert.equal(cfg.timeoutMs, 15 * 60 * 1000);
  assert.equal(cfg.worktreeDir, join("/repo/root", ".board-worktrees"));
  assert.ok(cfg.claudeBin.length > 0);
});
