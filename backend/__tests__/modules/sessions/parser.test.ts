import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "bun:test";

import { parseCodexRecords } from "@/modules/sessions/parser.js";

const fixture = fileURLToPath(new URL("../../fixtures/codex/valid-session.jsonl", import.meta.url));
const variantsFixture = fileURLToPath(
  new URL("../../fixtures/codex/record-variants.jsonl", import.meta.url),
);
const usageFixture = fileURLToPath(
  new URL("../../fixtures/codex/usage-events.jsonl", import.meta.url),
);

describe("Codex parser adapter", () => {
  test("emits selected events and non-duplicated cumulative observations", async () => {
    const parsed = parseCodexRecords(await lines(fixture), {
      sourceRoot: "/synthetic/root",
      sourcePath: "/synthetic/root/rollout.jsonl",
      sourceIdentity: "fixture",
    });
    expect(parsed.sessionId).toBe("session-001");
    expect(parsed.mutations[0]?.metadata).toMatchObject({
      sessionId: "session-001",
      title: "ENG-101: apply",
    });
    expect(parsed.events.filter((event) => event.kind === "user_message")).toHaveLength(1);
    expect(parsed.events.filter((event) => event.kind === "assistant_message")).toHaveLength(1);
    expect(parsed.observations.map((observation) => observation.normalized)).toEqual([
      { input: 100n, cachedInput: 20n, uncachedInput: 80n, output: 30n, total: 130n },
      { input: 50n, cachedInput: 5n, uncachedInput: 45n, output: 10n, total: 60n },
    ]);
    expect(
      parsed.observations.every((observation) => observation.model === "synthetic-model"),
    ).toBe(true);
    expect(parsed.diagnostics).toMatchObject({ unknownRecords: 1, malformedRecords: 1 });
  });

  test("keeps permitted messages and excludes reasoning, tools, credentials, and opaque payloads", async () => {
    const parsed = parseCodexRecords(await lines(fixture), {
      sourceRoot: "/synthetic/root",
      sourcePath: "/synthetic/root/rollout.jsonl",
    });
    const serialized = JSON.stringify(parsed, jsonSafeReplacer);
    expect(serialized).toContain("SYNTHETIC_PRIVATE_PROMPT");
    expect(serialized).toContain("SYNTHETIC_PRIVATE_RESPONSE");
    for (const marker of [
      "SYNTHETIC_PRIVATE_DEVELOPER",
      "SYNTHETIC_PRIVATE_TOOL_ARGUMENT",
      "SYNTHETIC_PRIVATE_TOOL_RESULT",
      "SYNTHETIC_PRIVATE_UNKNOWN",
    ]) {
      expect(serialized).not.toContain(marker);
    }
  });

  test("covers exact model, time, epoch, anomaly, and malformed-counter semantics", async () => {
    const parsed = parseCodexRecords(await lines(usageFixture), {
      sourceRoot: "/root",
      sourcePath: "/root/usage.jsonl",
      sourceIdentity: "usage-fixture",
    });
    expect(parsed.events.filter((event) => event.kind === "user_message")).toHaveLength(2);
    expect(parsed.events.filter((event) => event.kind === "assistant_message")).toHaveLength(1);
    expect(parsed.observations).toHaveLength(9);
    expect(parsed.observations.map((observation) => observation.model)).toEqual([
      "unknown",
      "model-a",
      "model-a",
      "model-a",
      "model-b",
      "model-b",
      "model-b",
      "model-b",
      "model-b",
    ]);
    expect(
      parsed.observations.map((observation) => observation.eventTime?.toISOString() ?? null),
    ).toEqual([
      null,
      "2026-03-01T10:01:01.000Z",
      "2026-03-01T10:01:02.000Z",
      "2026-03-01T10:01:03.000Z",
      null,
      null,
      "2026-03-01T10:02:00.000Z",
      "2026-03-01T10:02:01.000Z",
      "2026-03-01T10:02:02.000Z",
    ]);
    expect(parsed.observations.map((observation) => observation.epoch)).toEqual([
      0, 0, 0, 0, 1, 2, 2, 2, 2,
    ]);
    expect(parsed.observations[2]?.normalized).toEqual({
      input: 0n,
      cachedInput: 0n,
      uncachedInput: 0n,
      output: 0n,
      total: 0n,
    });
    expect(parsed.observations[3]?.anomalyCodes).toEqual(["last_usage_mismatch"]);
    expect(parsed.observations[4]).toMatchObject({
      method: "reset_last_usage",
      anomalyCodes: ["counter_reset"],
      normalized: { input: 10n, cachedInput: 2n, total: 13n },
    });
    expect(parsed.observations[5]).toMatchObject({
      method: "reset_incomplete",
      complete: false,
      normalized: { input: null, cachedInput: null, output: null, total: null },
      anomalyCodes: ["counter_reset", "reset_without_last_usage"],
    });
    expect(parsed.observations[7]).toMatchObject({
      rawLast: { input: -1n, cachedInput: 0n, output: 2n },
      normalized: { input: null, cachedInput: 0n, uncachedInput: null, output: 2n, total: null },
      anomalyCodes: ["negative_counter"],
    });
    expect(parsed.observations[8]).toMatchObject({
      normalized: { input: 3n, cachedInput: null, uncachedInput: null, output: 1n, total: 4n },
      anomalyCodes: ["cached_exceeds_input"],
    });
    const serialized = JSON.stringify(parsed, jsonSafeReplacer);
    for (const marker of [
      "EXCLUDED_DEVELOPER_CONTENT",
      "EXCLUDED_REASONING_CONTENT",
      "EXCLUDED_TOOL_ARGUMENT",
      "EXCLUDED_TOOL_RESULT",
      "EXCLUDED_CREDENTIAL",
    ]) {
      expect(serialized).not.toContain(marker);
    }
  });

  test("classifies all immutable supported variants without unknown records", async () => {
    const parsed = parseCodexRecords(await lines(variantsFixture), {
      sourceRoot: "/root",
      sourcePath: "/root/variants.jsonl",
    });
    expect(parsed.sessionId).toBe("fixture-variants");
    expect(parsed.mutations[0]?.metadata?.title).toBe("FIX-1: apply");
    expect(parsed.events.filter((event) => event.kind === "user_message")).toHaveLength(1);
    expect(parsed.observations).toHaveLength(4);
    expect(parsed.diagnostics).toMatchObject({ unknownRecords: 0, malformedRecords: 0 });
  });
});

async function lines(path: string): Promise<string[]> {
  return (await readFile(path, "utf8")).trimEnd().split("\n");
}

function jsonSafeReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
