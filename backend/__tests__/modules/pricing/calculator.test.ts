import { fileURLToPath } from "node:url";

import { beforeAll, describe, expect, test } from "bun:test";

import { loadPricingCatalog } from "@/modules/pricing/catalog.js";
import { calculateObservationCost } from "@/modules/pricing/calculator.js";
import {
  addDecimals,
  decimalForTokens,
  parseFixedDecimal,
  serializeDecimal,
  type PricingCatalog,
} from "@/modules/pricing/domain.js";
import type { UsageObservation } from "@/modules/sessions/domain.js";

const fixture = fileURLToPath(
  new URL("../../fixtures/pricing/valid-catalog.json", import.meta.url),
);
let catalog: PricingCatalog;

beforeAll(async () => {
  catalog = await loadPricingCatalog(fixture);
});

describe("fixed decimal pricing", () => {
  test("calculates the exact acceptance case without JavaScript numbers", () => {
    const result = calculateObservationCost(
      catalog,
      observation({ input: 1_000n, cached: 400n, uncached: 600n, output: 200n }),
    );
    expect(result.uncachedInputUsd).toBe("0.0012");
    expect(result.cachedInputUsd).toBe("0.0002");
    expect(result.outputUsd).toBe("0.0016");
    expect(result.estimatedCostUsd).toBe("0.003");
    expect(result.costComplete).toBe(true);
  });

  test("normalizes exact decimal serialization", () => {
    expect(serializeDecimal(parseFixedDecimal("2.0000"))).toBe("2");
    expect(serializeDecimal(decimalForTokens(1n, "0.000001", 1_000_000n))).toBe("0.000000000001");
    expect(
      serializeDecimal(addDecimals([parseFixedDecimal("0.1"), parseFixedDecimal("0.02")])),
    ).toBe("0.12");
  });

  test("preserves independently priceable output for malformed input categories", () => {
    const result = calculateObservationCost(
      catalog,
      observation({ input: 1_000n, cached: null, uncached: null, output: 200n, complete: false }),
    );
    expect(result.estimatedCostUsd).toBe("0.0016");
    expect(result.uncachedInputUsd).toBeNull();
    expect(result.cachedInputUsd).toBeNull();
    expect(result.outputUsd).toBe("0.0016");
    expect(result.costComplete).toBe(false);
  });

  test("returns null when no component is priceable", () => {
    const result = calculateObservationCost(
      catalog,
      observation({ model: "unknown-model", input: 1n, cached: 0n, uncached: 1n, output: 1n }),
    );
    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costComplete).toBe(false);
    expect(result.gapCodes).toContain("unknown_model");
  });

  test("does not substitute a timestamp or current price", () => {
    const unknownTime = calculateObservationCost(catalog, observation({ eventTime: null }));
    expect(unknownTime.estimatedCostUsd).toBeNull();
    expect(unknownTime.gapCodes).toContain("unknown_observation_time");
    const gap = calculateObservationCost(
      catalog,
      observation({ eventTime: new Date("2026-03-15T00:00:00Z") }),
    );
    expect(gap.estimatedCostUsd).toBeNull();
    expect(gap.gapCodes).toContain("price_period_gap");
  });

  test("prices zero usage completely", () => {
    const result = calculateObservationCost(
      catalog,
      observation({ input: 0n, cached: 0n, uncached: 0n, output: 0n }),
    );
    expect(result.estimatedCostUsd).toBe("0");
    expect(result.costComplete).toBe(true);
  });

  test("uses each exact model and effective period independently", () => {
    const newer = calculateObservationCost(
      catalog,
      observation({ eventTime: new Date("2026-02-01T00:00:00Z") }),
    );
    const other = calculateObservationCost(
      catalog,
      observation({ model: "model-b-alias", eventTime: new Date("2026-02-01T00:00:00Z") }),
    );
    expect(newer.rates?.uncachedInputUsdPerUnit).toBe("3.00");
    expect(other.canonicalModel).toBe("model-b");
    expect(other.rates?.uncachedInputUsdPerUnit).toBe("1.00");
  });
});

function observation(
  options: {
    model?: string;
    eventTime?: Date | null;
    input?: bigint;
    cached?: bigint | null;
    uncached?: bigint | null;
    output?: bigint;
    complete?: boolean;
  } = {},
): UsageObservation {
  const input = options.input ?? 1_000n;
  const cached = options.cached === undefined ? 400n : options.cached;
  const uncached = options.uncached === undefined ? 600n : options.uncached;
  const output = options.output ?? 200n;
  return {
    observationId: "observation-1",
    sessionId: "session-1",
    sourcePath: "/fixture.jsonl",
    sourceIdentity: "1:1",
    sourceRecordNumber: 1n,
    parserVersion: 3,
    model: options.model ?? "model-a-alias",
    eventTime:
      options.eventTime === undefined ? new Date("2026-01-15T00:00:00Z") : options.eventTime,
    rawCumulative: null,
    rawLast: null,
    normalized: {
      input,
      cachedInput: cached,
      uncachedInput: uncached,
      output,
      total: input + output,
    },
    epoch: 0,
    method: "standalone_delta",
    complete: options.complete ?? true,
    anomalyCodes: options.complete === false ? ["cached_exceeds_input"] : [],
    legacy: false,
  };
}
