import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "bun:test";

import { parseCodexRecords } from "@/modules/sessions/parser.js";

const fixture = fileURLToPath(new URL("../../fixtures/codex/valid-session.jsonl", import.meta.url));
const variantsFixture = fileURLToPath(
  new URL("../../fixtures/codex/record-variants.jsonl", import.meta.url),
);

describe("Codex parser adapter", () => {
  test("normalizes identity, latest title, developer turns, and authoritative usage", async () => {
    const lines = (await readFile(fixture, "utf8")).trimEnd().split("\n");
    const parsed = parseCodexRecords(lines, {
      sourceRoot: "/synthetic/root",
      sourcePath: "/synthetic/root/rollout.jsonl",
    });
    expect(parsed.sessionId).toBe("session-001");
    expect(parsed.mutations[0]?.metadata).toMatchObject({
      sessionId: "session-001",
      title: "ENG-101: apply",
    });
    const facts = parsed.mutations[1];
    expect(facts?.developerTurnDelta).toBe(1n);
    expect(facts?.tokenSnapshot).toEqual({ input: 150n, cachedInput: 25n, output: 40n });
    expect(parsed.diagnostics.unknownRecords).toBe(1);
    expect(parsed.diagnostics.malformedRecords).toBe(1);
  });

  test("emits no transcript, reasoning, or tool payload content", async () => {
    const parsed = parseCodexRecords((await readFile(fixture, "utf8")).trimEnd().split("\n"), {
      sourceRoot: "/synthetic/root",
      sourcePath: "/synthetic/root/rollout.jsonl",
    });
    const serialized = JSON.stringify(parsed, jsonSafeReplacer);
    for (const marker of [
      "SYNTHETIC_PRIVATE_PROMPT",
      "SYNTHETIC_PRIVATE_RESPONSE",
      "SYNTHETIC_PRIVATE_TOOL_ARGUMENT",
      "SYNTHETIC_PRIVATE_TOOL_RESULT",
      "SYNTHETIC_PRIVATE_UNKNOWN",
    ]) {
      expect(serialized).not.toContain(marker);
    }
  });

  test("supports delta usage and valid sessions without usage", () => {
    const parsed = parseCodexRecords(
      [
        JSON.stringify({ type: "session_meta", payload: { id: "delta-session" } }),
        JSON.stringify({
          type: "token_usage",
          payload: { input_tokens: "2", cached_input_tokens: 3, output_tokens: 4 },
        }),
      ],
      { sourceRoot: "/root", sourcePath: "/root/delta.jsonl" },
    );
    expect(parsed.mutations[1]?.tokenDelta).toEqual({ input: 2n, cachedInput: 3n, output: 4n });
    const withoutUsage = parseCodexRecords(
      [JSON.stringify({ type: "session_meta", payload: { id: "no-usage" } })],
      { sourceRoot: "/root", sourcePath: "/root/no-usage.jsonl" },
    );
    expect(withoutUsage.mutations).toHaveLength(1);
  });

  test("classifies every immutable supported record variant", async () => {
    const parsed = parseCodexRecords(
      (await readFile(variantsFixture, "utf8")).trimEnd().split("\n"),
      { sourceRoot: "/root", sourcePath: "/root/variants.jsonl" },
    );
    expect(parsed.sessionId).toBe("fixture-variants");
    expect(parsed.mutations[0]?.metadata?.title).toBe("FIX-1: apply");
    expect(parsed.mutations[1]).toMatchObject({
      developerTurnDelta: 1n,
      tokenSnapshot: { input: 8n, cachedInput: 3n, output: 5n },
    });
    expect(parsed.diagnostics).toMatchObject({ unknownRecords: 0, malformedRecords: 0 });
  });
});

function jsonSafeReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}
