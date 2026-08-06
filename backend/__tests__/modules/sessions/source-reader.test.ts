import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { discoverRoot } from "@/modules/sessions/discovery.js";
import {
  inspectSource,
  readCompleteRecords,
  sourceCompatibility,
} from "@/modules/sessions/source-reader.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Codex source discovery and bounded reading", () => {
  test("discovers nested JSONL files deterministically and reports roots independently", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-discovery-"));
    directories.push(root);
    await mkdir(join(root, "2026", "01"), { recursive: true });
    await writeFile(join(root, "z.jsonl"), "{}\n");
    await writeFile(join(root, "2026", "01", "a.jsonl"), "{}\n");
    await writeFile(join(root, "ignored.txt"), "{}\n");
    const status = await discoverRoot(root);
    expect(status.available).toBe(true);
    expect(status.files.map((path) => path.split("/").at(-1))).toEqual(["a.jsonl", "z.jsonl"]);
    expect(await discoverRoot(join(root, "missing"))).toMatchObject({
      available: false,
      reason: "missing",
    });
  });

  test("advances only through complete newline-delimited records", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-reader-"));
    directories.push(root);
    const path = join(root, "session.jsonl");
    await writeFile(path, '{"one":1}\n{"two":');
    const first = await readCompleteRecords(path, 0n, 8);
    expect(first.records).toEqual(['{"one":1}']);
    expect(first.completeOffset).toBe(10n);
    const trailing = await readCompleteRecords(path, first.completeOffset, 8);
    expect(trailing.records).toEqual([]);
    expect(trailing.completeOffset).toBe(first.completeOffset);
  });

  test("classifies append, truncation/replacement, and parser invalidation", async () => {
    const root = await mkdtemp(join(tmpdir(), "codex-identity-"));
    directories.push(root);
    const path = join(root, "session.jsonl");
    await writeFile(path, "{}\n");
    const source = await inspectSource(path);
    const checkpoint = {
      sourcePath: path,
      sourceRoot: root,
      sourceIdentity: source.key,
      committedOffset: 2n,
      observedSize: 2n,
      observedModifiedAtMs: source.modifiedAtMs,
      parserVersion: 1,
      status: "ready" as const,
      unknownRecords: 0,
      malformedRecords: 0,
      updatedAt: new Date(),
    };
    expect(sourceCompatibility(checkpoint, source, 1)).toBe("append");
    expect(sourceCompatibility(checkpoint, source, 2)).toBe("rebuild");
    expect(sourceCompatibility({ ...checkpoint, committedOffset: 10n }, source, 1)).toBe("rebuild");
    expect(sourceCompatibility({ ...checkpoint, sourceIdentity: "replacement" }, source, 1)).toBe(
      "rebuild",
    );
  });
});
