export interface CostGenerationResponse {
  readonly generationId: string;
  readonly sourceFactRevision: string;
  readonly state: "running" | "completed" | "failed";
  readonly pricingSchemaVersion: number;
  readonly pricingCatalogVersion: string;
  readonly pricingContentHash: string;
  readonly calculatorVersion: string;
  readonly tokenUnit: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly failureCategory?: "calculation_failed";
}

export interface CostWorkResponse {
  readonly generationId: string;
  readonly state: "running" | "queued";
}

export interface CostConfigurationResponse {
  readonly schemaVersion: number;
  readonly catalogVersion: string;
  readonly contentHash: string;
  readonly currency: "USD";
  readonly tokenUnit: string;
}

export interface CostCalculationStatusResponse {
  readonly estimateKind: "configured_api_equivalent_usd";
  readonly latestCompleted?: CostGenerationResponse;
  readonly active?: CostWorkResponse;
  readonly queued?: CostWorkResponse;
  readonly latestFailure?: CostGenerationResponse;
  readonly currentFactRevision: string;
  readonly coverage: "current" | "stale" | "missing";
  readonly config: CostConfigurationResponse;
  readonly calculatorVersion: string;
  readonly acceptingWork: boolean;
}

export interface RecalculateCostResponse extends CostWorkResponse {
  readonly coalesced: boolean;
}
