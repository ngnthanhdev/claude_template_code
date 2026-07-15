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
import { dirname, join } from "node:path";
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
import type { Status, Assignee } from "./lib/tasks.ts";

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

const PORT = Number(process.env.BOARD_PORT) || 4319;
const HOST = "127.0.0.1";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
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
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  });
});

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? HOST}`);

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

  if (req.method === "GET" && url.pathname === "/api/tasks") {
    sendJson(res, 200, { tasks: parseTasksDir(tasksDir) });
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
  let parsed: unknown;
  try {
    parsed = JSON.parse((await readBody(req)) || "{}");
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

  const task = parseTasksDir(tasksDir).find((t) => t.id === id);
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

const wss = new WebSocketServer({ server });

function broadcastTasks(): void {
  const payload = JSON.stringify({ type: "tasks", tasks: parseTasksDir(tasksDir) });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ type: "tasks", tasks: parseTasksDir(tasksDir) }));
});

// Watch the whole tasks/ directory (rather than a glob string) and filter by
// extension in the handler — robust across chokidar versions that vary in
// glob-string support, and simpler than reconciling that compatibility matrix.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
const watcher = chokidar.watch(tasksDir, { ignoreInitial: true });
watcher.on("all", (_event, changedPath) => {
  if (!changedPath.endsWith(".md")) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(broadcastTasks, 100);
});

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nBoard server: port ${PORT} is already in use.\n` +
        `Set BOARD_PORT to a different port, e.g. BOARD_PORT=4320 pnpm board\n`,
    );
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`\nTask board running at http://${HOST}:${PORT}\n`);
});
