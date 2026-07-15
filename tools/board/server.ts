// Realtime task-dashboard server.
//
// Serves the kanban UI (ui/index.html), a JSON snapshot of tasks/*.md
// (GET /api/tasks), a Status/Assignee PATCH endpoint used by drag-and-drop,
// and a WebSocket channel that rebroadcasts the task list whenever
// tasks/*.md changes on disk — the realtime AI-writes-a-task-file -> board
// updates channel described in tools/board/README.md.
//
// No build step: run directly via `tsx server.ts` (see package.json "start").

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { WebSocketServer, WebSocket } from "ws";
import chokidar from "chokidar";
import {
  parseTasksDir,
  patchTask,
  STATUSES,
  ASSIGNEES,
} from "./lib/tasks.ts";
import type { Status, Assignee, Task } from "./lib/tasks.ts";
import { Runner, runnerConfigFromEnv } from "./runner.ts";
import type { RunnerEvent } from "./runner.ts";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

/** Walk up from this file until we find a directory containing `tasks/` —
 * makes the server location-independent of exactly where the repo checks
 * this package out (still a single monorepo, but robust to future moves). */
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, "tasks"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find a "tasks/" directory walking up from ${startDir}`,
      );
    }
    dir = parent;
  }
}

const repoRoot = findRepoRoot(__dirname);
const tasksDir = join(repoRoot, "tasks");
const uiPath = join(__dirname, "ui", "index.html");
const sortablePath = require.resolve("sortablejs/Sortable.min.js");

/** Display name for this board: the root package.json "name", else the
 * repo-root directory basename. Lets several boards be told apart at a glance. */
function resolveProjectName(root: string): string {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      name?: unknown;
    };
    if (typeof pkg.name === "string" && pkg.name.trim() !== "") return pkg.name;
  } catch {
    /* fall through to the directory basename */
  }
  return basename(root);
}
const projectName = resolveProjectName(repoRoot);

const HOST = "127.0.0.1";
const MAX_BODY_BYTES = 64 * 1024;

// Port resolution: an explicit BOARD_PORT is honored strictly (EADDRINUSE ->
// clear error + exit). With no BOARD_PORT we start at DEFAULT_PORT and, if it's
// busy, auto-advance up to MAX_AUTO_PORT so several project boards can run at
// once without colliding.
const DEFAULT_PORT = 4319;
const MAX_AUTO_PORT = 4339;
const envPortRaw = process.env.BOARD_PORT;
const envPort =
  envPortRaw !== undefined && envPortRaw.trim() !== "" ? Number(envPortRaw) : NaN;
const PORT_EXPLICIT = Number.isInteger(envPort) && envPort > 0;
const START_PORT = PORT_EXPLICIT ? envPort : DEFAULT_PORT;

// The port actually bound (see start()); the Host/Origin allowlists derive from
// this, NOT from a hardcoded default, so an auto-advanced board still only
// trusts its own real port.
let boundPort = START_PORT;

function isAllowedHost(host: string | undefined): boolean {
  return host === `127.0.0.1:${boundPort}` || host === `localhost:${boundPort}`;
}
function isAllowedOrigin(origin: string | undefined): boolean {
  return (
    origin === undefined ||
    origin === `http://127.0.0.1:${boundPort}` ||
    origin === `http://localhost:${boundPort}`
  );
}

/** Thrown by readBody when a request body exceeds MAX_BODY_BYTES. */
class BodyTooLargeError extends Error {}

/** Last successfully-parsed task list. Served when a fresh parse fails (e.g. a
 * task file caught mid-write) so a bad/half-written file can neither crash the
 * server nor blank the board — it just keeps showing the last good state. */
let lastGoodTasks: Task[] = [];
function readTasks(): Task[] {
  try {
    lastGoodTasks = parseTasksDir(tasksDir);
  } catch (err) {
    console.error("tasks parse failed; serving last-good snapshot:", err);
  }
  return lastGoodTasks;
}

// Autonomous runner. It is only capable of anything when the server was
// started auto-capable (BOARD_AUTO=1, i.e. `pnpm board:auto`). A plain
// `pnpm board` constructs it with available:false so it can never arm and
// never spawns — the browser cannot weaponize a plain board.
const RUNNER_AVAILABLE = process.env.BOARD_AUTO === "1";
const runner = new Runner({
  available: RUNNER_AVAILABLE,
  repoRoot,
  tasksDir,
  config: runnerConfigFromEnv(repoRoot),
  onEvent: (evt) => onRunnerEvent(evt),
});

function broadcast(payload: string): void {
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

function broadcastRunnerState(): void {
  broadcast(JSON.stringify({ type: "runner", state: runner.getState() }));
}

function onRunnerEvent(evt: RunnerEvent): void {
  if (evt.kind === "state") {
    broadcastRunnerState();
    return;
  }
  // run-start / run-log / run-end: forward the granular event for live per-card
  // progress, and refresh runner state (the running set just changed).
  broadcast(JSON.stringify({ type: "runner-event", event: evt }));
  if (evt.kind !== "run-log") broadcastRunnerState();
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        // Stop buffering (memory stays bounded) and reject; the caller sends
        // 413 and then closes the socket. Do NOT destroy here — that would
        // tear the socket down before the 413 response can be written.
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  void handleRequest(req, res).catch((err: unknown) => {
    // Never echo the error detail to the client — it can leak filesystem paths.
    console.error("Unhandled request error:", err);
    if (!res.headersSent) sendJson(res, 500, { error: "internal server error" });
    else res.end();
  });
});

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const host = req.headers.host;
  if (!isAllowedHost(host)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden host");
    return;
  }

  // CSRF defense for the state-changing routes: a cross-origin page can issue a
  // no-preflight POST/PATCH with `text/plain`, and the Host check alone won't
  // stop it. Apply the exact same Origin allowlist the WS upgrade uses — a
  // present-but-foreign Origin is rejected; a missing Origin (curl/non-browser)
  // is allowed, matching verifyClient.
  if (
    (req.method === "POST" || req.method === "PATCH") &&
    !isAllowedOrigin(req.headers.origin)
  ) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden origin");
    return;
  }

  const url = new URL(req.url ?? "/", `http://${host}`);

  if (req.method === "GET" && url.pathname === "/") {
    const html = readFileSync(uiPath, "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
    return;
  }

  if (req.method === "GET" && url.pathname === "/sortable.js") {
    const js = readFileSync(sortablePath, "utf8");
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    res.end(js);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/meta") {
    sendJson(res, 200, { project: projectName, port: boundPort });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    sendJson(res, 200, { tasks: readTasks() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/runner") {
    sendJson(res, 200, runner.getState());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/runner") {
    await handleRunnerToggle(req, res);
    return;
  }

  const patchId = url.pathname.match(/^\/api\/tasks\/([^/]+)$/)?.[1];
  if (req.method === "PATCH" && patchId !== undefined) {
    await handlePatchTask(req, res, patchId);
    return;
  }

  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

async function handlePatchTask(
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
): Promise<void> {
  let rawBody: string;
  try {
    rawBody = await readBody(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      sendJson(res, 413, { error: "request body too large" });
      req.destroy(); // cut off the rest of an oversized upload after replying
    } else {
      sendJson(res, 400, { error: "could not read request body" });
    }
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }

  if (typeof parsed !== "object" || parsed === null) {
    sendJson(res, 400, { error: "body must be a JSON object" });
    return;
  }
  const body = parsed as { status?: unknown; assignee?: unknown };

  if (body.status !== undefined && !STATUSES.includes(body.status as Status)) {
    sendJson(res, 400, { error: `invalid status "${String(body.status)}"` });
    return;
  }
  if (
    body.assignee !== undefined &&
    !ASSIGNEES.includes(body.assignee as Assignee)
  ) {
    sendJson(res, 400, { error: `invalid assignee "${String(body.assignee)}"` });
    return;
  }

  const task = readTasks().find((t) => t.id === id);
  if (!task) {
    sendJson(res, 400, { error: `unknown task id "${id}"` });
    return;
  }

  patchTask(task.sourceFile, id, {
    status: body.status as Status | undefined,
    assignee: body.assignee as Assignee | undefined,
  });
  sendJson(res, 200, { ok: true });
}

async function handleRunnerToggle(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  let rawBody: string;
  try {
    rawBody = await readBody(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) sendJson(res, 413, { error: "request body too large" });
    else sendJson(res, 400, { error: "could not read request body" });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody || "{}");
  } catch {
    sendJson(res, 400, { error: "invalid JSON body" });
    return;
  }
  if (typeof parsed !== "object" || parsed === null) {
    sendJson(res, 400, { error: "body must be a JSON object" });
    return;
  }
  const body = parsed as { enabled?: unknown };
  if (typeof body.enabled !== "boolean") {
    sendJson(res, 400, { error: "expected { enabled: boolean }" });
    return;
  }

  // setArmed is a no-op when the runner isn't available (plain board): the
  // browser can request arming, but a plain board simply ignores it and stays
  // available:false. Only an auto-capable process actually arms.
  runner.setArmed(body.enabled);
  sendJson(res, 200, runner.getState());
}

const wss = new WebSocketServer({
  server,
  // A browser page always sends an Origin; a non-browser client (curl, the WS
  // smoke check) sends none. Allow the no-Origin case and our own local
  // origins; reject any real cross-origin page reading the task list.
  verifyClient: (info: { req: IncomingMessage }) =>
    isAllowedOrigin(info.req.headers.origin),
});

// ws forwards the shared http server's 'error' onto this WebSocketServer. The
// port-retry logic lives on the http server (see start()), so this handler
// only keeps the forwarded EADDRINUSE from crashing the process as an
// unhandled 'error' event; anything unexpected is still logged.
wss.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") return; // handled by start() on the http server
  console.error("WebSocket server error:", err);
});

function broadcastTasks(): void {
  broadcast(JSON.stringify({ type: "tasks", tasks: readTasks() }));
}

wss.on("connection", (ws) => {
  // A socket-level error (reset, broken pipe) must not crash the process.
  ws.on("error", () => {});
  try {
    ws.send(JSON.stringify({ type: "tasks", tasks: readTasks() }));
    ws.send(JSON.stringify({ type: "runner", state: runner.getState() }));
  } catch (err) {
    console.error("failed to send initial snapshot:", err);
  }
});

// Watch the whole tasks/ directory (rather than a glob string) and filter by
// extension in the handler — robust across chokidar versions that vary in
// glob-string support, and simpler than reconciling that compatibility matrix.
// awaitWriteFinish waits for a file to stop changing before firing, so a
// partial save can't trigger a parse of a half-written file.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const watcher = chokidar.watch(tasksDir, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
});
watcher.on("all", (_event, changedPath) => {
  if (!changedPath.endsWith(".md")) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    broadcastTasks();
    // A change may have made a ready/ai task newly eligible (e.g. a dep just
    // became done, or a human dragged a card to Ready). Inert unless armed.
    runner.poke();
  }, 100);
});

// Kill any in-flight autonomous runs on shutdown so no orphaned claude child
// keeps running after the board is stopped.
function shutdown(): void {
  void runner.shutdown().finally(() => process.exit(0));
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

/** Try to bind `port`. On EADDRINUSE: exit if the port was explicitly
 * requested, otherwise auto-advance to the next port up to MAX_AUTO_PORT so
 * multiple project boards can coexist. The listening/error handlers are paired
 * and each removes the other, so a failed attempt leaves no stale listener
 * behind to fire on the next attempt's success. */
function start(port: number): void {
  const onListening = (): void => {
    server.removeListener("error", onError);
    boundPort = port;
    console.log(`\nBoard for "${projectName}" → http://${HOST}:${port}\n`);
  };
  const onError = (err: NodeJS.ErrnoException): void => {
    server.removeListener("listening", onListening);
    if (err.code !== "EADDRINUSE") throw err;

    if (PORT_EXPLICIT) {
      console.error(
        `\nBoard server: port ${port} is already in use.\n` +
          `Set BOARD_PORT to a free port, e.g. BOARD_PORT=${port + 1} pnpm board\n`,
      );
      process.exit(1);
    }
    if (port >= MAX_AUTO_PORT) {
      console.error(
        `\nBoard server: no free port in range ${DEFAULT_PORT}-${MAX_AUTO_PORT}.\n` +
          `Free one up, or set BOARD_PORT explicitly.\n`,
      );
      process.exit(1);
    }
    start(port + 1);
  };

  server.once("listening", onListening);
  server.once("error", onError);
  server.listen(port, HOST);
}

start(START_PORT);
