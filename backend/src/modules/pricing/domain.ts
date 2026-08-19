export const CALCULATOR_VERSION = "1";

export interface FixedDecimal {
  readonly coefficient: bigint;
  readonly scale: number;
}

export interface PriceRates {
  readonly uncachedInputUsdPerUnit: string;
  readonly cachedInputUsdPerUnit: string;
  readonly outputUsdPerUnit: string;
}

export interface PricePeriod extends PriceRates {
  readonly effectiveFrom: Date;
  readonly effectiveTo: Date | null;
}

export interface PricingModel {
  readonly id: string;
  readonly aliases: readonly string[];
  readonly prices: readonly PricePeriod[];
}

export interface PricingCatalog {
  readonly path: string;
  readonly schemaVersion: 1;
  readonly catalogVersion: string;
  readonly contentHash: string;
  readonly currency: "USD";
  readonly tokenUnit: bigint;
  readonly models: readonly PricingModel[];
  readonly modelIndex: ReadonlyMap<string, PricingModel>;
}

export type PricingGapCode =
  | "unknown_model"
  | "unknown_observation_time"
  | "price_period_gap"
  | "uncached_input_unavailable"
  | "cached_input_unavailable"
  | "output_unavailable";

export interface ResolvedPrice {
  readonly observedModel: string;
  readonly canonicalModel: string;
  readonly period: PricePeriod;
}

export interface CostComponents {
  readonly uncachedInputUsd: string | null;
  readonly cachedInputUsd: string | null;
  readonly outputUsd: string | null;
  readonly estimatedCostUsd: string | null;
}

export interface PricedObservation extends CostComponents {
  readonly observationId: string;
  readonly sessionId: string;
  readonly observedModel: string;
  readonly canonicalModel: string | null;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
  readonly rates: PriceRates | null;
  readonly uncachedInputTokens: bigint | null;
  readonly cachedInputTokens: bigint | null;
  readonly outputTokens: bigint | null;
  readonly costComplete: boolean;
  readonly gapCodes: readonly PricingGapCode[];
  readonly anomalyCodes: readonly string[];
}

const decimalPattern = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;

export function parseFixedDecimal(value: string): FixedDecimal {
  if (!decimalPattern.test(value)) throw new Error("must be a non-negative decimal string");
  const [whole = "0", fraction = ""] = value.split(".");
  return normalizeDecimal({
    coefficient: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  });
}

export function decimalForTokens(tokens: bigint, rate: string, tokenUnit: bigint): FixedDecimal {
  if (tokens < 0n) throw new Error("token count must be non-negative");
  if (tokenUnit <= 0n) throw new Error("token unit must be positive");
  const parsedRate = parseFixedDecimal(rate);
  const unitScale = powerOfTenScale(tokenUnit);
  if (unitScale === null) throw new Error("token unit must be a power of ten");
  return normalizeDecimal({
    coefficient: tokens * parsedRate.coefficient,
    scale: parsedRate.scale + unitScale,
  });
}

export function addDecimals(values: readonly FixedDecimal[]): FixedDecimal {
  const scale = values.reduce((largest, value) => Math.max(largest, value.scale), 0);
  const coefficient = values.reduce(
    (sum, value) => sum + value.coefficient * 10n ** BigInt(scale - value.scale),
    0n,
  );
  return normalizeDecimal({ coefficient, scale });
}

export function serializeDecimal(value: FixedDecimal): string {
  const normalized = normalizeDecimal(value);
  if (normalized.scale === 0) return normalized.coefficient.toString(10);
  const digits = normalized.coefficient.toString(10).padStart(normalized.scale + 1, "0");
  const split = digits.length - normalized.scale;
  return `${digits.slice(0, split)}.${digits.slice(split)}`;
}

function normalizeDecimal(value: FixedDecimal): FixedDecimal {
  let coefficient = value.coefficient;
  let scale = value.scale;
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

function powerOfTenScale(value: bigint): number | null {
  let remaining = value;
  let scale = 0;
  while (remaining > 1n && remaining % 10n === 0n) {
    remaining /= 10n;
    scale += 1;
  }
  return remaining === 1n ? scale : null;
}
