import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { readSessionIndexSnapshot } from "@/modules/sessions/session-index-reader.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Codex session index reader", () => {
  test("reads permitted metadata, ignores opaque fields, and resolves duplicates deterministically", async () => {
    const root = await mkdtemp(join(tmpdir(), "session-index-reader-"));
    directories.push(root);
    const path = join(root, "session_index.jsonl");
    await writeFile(
      path,
      [
        JSON.stringify({
          id: "session-001",
          thread_name: "older",
          updated_at: "2026-01-02T03:10:00.000Z",
          transcript: "private",
        }),
        JSON.stringify({
          id: "session-001",
          thread_name: "newer",
          updated_at: "2026-01-02T03:11:00.000Z",
        }),
        JSON.stringify({
          id: "session-002",
          thread_name: "same-time-first",
          updated_at: "2026-01-02T03:12:00.000Z",
        }),
        JSON.stringify({
          id: "session-002",
          thread_name: "same-time-last",
          updated_at: "2026-01-02T03:12:00.000Z",
        }),
        JSON.stringify({
          id: "session-003",
          thread_name: "",
          updated_at: "2026-01-02T03:13:00.000Z",
        }),
      ].join("\n") + "\n",
    );

    const snapshot = await readSessionIndexSnapshot(path);

    expect(snapshot.available).toBe(true);
    expect(snapshot.entries.get("session-001")).toMatchObject({
      sessionId: "session-001",
      threadName: "newer",
    });
    expect(snapshot.entries.get("session-002")).toMatchObject({
      threadName: "same-time-last",
    });
    expect(snapshot.entries.get("session-003")).toMatchObject({ threadName: "" });
    expect(snapshot.diagnostics.malformedRecords).toBe(0);
    expect(JSON.stringify(snapshot)).not.toContain("private");
    expect(JSON.stringify(snapshot)).not.toContain("transcript");
  });

  test("ignores malformed fields and an incomplete trailing line with sanitized diagnostics", async () => {
    const root = await mkdtemp(join(tmpdir(), "session-index-reader-invalid-"));
    directories.push(root);
    const path = join(root, "session_index.jsonl");
    await writeFile(
      path,
      `${JSON.stringify({ id: "valid", thread_name: "kept", updated_at: "2026-01-02T03:10:00.000Z" })}\n` +
        '{"id":"bad-json"\n' +
        `${JSON.stringify({ id: "bad-field", thread_name: 42, updated_at: "2026-01-02T03:10:00.000Z" })}\n` +
        '{"id":"partial"',
    );

    const snapshot = await readSessionIndexSnapshot(path);

    expect([...snapshot.entries.keys()]).toEqual(["valid"]);
    expect(snapshot.diagnostics).toMatchObject({
      validRecords: 1,
      malformedRecords: 2,
      incompleteRecords: 1,
    });
    expect(snapshot.diagnostics.diagnostics).toEqual([
      expect.objectContaining({ category: "malformed_record", source: "session_index.jsonl" }),
      expect.objectContaining({ category: "malformed_record", source: "session_index.jsonl" }),
      expect.objectContaining({ category: "incomplete_record", source: "session_index.jsonl" }),
    ]);
    expect(JSON.stringify(snapshot.diagnostics)).not.toContain("bad-json");
  });

  test("reports an unavailable path without throwing or exposing the configured path", async () => {
    const root = await mkdtemp(join(tmpdir(), "session-index-reader-missing-"));
    directories.push(root);
    const path = join(root, "missing", "session_index.jsonl");

    const snapshot = await readSessionIndexSnapshot(path);

    expect(snapshot.available).toBe(false);
    expect(snapshot.entries.size).toBe(0);
    expect(snapshot.diagnostics.diagnostics).toEqual([
      { category: "source_failure", source: "session_index.jsonl", message: "Error" },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain(root);
  });
});
