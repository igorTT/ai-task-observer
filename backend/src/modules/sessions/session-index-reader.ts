import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export interface SessionIndexEntry {
  readonly sessionId: string;
  readonly threadName?: string;
  readonly updatedAt: Date;
}

export type SessionIndexDiagnosticCategory =
  "malformed_record" | "incomplete_record" | "source_failure";

export interface SessionIndexDiagnostic {
  readonly category: SessionIndexDiagnosticCategory;
  readonly source: string;
  readonly lineNumber?: number;
  readonly message: string;
}

export interface SessionIndexDiagnostics {
  readonly validRecords: number;
  readonly malformedRecords: number;
  readonly incompleteRecords: number;
  readonly diagnostics: readonly SessionIndexDiagnostic[];
}

export interface SessionIndexSnapshot {
  readonly available: boolean;
  readonly entries: ReadonlyMap<string, SessionIndexEntry>;
  readonly diagnostics: SessionIndexDiagnostics;
}

interface JsonObject {
  readonly [key: string]: unknown;
}

export async function readSessionIndexSnapshot(path: string): Promise<SessionIndexSnapshot> {
  let contents: string;
  try {
    contents = await readFile(path, "utf8");
  } catch (error) {
    return {
      available: false,
      entries: new Map(),
      diagnostics: {
        validRecords: 0,
        malformedRecords: 0,
        incompleteRecords: 0,
        diagnostics: [
          {
            category: "source_failure",
            source: basename(path),
            message: error instanceof Error ? error.name : "Error",
          },
        ],
      },
    };
  }

  const completeBytes = contents.endsWith("\n")
    ? contents
    : contents.slice(0, contents.lastIndexOf("\n") + 1);
  const lines = completeBytes.length === 0 ? [] : completeBytes.split("\n").slice(0, -1);
  const entries = new Map<string, SessionIndexEntry>();
  const diagnostics: SessionIndexDiagnostic[] = [];
  let validRecords = 0;
  let malformedRecords = 0;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const value = parseJson(line);
    const entry = value ? parseEntry(value) : undefined;
    if (!entry) {
      malformedRecords += 1;
      diagnostics.push({
        category: "malformed_record",
        source: basename(path),
        lineNumber,
        message: "invalid session-index record",
      });
      return;
    }
    validRecords += 1;
    const previous = entries.get(entry.sessionId);
    if (previous === undefined || entry.updatedAt.getTime() >= previous.updatedAt.getTime()) {
      entries.set(entry.sessionId, entry);
    }
  });

  const incompleteRecords = contents.length > 0 && !contents.endsWith("\n") ? 1 : 0;
  if (incompleteRecords > 0) {
    diagnostics.push({
      category: "incomplete_record",
      source: basename(path),
      message: "incomplete trailing session-index record ignored",
    });
  }

  return {
    available: true,
    entries,
    diagnostics: {
      validRecords,
      malformedRecords,
      incompleteRecords,
      diagnostics,
    },
  };
}

function parseJson(line: string): JsonObject | undefined {
  try {
    const value: unknown = JSON.parse(line);
    return isObject(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function parseEntry(value: JsonObject): SessionIndexEntry | undefined {
  const sessionId = typeof value.id === "string" ? value.id.trim() : "";
  if (!sessionId) return undefined;
  if (value.thread_name !== undefined && typeof value.thread_name !== "string") return undefined;
  if (typeof value.updated_at !== "string") return undefined;
  const updatedAt = new Date(value.updated_at);
  if (Number.isNaN(updatedAt.getTime())) return undefined;
  return {
    sessionId,
    ...(value.thread_name === undefined ? {} : { threadName: value.thread_name }),
    updatedAt,
  };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
