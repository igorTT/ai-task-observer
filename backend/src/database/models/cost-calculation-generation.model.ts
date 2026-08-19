export type CostCalculationStatus = "running" | "completed" | "failed";
export type CostCalculationFailureCategory = "calculation_failed";

export interface CostCalculationGenerationRow {
  readonly generation_id: string;
  readonly source_fact_revision: string;
  readonly status: CostCalculationStatus;
  readonly pricing_schema_version: number;
  readonly pricing_catalog_version: string;
  readonly pricing_content_hash: string;
  readonly calculator_version: string;
  readonly token_unit: bigint;
  readonly started_at: Date;
  readonly completed_at: Date | null;
  readonly failure_category: CostCalculationFailureCategory | null;
}

export interface CostCalculationGeneration {
  readonly generationId: string;
  readonly sourceFactRevision: string;
  readonly status: CostCalculationStatus;
  readonly pricingSchemaVersion: number;
  readonly pricingCatalogVersion: string;
  readonly pricingContentHash: string;
  readonly calculatorVersion: string;
  readonly tokenUnit: bigint;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  readonly failureCategory: CostCalculationFailureCategory | null;
}

export function mapCostCalculationGenerationRow(
  row: CostCalculationGenerationRow,
): CostCalculationGeneration {
  return {
    generationId: row.generation_id,
    sourceFactRevision: row.source_fact_revision,
    status: row.status,
    pricingSchemaVersion: Number(row.pricing_schema_version),
    pricingCatalogVersion: row.pricing_catalog_version,
    pricingContentHash: row.pricing_content_hash,
    calculatorVersion: row.calculator_version,
    tokenUnit: BigInt(row.token_unit),
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at === null ? null : new Date(row.completed_at),
    failureCategory: row.failure_category,
  };
}
