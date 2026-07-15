// Parser/serializer for the task-block schema used under tasks/*.md.
//
// Schema (see docs/SCOPE_BREAKDOWN.md and CLAUDE.md's task-block contract):
//
//   ### T-a3f9c1 — <title>
//   - **Status:** todo
//   - **Assignee:** ai
//   - **Files:** apps/api/prisma/schema.prisma, ...
//   - **Acceptance:** <checkable definition of done>
//   - **Skills:** database-orm, shared-contracts
//   - **Depends:** T-xxxxxx
//   <optional free-form notes below>
//
// Dependency-free (Node stdlib only) so it can run directly via `tsx`/`node
// --test` with no build step.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

export type Status =
  | "todo"
  | "ready"
  | "in-progress"
  | "blocked"
  | "review"
  | "done";

export const STATUSES: Status[] = [
  "todo",
  "ready",
  "in-progress",
  "blocked",
  "review",
  "done",
];

export type Assignee = "ai" | "human";

export const ASSIGNEES: Assignee[] = ["ai", "human"];

export interface Task {
  id: string;
  title: string;
  status: Status;
  assignee: Assignee;
  /** Layer number as a string (e.g. "0"), "refinement", or "done". */
  layer: string;
  files: string[];
  acceptance: string;
  skills: string[];
  depends: string[];
  notes: string;
  sourceFile: string;
  /** 1-indexed line number of the task's "### T-xxxxxx" heading. */
  headingLine: number;
}

const HEADING_RE = /^### (T-[0-9a-f]{6}) [—-]\s*(.+?)\s*$/;
const FIELD_RE =
  /^- \*\*(Status|Assignee|Files|Acceptance|Skills|Depends):\*\*\s?(.*)$/;
const RULE_RE = /^---\s*$/;
const LAYER_FROM_FILENAME_RE = /^layer-(\d+)-todo\.md$/;

function stripComments(value: string): string {
  return value.replace(/<!--.*?-->/g, "").trim();
}

function splitList(value: string | undefined): string[] {
  const cleaned = stripComments(value ?? "");
  if (!cleaned) return [];
  return cleaned
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripCr(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

function inferLayerFromFilename(filePath: string): string | null {
  const name = basename(filePath);
  const m = name.match(LAYER_FROM_FILENAME_RE);
  if (m && m[1] !== undefined) return m[1];
  if (name === "layer-refinement-todo.md") return "refinement";
  return null;
}

/** Fallback for files (e.g. done.md) whose layer isn't in the filename: scan
 * upward for the nearest "## Layer N" / "## Refinement" section heading. */
function inferLayerFallback(lines: string[], headingIdx: number): string {
  for (let i = headingIdx - 1; i >= 0; i--) {
    const line = lines[i];
    if (line === undefined) continue;
    const layerMatch = line.match(/^##\s+Layer\s+(\d+)/i);
    if (layerMatch && layerMatch[1] !== undefined) return layerMatch[1];
    if (/^##\s+Refinement/i.test(line)) return "refinement";
  }
  return "done";
}

/**
 * Marks lines that fall inside a fenced code block (``` ... ```) or a
 * multi-line HTML comment (<!-- ... -->) as "not live" so schema examples
 * documented inside a tasks/*.md file (e.g. a fenced sample task block)
 * aren't mistaken for a real task heading.
 */
function computeLiveMask(lines: string[]): boolean[] {
  const mask: boolean[] = new Array(lines.length).fill(true);
  let inFence = false;
  let inComment = false;
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const line = stripCr(rawLine);
    if (inFence) {
      mask[i] = false;
      if (/^\s*```/.test(line)) inFence = false;
      continue;
    }
    if (inComment) {
      mask[i] = false;
      if (line.includes("-->")) inComment = false;
      continue;
    }
    if (/^\s*```/.test(line)) {
      mask[i] = false;
      inFence = true;
      continue;
    }
    if (line.includes("<!--") && !line.includes("-->")) {
      mask[i] = false;
      inComment = true;
      continue;
    }
  }
  return mask;
}

export function parseTaskFile(filePath: string): Task[] {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split("\n");
  const filenameLayer = inferLayerFromFilename(filePath);
  const liveMask = computeLiveMask(lines);

  const headingIdxs: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && liveMask[i] && HEADING_RE.test(stripCr(line))) {
      headingIdxs.push(i);
    }
  }

  const tasks: Task[] = [];

  for (let h = 0; h < headingIdxs.length; h++) {
    const idx = headingIdxs[h];
    const headingLine = idx === undefined ? undefined : lines[idx];
    const headingMatch =
      headingLine === undefined ? null : stripCr(headingLine).match(HEADING_RE);
    if (idx === undefined || headingMatch === null) continue;
    const id = headingMatch[1];
    const title = headingMatch[2];
    if (id === undefined || title === undefined) continue;

    const nextIdx = headingIdxs[h + 1];
    const blockEnd = nextIdx ?? lines.length;

    const fields: Record<string, string> = {};
    const notesLines: string[] = [];
    let currentField: string | null = null;
    let inNotes = false;

    for (let i = idx + 1; i < blockEnd; i++) {
      const rawLine = lines[i];
      if (rawLine === undefined) continue;
      const line = stripCr(rawLine);

      if (RULE_RE.test(line)) break; // horizontal rule ends the block's content

      if (!inNotes) {
        const fieldMatch = line.match(FIELD_RE);
        if (fieldMatch && fieldMatch[1] !== undefined) {
          const key = fieldMatch[1];
          fields[key] = stripComments(fieldMatch[2] ?? "");
          currentField = key;
          continue;
        }
        if (line.trim() === "") {
          inNotes = true; // blank line ends the metadata list
          continue;
        }
        if (/^\s+\S/.test(line) && currentField) {
          // indented continuation of the current field's value
          fields[currentField] = `${fields[currentField]}\n${line.trim()}`;
          continue;
        }
        // unindented, non-metadata text starts the free-form notes section
        inNotes = true;
        notesLines.push(line);
        continue;
      }

      if (line.trim() === "" && notesLines.length === 0) continue; // skip leading blanks
      notesLines.push(line);
    }

    const statusRaw = fields["Status"];
    if (!statusRaw) {
      throw new Error(`${filePath}: task ${id} is missing required Status field`);
    }
    if (!STATUSES.includes(statusRaw as Status)) {
      throw new Error(`${filePath}: task ${id} has invalid Status "${statusRaw}"`);
    }

    const assigneeRaw = fields["Assignee"];
    if (!assigneeRaw) {
      throw new Error(`${filePath}: task ${id} is missing required Assignee field`);
    }
    if (!ASSIGNEES.includes(assigneeRaw as Assignee)) {
      throw new Error(`${filePath}: task ${id} has invalid Assignee "${assigneeRaw}"`);
    }

    while (
      notesLines.length &&
      (notesLines[notesLines.length - 1] ?? "").trim() === ""
    ) {
      notesLines.pop();
    }

    tasks.push({
      id,
      title,
      status: statusRaw as Status,
      assignee: assigneeRaw as Assignee,
      layer: filenameLayer ?? inferLayerFallback(lines, idx),
      files: splitList(fields["Files"]),
      acceptance: (fields["Acceptance"] ?? "").trim(),
      skills: splitList(fields["Skills"]),
      depends: splitList(fields["Depends"]),
      notes: notesLines.join("\n").trim(),
      sourceFile: filePath,
      headingLine: idx + 1,
    });
  }

  return tasks;
}

export function parseTasksDir(tasksDir: string): Task[] {
  const files = readdirSync(tasksDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  const tasks: Task[] = [];
  for (const file of files) {
    tasks.push(...parseTaskFile(join(tasksDir, file)));
  }
  return tasks;
}

/**
 * Rewrites only the Status/Assignee line(s) for task `id` in `filePath`,
 * preserving every other byte (spacing, trailing comments, other fields,
 * notes) exactly as-is. No-op (no write) if the patch doesn't change
 * anything.
 */
export function patchTask(
  filePath: string,
  id: string,
  patch: { status?: Status; assignee?: Assignee },
): void {
  const raw = readFileSync(filePath, "utf8");
  const lines = raw.split("\n");
  const liveMask = computeLiveMask(lines);

  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (!liveMask[i]) continue;
    const line = lines[i];
    if (line === undefined) continue;
    const m = stripCr(line).match(HEADING_RE);
    if (m && m[1] === id) {
      headingIdx = i;
      break;
    }
  }
  if (headingIdx === -1) {
    throw new Error(`${filePath}: task ${id} not found`);
  }

  let blockEnd = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (liveMask[i] && line !== undefined && HEADING_RE.test(stripCr(line))) {
      blockEnd = i;
      break;
    }
  }

  const replaceField = (key: "Status" | "Assignee", value: string) => {
    const re = new RegExp(`^(- \\*\\*${key}:\\*\\*\\s*)(\\S+)(.*)$`);
    for (let i = headingIdx + 1; i < blockEnd; i++) {
      const line = lines[i];
      if (line === undefined) continue;
      const hadCr = line.endsWith("\r");
      const m = stripCr(line).match(re);
      if (m) {
        lines[i] = `${m[1] ?? ""}${value}${m[3] ?? ""}${hadCr ? "\r" : ""}`;
        return;
      }
    }
    throw new Error(`${filePath}: task ${id} has no ${key} field to patch`);
  };

  if (patch.status !== undefined) replaceField("Status", patch.status);
  if (patch.assignee !== undefined) replaceField("Assignee", patch.assignee);

  const newContent = lines.join("\n");
  if (newContent !== raw) {
    writeFileSync(filePath, newContent, "utf8");
  }
}
