// Opt-in autonomous task runner for the board.
//
// When ARMED (only possible when the server is started auto-capable, i.e.
// `pnpm board:auto`), the runner watches for tasks that are `Status: ready`
// + `Assignee: ai` with satisfied `Depends`, and for each one:
//   1. marks it `in-progress` in its source tasks/*.md file,
//   2. creates an ISOLATED git worktree on a fresh `auto/<id>` branch off HEAD,
//   3. spawns a headless `claude` run (args array — never a shell string)
//      scoped to that worktree to implement ONLY that task, TDD,
//   4. on success sets it `review` (a human reviews + merges), on
//      failure/timeout sets it `blocked`.
//
// It NEVER pushes and NEVER merges — there is deliberately no `git push` or
// `git merge` anywhere in this file. Containment is the whole point:
//   - off by default; a plain `pnpm board` constructs the runner with
//     `available:false`, so it can never arm and never spawns anything.
//   - each run is confined to its own worktree/branch; nothing lands on the
//     current branch without a human merging it.
//   - hard per-task timeout + turn cap; on exceed the child is killed and the
//     task is marked `blocked`.
//
// The `claude` binary is injectable via BOARD_CLAUDE_BIN so this is testable
// with a stub (see runner.test.ts) without any real Claude run.

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseTasksDir, patchTask } from "./lib/tasks.ts";
import type { Task } from "./lib/tasks.ts";

/** A task id is exactly `T-` followed by 6 lowercase hex chars. Validated
 * before it is ever used to build a branch name or worktree path. */
export const TASK_ID_RE = /^T-[0-9a-f]{6}$/;

export interface RunnerConfig {
  /** Command to spawn per task. Default "claude"; override via BOARD_CLAUDE_BIN. */
  claudeBin: string;
  /** Max tasks running at once. Default 2. */
  maxConcurrent: number;
  /** Hard per-task wall-clock timeout in ms; on exceed the child is killed
   * and the task is set `blocked`. Default 15 min. This is the
   * version-independent containment guarantee. */
  timeoutMs: number;
  /** `--permission-mode` passed to claude. Default "bypassPermissions" so the
   * headless run doesn't hang on prompts — contained to the worktree cwd, and
   * the repo's PreToolUse hooks (e.g. block-build-output) still apply. */
  permissionMode: string;
  /** Turn/cost cap args. Default `--max-turns <n>` (the documented SDK flag).
   * NOTE: some installed builds expose `--max-budget-usd` instead and reject
   * `--max-turns`; override via BOARD_CLAUDE_LIMIT_ARGS in that case. */
  limitArgs: string[];
  /** Extra operator-supplied claude args, appended verbatim. */
  extraArgs: string[];
  /** Base dir for per-task worktrees (gitignored). */
  worktreeDir: string;
}

function envInt(name: string, def: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return def;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}
function envStr(name: string, def: string): string {
  const raw = process.env[name];
  return raw !== undefined && raw.trim() !== "" ? raw : def;
}
function envArgs(name: string, def: string[]): string[] {
  const raw = process.env[name];
  if (raw === undefined) return def;
  const trimmed = raw.trim();
  return trimmed === "" ? [] : trimmed.split(/\s+/);
}

export function runnerConfigFromEnv(repoRoot: string): RunnerConfig {
  const maxTurns = envInt("BOARD_MAX_TURNS", 25);
  return {
    claudeBin: envStr("BOARD_CLAUDE_BIN", "claude"),
    maxConcurrent: envInt("BOARD_MAX_CONCURRENT", 2),
    timeoutMs: envInt("BOARD_TASK_TIMEOUT_MS", 15 * 60 * 1000),
    permissionMode: envStr("BOARD_PERMISSION_MODE", "bypassPermissions"),
    limitArgs: envArgs("BOARD_CLAUDE_LIMIT_ARGS", ["--max-turns", String(maxTurns)]),
    extraArgs: envArgs("BOARD_CLAUDE_EXTRA_ARGS", []),
    worktreeDir: join(repoRoot, ".board-worktrees"),
  };
}

/** Runs `git` (or, in tests, a fake) to manage per-task worktrees. No push,
 * no merge — only add/remove of an isolated worktree + its `auto/<id>` branch. */
export interface WorktreeManager {
  /** Create worktree + `auto/<id>` branch off HEAD; resolves to the worktree path. */
  create(id: string): Promise<string>;
  /** Remove the worktree (best-effort). */
  removeWorktree(id: string): Promise<void>;
  /** Delete the `auto/<id>` branch (best-effort). */
  removeBranch(id: string): Promise<void>;
}

function runGit(repoRoot: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["-C", repoRoot, ...args], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`git ${args.join(" ")} exited ${code}: ${stderr.trim()}`));
    });
  });
}

export class GitWorktreeManager implements WorktreeManager {
  constructor(
    private readonly repoRoot: string,
    private readonly baseDir: string,
  ) {}

  private pathFor(id: string): string {
    return join(this.baseDir, id);
  }
  private branchFor(id: string): string {
    return `auto/${id}`;
  }

  async create(id: string): Promise<string> {
    if (!TASK_ID_RE.test(id)) throw new Error(`refusing worktree for invalid id "${id}"`);
    mkdirSync(this.baseDir, { recursive: true });
    const path = this.pathFor(id);
    const branch = this.branchFor(id);
    try {
      await runGit(this.repoRoot, ["worktree", "add", "-b", branch, path, "HEAD"]);
    } catch (err) {
      // A stale worktree/branch from a previous run can block re-creation.
      // Prune + best-effort cleanup, then retry once.
      await runGit(this.repoRoot, ["worktree", "prune"]).catch(() => {});
      await this.removeWorktree(id);
      await this.removeBranch(id);
      await runGit(this.repoRoot, ["worktree", "add", "-b", branch, path, "HEAD"]).catch(
        () => {
          throw err;
        },
      );
    }
    return path;
  }

  async removeWorktree(id: string): Promise<void> {
    if (!TASK_ID_RE.test(id)) return;
    await runGit(this.repoRoot, ["worktree", "remove", "--force", this.pathFor(id)]).catch(
      () => {},
    );
  }

  async removeBranch(id: string): Promise<void> {
    if (!TASK_ID_RE.test(id)) return;
    await runGit(this.repoRoot, ["branch", "-D", this.branchFor(id)]).catch(() => {});
  }
}

export type RunResult = "review" | "blocked";

export type RunnerEvent =
  | { kind: "state" }
  | { kind: "run-start"; id: string; branch: string; worktree: string }
  | { kind: "run-log"; id: string; message: string }
  | { kind: "run-end"; id: string; result: RunResult; reason?: string };

export interface RunnerState {
  available: boolean;
  armed: boolean;
  running: string[];
  config: {
    maxConcurrent: number;
    timeoutMs: number;
    permissionMode: string;
    claudeBin: string;
  };
}

interface RunHandle {
  id: string;
  files: string[];
  branch: string;
  worktree: string | null;
  child: ChildProcess | null;
  timer: ReturnType<typeof setTimeout> | null;
  timedOut: boolean;
  finished: boolean;
  stdoutBuf: string;
}

export interface RunnerOptions {
  /** Autonomous capability. FALSE for a plain `pnpm board` — the runner is then
   * fully inert (never arms, never spawns). */
  available: boolean;
  repoRoot: string;
  tasksDir: string;
  config: RunnerConfig;
  onEvent: (evt: RunnerEvent) => void;
  /** Injectable for tests; defaults to a real GitWorktreeManager. */
  worktrees?: WorktreeManager;
  /** Injectable for tests; defaults to parseTasksDir(tasksDir). */
  parseTasks?: () => Task[];
}

export function dependenciesSatisfied(task: Task, tasks: Task[]): boolean {
  if (task.depends.length === 0) return true;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return task.depends.every((dep) => byId.get(dep)?.status === "done");
}

function layerRank(layer: string): number {
  if (/^\d+$/.test(layer)) return Number(layer);
  if (layer === "refinement") return 1e6;
  return 1e6 + 1;
}

/**
 * Pure selection: given the current tasks and what's already running, return
 * the tasks that may start this round — `ready` + `ai` + valid id + satisfied
 * Depends, ordered by layer then id, limited to the free concurrency slots,
 * and Files-disjoint from both running tasks and each other.
 */
export function selectEligibleTasks(
  tasks: Task[],
  opts: { runningIds: Set<string>; runningFiles: Set<string>; maxConcurrent: number },
): Task[] {
  const slots = opts.maxConcurrent - opts.runningIds.size;
  if (slots <= 0) return [];

  const eligible = tasks
    .filter(
      (t) =>
        t.status === "ready" &&
        t.assignee === "ai" &&
        TASK_ID_RE.test(t.id) &&
        !opts.runningIds.has(t.id) &&
        dependenciesSatisfied(t, tasks),
    )
    .sort((a, b) => layerRank(a.layer) - layerRank(b.layer) || a.id.localeCompare(b.id));

  const usedFiles = new Set(opts.runningFiles);
  const selected: Task[] = [];
  for (const t of eligible) {
    if (selected.length >= slots) break;
    if (t.files.some((f) => usedFiles.has(f))) continue;
    selected.push(t);
    for (const f of t.files) usedFiles.add(f);
  }
  return selected;
}

function buildPrompt(task: Task): string {
  const files = task.files.length ? task.files.join(", ") : "(none listed)";
  const skills = task.skills.length ? task.skills.join(", ") : "(none)";
  return [
    `You are implementing exactly ONE task from this repo's task board, in an`,
    `isolated git worktree. Implement ONLY this task and nothing else.`,
    ``,
    `Task ${task.id}: ${task.title}`,
    `Files you may touch: ${files}`,
    `Acceptance criteria:`,
    task.acceptance || "(none specified)",
    `Relevant skills to load first: ${skills}`,
    ``,
    `Rules:`,
    `- Work TDD: write a failing test first, then the minimum code to pass it.`,
    `- Stay strictly within the files listed above; if you need more, stop and`,
    `  explain instead of expanding scope.`,
    `- Do NOT run heavy mobile builds (eas build, expo run:*, gradlew, pod`,
    `  install, xcodebuild) — the block-build-output hook will reject them.`,
    `- Do NOT push and do NOT merge; just commit your work on this branch when`,
    `  the tests pass, with a conventional commit message.`,
  ].join("\n");
}

function truncate(s: string, n = 200): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n)}…` : flat;
}

/** Turn one stream-json stdout line into a compact human progress string, or
 * null if it carries nothing worth surfacing. */
export function compactProgress(line: string): string | null {
  let obj: unknown;
  try {
    obj = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof obj !== "object" || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const type = o["type"];
  if (type === "system" && o["subtype"] === "init") return "session started";
  if (type === "result") {
    const sub = o["subtype"];
    return `result: ${typeof sub === "string" ? sub : "done"}`;
  }
  if (type === "assistant") {
    const msg = o["message"];
    const content =
      typeof msg === "object" && msg !== null
        ? (msg as Record<string, unknown>)["content"]
        : undefined;
    if (Array.isArray(content)) {
      const parts: string[] = [];
      for (const c of content) {
        if (typeof c !== "object" || c === null) continue;
        const cc = c as Record<string, unknown>;
        if (cc["type"] === "tool_use" && typeof cc["name"] === "string") {
          parts.push(`tool:${cc["name"]}`);
        } else if (cc["type"] === "text" && typeof cc["text"] === "string") {
          const t = cc["text"].trim();
          if (t) parts.push(truncate(t, 120));
        }
      }
      if (parts.length) return parts.join(" ");
    }
    return "working…";
  }
  return null;
}

export class Runner {
  readonly available: boolean;
  private armed = false;
  private readonly running = new Map<string, RunHandle>();
  private readonly opts: RunnerOptions;
  private readonly worktrees: WorktreeManager;
  private readonly parseTasks: () => Task[];

  constructor(opts: RunnerOptions) {
    this.opts = opts;
    this.available = opts.available;
    this.worktrees =
      opts.worktrees ?? new GitWorktreeManager(opts.repoRoot, opts.config.worktreeDir);
    this.parseTasks = opts.parseTasks ?? (() => parseTasksDir(opts.tasksDir));
  }

  getState(): RunnerState {
    return {
      available: this.available,
      armed: this.armed,
      running: [...this.running.keys()],
      config: {
        maxConcurrent: this.opts.config.maxConcurrent,
        timeoutMs: this.opts.config.timeoutMs,
        permissionMode: this.opts.config.permissionMode,
        claudeBin: this.opts.config.claudeBin,
      },
    };
  }

  /** Arm/disarm. No effect at all when the runner isn't available (plain board). */
  setArmed(enabled: boolean): void {
    if (!this.available) return; // a plain board can never be armed
    if (this.armed === enabled) return;
    this.armed = enabled;
    this.emit({ kind: "state" });
    if (this.armed) this.poke();
  }

  /** Re-evaluate the ready queue and start any newly-eligible tasks. Safe to
   * call often (on arm, on every tasks/*.md change). Inert unless armed. */
  poke(): void {
    if (!this.available || !this.armed) return;
    if (this.running.size >= this.opts.config.maxConcurrent) return;

    let tasks: Task[];
    try {
      tasks = this.parseTasks();
    } catch (err) {
      console.error("runner: failed to parse tasks, skipping this tick:", err);
      return;
    }

    const runningFiles = new Set<string>();
    for (const h of this.running.values()) for (const f of h.files) runningFiles.add(f);

    const selected = selectEligibleTasks(tasks, {
      runningIds: new Set(this.running.keys()),
      runningFiles,
      maxConcurrent: this.opts.config.maxConcurrent,
    });
    if (selected.length === 0) return;

    for (const task of selected) {
      // Reserve the slot synchronously so a re-entrant poke() can't double-pick.
      const handle: RunHandle = {
        id: task.id,
        files: task.files,
        branch: `auto/${task.id}`,
        worktree: null,
        child: null,
        timer: null,
        timedOut: false,
        finished: false,
        stdoutBuf: "",
      };
      this.running.set(task.id, handle);
      void this.runTask(task, handle);
    }
    this.emit({ kind: "state" });
  }

  private async runTask(task: Task, handle: RunHandle): Promise<void> {
    if (!TASK_ID_RE.test(task.id)) {
      this.finish(task, handle, "blocked", `invalid task id "${task.id}"`);
      return;
    }

    try {
      patchTask(task.sourceFile, task.id, { status: "in-progress" });
    } catch (err) {
      this.finish(task, handle, "blocked", `could not set in-progress: ${String(err)}`);
      return;
    }

    let worktree: string;
    try {
      worktree = await this.worktrees.create(task.id);
    } catch (err) {
      this.finish(task, handle, "blocked", `worktree create failed: ${String(err)}`);
      return;
    }
    if (handle.finished) return; // disarmed/shutdown during the await
    handle.worktree = worktree;
    this.emit({ kind: "run-start", id: task.id, branch: handle.branch, worktree });

    const args = [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--permission-mode",
      this.opts.config.permissionMode,
      ...this.opts.config.limitArgs,
      ...this.opts.config.extraArgs,
      buildPrompt(task),
    ];

    let child: ChildProcess;
    try {
      child = spawn(this.opts.config.claudeBin, args, {
        cwd: worktree,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      this.finish(task, handle, "blocked", `spawn failed: ${String(err)}`);
      return;
    }
    handle.child = child;

    handle.timer = setTimeout(() => {
      handle.timedOut = true;
      this.kill(handle);
    }, this.opts.config.timeoutMs);

    child.stdout?.on("data", (d: Buffer) => this.onStdout(task.id, handle, d.toString("utf8")));
    child.stderr?.on("data", (d: Buffer) => {
      const msg = truncate(d.toString("utf8"));
      if (msg) this.emit({ kind: "run-log", id: task.id, message: msg });
    });
    child.on("error", (err) => {
      this.finish(task, handle, "blocked", `spawn error: ${String(err)}`);
    });
    child.on("close", (code) => {
      if (handle.finished) return;
      if (handle.timedOut) {
        this.finish(
          task,
          handle,
          "blocked",
          `timed out after ${this.opts.config.timeoutMs}ms`,
        );
      } else if (code === 0) {
        this.finish(task, handle, "review");
      } else {
        this.finish(task, handle, "blocked", `claude exited with code ${code}`);
      }
    });
  }

  private onStdout(id: string, handle: RunHandle, chunk: string): void {
    handle.stdoutBuf += chunk;
    let idx = handle.stdoutBuf.indexOf("\n");
    while (idx !== -1) {
      const line = handle.stdoutBuf.slice(0, idx).trim();
      handle.stdoutBuf = handle.stdoutBuf.slice(idx + 1);
      if (line) {
        const msg = compactProgress(line);
        if (msg) this.emit({ kind: "run-log", id, message: msg });
      }
      idx = handle.stdoutBuf.indexOf("\n");
    }
  }

  private kill(handle: RunHandle): void {
    const child = handle.child;
    if (!child || child.exitCode !== null) return;
    child.kill("SIGTERM");
    const grace = setTimeout(() => {
      if (child.exitCode === null) child.kill("SIGKILL");
    }, 3000);
    grace.unref();
  }

  private finish(
    task: Task,
    handle: RunHandle,
    result: RunResult,
    reason?: string,
  ): void {
    if (handle.finished) return;
    handle.finished = true;
    if (handle.timer) {
      clearTimeout(handle.timer);
      handle.timer = null;
    }

    try {
      patchTask(task.sourceFile, task.id, { status: result });
    } catch (err) {
      console.error(`runner: failed to set ${task.id} -> ${result}:`, err);
    }

    // blocked = failed work: remove the worktree and its branch. review = keep
    // both so the human can inspect/merge the auto/<id> branch.
    if (result === "blocked") {
      void this.worktrees
        .removeWorktree(task.id)
        .then(() => this.worktrees.removeBranch(task.id))
        .catch(() => {});
    }

    this.running.delete(task.id);
    this.emit({ kind: "run-end", id: task.id, result, reason });
    this.emit({ kind: "state" });
    // A slot just freed — see if anything else is eligible now.
    queueMicrotask(() => this.poke());
  }

  private emit(evt: RunnerEvent): void {
    try {
      this.opts.onEvent(evt);
    } catch (err) {
      console.error("runner: onEvent listener threw:", err);
    }
  }

  /** Stop picking new work and kill any in-flight children. */
  async shutdown(): Promise<void> {
    this.armed = false;
    for (const handle of this.running.values()) {
      handle.finished = true;
      if (handle.timer) clearTimeout(handle.timer);
      const child = handle.child;
      if (child && child.exitCode === null) child.kill("SIGKILL");
    }
    this.running.clear();
  }
}
