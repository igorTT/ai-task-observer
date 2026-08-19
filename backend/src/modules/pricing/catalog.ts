import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  parseFixedDecimal,
  type PricePeriod,
  type PricingCatalog,
  type PricingModel,
  type ResolvedPrice,
} from "./domain.js";

interface JsonPricePeriod {
  readonly effectiveFrom?: unknown;
  readonly effectiveTo?: unknown;
  readonly uncachedInputUsdPerUnit?: unknown;
  readonly cachedInputUsdPerUnit?: unknown;
  readonly outputUsdPerUnit?: unknown;
}

interface JsonModel {
  readonly id?: unknown;
  readonly aliases?: unknown;
  readonly prices?: unknown;
}

interface JsonCatalog {
  readonly schemaVersion?: unknown;
  readonly catalogVersion?: unknown;
  readonly currency?: unknown;
  readonly tokenUnit?: unknown;
  readonly models?: unknown;
}

export class PricingCatalogError extends Error {
  public constructor(
    public readonly catalogPath: string,
    invariant: string,
    options?: ErrorOptions,
  ) {
    super(`Invalid pricing catalog at ${catalogPath}: ${invariant}`, options);
    this.name = "PricingCatalogError";
  }
}

export async function loadPricingCatalog(catalogPath: string): Promise<PricingCatalog> {
  let bytes: Buffer;
  try {
    bytes = await readFile(catalogPath);
  } catch (error) {
    throw new PricingCatalogError(catalogPath, "file is missing or unreadable", { cause: error });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new PricingCatalogError(catalogPath, "file is not valid JSON", { cause: error });
  }

  try {
    return parseCatalog(catalogPath, bytes, parsed);
  } catch (error) {
    if (error instanceof PricingCatalogError) throw error;
    throw new PricingCatalogError(
      catalogPath,
      error instanceof Error ? error.message : "catalog is invalid",
      { cause: error },
    );
  }
}

export function resolvePrice(
  catalog: PricingCatalog,
  observedModel: string,
  observationTime: Date | null,
): ResolvedPrice | null {
  const model = catalog.modelIndex.get(observedModel);
  if (!model || !observationTime || !Number.isFinite(observationTime.getTime())) return null;
  const instant = observationTime.getTime();
  const period = model.prices.find(
    (candidate) =>
      candidate.effectiveFrom.getTime() <= instant &&
      (candidate.effectiveTo === null || instant < candidate.effectiveTo.getTime()),
  );
  return period ? { observedModel, canonicalModel: model.id, period } : null;
}

function parseCatalog(path: string, bytes: Buffer, value: unknown): PricingCatalog {
  if (!isObject(value)) throw new Error("root must be an object");
  const json = value as JsonCatalog;
  if (json.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  const catalogVersion = identity(json.catalogVersion, "catalogVersion");
  if (json.currency !== "USD") throw new Error("currency must be USD");
  const tokenUnit = parseTokenUnit(json.tokenUnit);
  if (!Array.isArray(json.models) || json.models.length === 0) {
    throw new Error("models must be a non-empty array");
  }

  const models = json.models.map((model, index) => parseModel(model, index));
  const modelIndex = buildModelIndex(models);
  return Object.freeze({
    path,
    schemaVersion: 1,
    catalogVersion,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    currency: "USD",
    tokenUnit,
    models: Object.freeze(models),
    modelIndex,
  });
}

function parseModel(value: unknown, index: number): PricingModel {
  if (!isObject(value)) throw new Error(`models[${index}] must be an object`);
  const model = value as JsonModel;
  const id = identity(model.id, `models[${index}].id`);
  if (!Array.isArray(model.aliases)) throw new Error(`model ${id} aliases must be an array`);
  const aliases = model.aliases.map((alias, aliasIndex) =>
    identity(alias, `model ${id} aliases[${aliasIndex}]`),
  );
  if (!Array.isArray(model.prices) || model.prices.length === 0) {
    throw new Error(`model ${id} prices must be a non-empty array`);
  }
  const prices = model.prices
    .map((period, periodIndex) => parsePeriod(period, id, periodIndex))
    .sort((left, right) => left.effectiveFrom.getTime() - right.effectiveFrom.getTime());
  for (let index = 1; index < prices.length; index += 1) {
    const previous = prices[index - 1]!;
    const current = prices[index]!;
    if (previous.effectiveTo === null || previous.effectiveTo > current.effectiveFrom) {
      throw new Error(`model ${id} price periods overlap`);
    }
  }
  return Object.freeze({ id, aliases: Object.freeze(aliases), prices: Object.freeze(prices) });
}

function parsePeriod(value: unknown, modelId: string, index: number): PricePeriod {
  if (!isObject(value)) throw new Error(`model ${modelId} prices[${index}] must be an object`);
  const period = value as JsonPricePeriod;
  const effectiveFrom = utcInstant(period.effectiveFrom, `model ${modelId} effectiveFrom`);
  const effectiveTo =
    period.effectiveTo === null
      ? null
      : utcInstant(period.effectiveTo, `model ${modelId} effectiveTo`);
  if (effectiveTo !== null && effectiveFrom >= effectiveTo) {
    throw new Error(`model ${modelId} price period must end after it starts`);
  }
  return Object.freeze({
    effectiveFrom,
    effectiveTo,
    uncachedInputUsdPerUnit: rate(period.uncachedInputUsdPerUnit, modelId, "uncached input"),
    cachedInputUsdPerUnit: rate(period.cachedInputUsdPerUnit, modelId, "cached input"),
    outputUsdPerUnit: rate(period.outputUsdPerUnit, modelId, "output"),
  });
}

function buildModelIndex(models: readonly PricingModel[]): ReadonlyMap<string, PricingModel> {
  const index = new Map<string, PricingModel>();
  for (const model of models) {
    for (const identity of [model.id, ...model.aliases]) {
      const existing = index.get(identity);
      if (existing) {
        throw new Error(`identity ${identity} is assigned to both ${existing.id} and ${model.id}`);
      }
      index.set(identity, model);
    }
  }
  return index;
}

function identity(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new Error(`${field} must be a non-empty exact string`);
  }
  return value;
}

function rate(value: unknown, modelId: string, category: string): string {
  if (typeof value !== "string") throw new Error(`model ${modelId} ${category} rate is invalid`);
  try {
    parseFixedDecimal(value);
  } catch {
    throw new Error(`model ${modelId} ${category} rate is invalid`);
  }
  const [whole = "", fraction = ""] = value.split(".");
  if (whole.length > 14 || fraction.length > 18) {
    throw new Error(`model ${modelId} ${category} rate exceeds supported decimal precision`);
  }
  return value;
}

function parseTokenUnit(value: unknown): bigint {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new Error("tokenUnit must be a positive integer");
  }
  const unit = BigInt(value);
  let remaining = unit;
  while (remaining > 1n && remaining % 10n === 0n) remaining /= 10n;
  if (remaining !== 1n) throw new Error("tokenUnit must be a power of ten");
  return unit;
}

function utcInstant(value: unknown, field: string): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/u.test(value)
  ) {
    throw new Error(`${field} must be an exact UTC timestamp`);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${field} must be a valid UTC timestamp`);
  return parsed;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
