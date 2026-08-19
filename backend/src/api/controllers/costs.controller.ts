import { Controller, Get, Post, Route, SuccessResponse, Tags } from "tsoa";

import { apiDependencies } from "@/api/dependencies.js";
import type {
  CostCalculationStatusResponse,
  CostGenerationResponse,
  RecalculateCostResponse,
} from "@/api/models/cost-response.js";
import type { CostCalculationGeneration } from "@/database/models/cost-calculation-generation.model.js";

@Route("api/costs")
@Tags("Costs")
export class CostsController extends Controller {
  @Get("status")
  @SuccessResponse(200, "Status")
  public async costCalculationStatus(): Promise<CostCalculationStatusResponse> {
    const costs = apiDependencies().costs;
    if (!costs) throw new Error("Cost calculation dependency is not configured");
    const status = await costs.status();
    return {
      estimateKind: "configured_api_equivalent_usd",
      ...(status.latestCompleted
        ? { latestCompleted: generationResponse(status.latestCompleted) }
        : {}),
      ...(status.active ? { active: status.active } : {}),
      ...(status.queued ? { queued: status.queued } : {}),
      ...(status.latestFailure ? { latestFailure: generationResponse(status.latestFailure) } : {}),
      currentFactRevision: status.currentFactRevision,
      coverage: status.coverage,
      config: {
        schemaVersion: status.catalog.schemaVersion,
        catalogVersion: status.catalog.catalogVersion,
        contentHash: status.catalog.contentHash,
        currency: status.catalog.currency,
        tokenUnit: status.catalog.tokenUnit.toString(10),
      },
      calculatorVersion: status.calculatorVersion,
      acceptingWork: status.acceptingWork,
    };
  }

  @Post("recalculate")
  @SuccessResponse(202, "Accepted")
  public recalculateCosts(): RecalculateCostResponse {
    const costs = apiDependencies().costs;
    if (!costs) throw new Error("Cost calculation dependency is not configured");
    this.setStatus(202);
    return costs.recalculate();
  }
}

function generationResponse(generation: CostCalculationGeneration): CostGenerationResponse {
  return {
    generationId: generation.generationId,
    sourceFactRevision: generation.sourceFactRevision,
    state: generation.status,
    pricingSchemaVersion: generation.pricingSchemaVersion,
    pricingCatalogVersion: generation.pricingCatalogVersion,
    pricingContentHash: generation.pricingContentHash,
    calculatorVersion: generation.calculatorVersion,
    tokenUnit: generation.tokenUnit.toString(10),
    startedAt: generation.startedAt.toISOString(),
    ...(generation.completedAt ? { completedAt: generation.completedAt.toISOString() } : {}),
    ...(generation.failureCategory ? { failureCategory: generation.failureCategory } : {}),
  };
}
