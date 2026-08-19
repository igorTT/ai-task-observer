import { resolvePrice } from "./catalog.js";
import {
  addDecimals,
  decimalForTokens,
  serializeDecimal,
  type FixedDecimal,
  type PriceRates,
  type PricedObservation,
  type PricingCatalog,
  type PricingGapCode,
} from "./domain.js";
import type { UsageObservation } from "@/modules/sessions/domain.js";

export function calculateObservationCost(
  catalog: PricingCatalog,
  observation: UsageObservation,
): PricedObservation {
  const model = catalog.modelIndex.get(observation.model);
  const resolved = resolvePrice(catalog, observation.model, observation.eventTime);
  const gaps: PricingGapCode[] = [];
  if (!model) gaps.push("unknown_model");
  else if (!observation.eventTime) gaps.push("unknown_observation_time");
  else if (!resolved) gaps.push("price_period_gap");

  const rates: PriceRates | null = resolved
    ? {
        uncachedInputUsdPerUnit: resolved.period.uncachedInputUsdPerUnit,
        cachedInputUsdPerUnit: resolved.period.cachedInputUsdPerUnit,
        outputUsdPerUnit: resolved.period.outputUsdPerUnit,
      }
    : null;
  const knownCosts: FixedDecimal[] = [];
  const uncachedInputUsd = component(
    observation.normalized.uncachedInput,
    rates?.uncachedInputUsdPerUnit,
    catalog.tokenUnit,
    "uncached_input_unavailable",
    gaps,
    knownCosts,
  );
  const cachedInputUsd = component(
    observation.normalized.cachedInput,
    rates?.cachedInputUsdPerUnit,
    catalog.tokenUnit,
    "cached_input_unavailable",
    gaps,
    knownCosts,
  );
  const outputUsd = component(
    observation.normalized.output,
    rates?.outputUsdPerUnit,
    catalog.tokenUnit,
    "output_unavailable",
    gaps,
    knownCosts,
  );
  const costComplete =
    observation.complete &&
    resolved !== null &&
    observation.normalized.uncachedInput !== null &&
    observation.normalized.cachedInput !== null &&
    observation.normalized.output !== null;

  return {
    observationId: observation.observationId,
    sessionId: observation.sessionId,
    observedModel: observation.model,
    canonicalModel: resolved?.canonicalModel ?? null,
    effectiveFrom: resolved?.period.effectiveFrom ?? null,
    effectiveTo: resolved?.period.effectiveTo ?? null,
    rates,
    uncachedInputTokens: observation.normalized.uncachedInput,
    cachedInputTokens: observation.normalized.cachedInput,
    outputTokens: observation.normalized.output,
    uncachedInputUsd,
    cachedInputUsd,
    outputUsd,
    estimatedCostUsd: knownCosts.length > 0 ? serializeDecimal(addDecimals(knownCosts)) : null,
    costComplete,
    gapCodes: gaps,
    anomalyCodes: observation.anomalyCodes,
  };
}

function component(
  tokens: bigint | null,
  rate: string | undefined,
  tokenUnit: bigint,
  unavailableGap: PricingGapCode,
  gaps: PricingGapCode[],
  knownCosts: FixedDecimal[],
): string | null {
  if (tokens === null || rate === undefined) {
    gaps.push(unavailableGap);
    return null;
  }
  const value = decimalForTokens(tokens, rate, tokenUnit);
  knownCosts.push(value);
  return serializeDecimal(value);
}
