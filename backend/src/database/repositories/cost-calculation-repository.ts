import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapCostCalculationGenerationRow,
  type CostCalculationFailureCategory,
  type CostCalculationGeneration,
  type CostCalculationGenerationRow,
} from "@/database/models/cost-calculation-generation.model.js";
import {
  mapCostCalculationItemRow,
  type CostCalculationItem,
  type CostCalculationItemRow,
} from "@/database/models/cost-calculation-item.model.js";
import type { PricedObservation, PricingCatalog } from "@/modules/pricing/domain.js";
import type { UsageObservation } from "@/modules/sessions/domain.js";

export interface NewCostCalculationGeneration {
  readonly generationId: string;
  readonly sourceFactRevision: string;
  readonly catalog: PricingCatalog;
  readonly calculatorVersion: string;
  readonly startedAt: Date;
}

export interface CompletedCostCalculationItem {
  readonly source: UsageObservation;
  readonly priced: PricedObservation;
}

export class CostCalculationRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async create(input: NewCostCalculationGeneration): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO cost_calculation_generations (
        generation_id, source_fact_revision, status, pricing_schema_version,
        pricing_catalog_version, pricing_content_hash, calculator_version, token_unit, started_at
      ) VALUES (
        $generationId, $sourceFactRevision, 'running', $schemaVersion,
        $catalogVersion, $contentHash, $calculatorVersion, $tokenUnit, $startedAt
      )
    `);
    statement.bind({
      generationId: input.generationId,
      sourceFactRevision: input.sourceFactRevision,
      schemaVersion: input.catalog.schemaVersion,
      catalogVersion: input.catalog.catalogVersion,
      contentHash: input.catalog.contentHash,
      calculatorVersion: input.calculatorVersion,
      tokenUnit: input.catalog.tokenUnit,
      startedAt: input.startedAt.toISOString(),
    });
    await statement.run();
  }

  public async complete(
    generationId: string,
    items: readonly CompletedCostCalculationItem[],
    completedAt: Date,
  ): Promise<void> {
    let transactionActive = false;
    try {
      await this.connection.run("BEGIN TRANSACTION");
      transactionActive = true;
      const statement = await this.connection.prepare(`
        UPDATE cost_calculation_generations
        SET status = 'completed', completed_at = $completedAt
        WHERE generation_id = $generationId AND status = 'running'
      `);
      statement.bind({ generationId, completedAt: completedAt.toISOString() });
      await statement.run();
      for (const item of items) await this.#insertItem(generationId, item);
      await this.connection.run("COMMIT");
      transactionActive = false;
    } catch (error) {
      if (transactionActive) {
        try {
          await this.connection.run("ROLLBACK");
        } catch {
          // Preserve the original completion failure.
        }
      }
      throw error;
    }
  }

  public async fail(
    generationId: string,
    category: CostCalculationFailureCategory,
    completedAt: Date,
  ): Promise<void> {
    const statement = await this.connection.prepare(`
      UPDATE cost_calculation_generations
      SET status = 'failed', completed_at = $completedAt, failure_category = $category
      WHERE generation_id = $generationId AND status = 'running'
    `);
    statement.bind({ generationId, category, completedAt: completedAt.toISOString() });
    await statement.run();
  }

  public async find(generationId: string): Promise<CostCalculationGeneration | undefined> {
    const statement = await this.connection.prepare(`
      SELECT * FROM cost_calculation_generations WHERE generation_id = $generationId
    `);
    statement.bind({ generationId });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CostCalculationGenerationRow[])[0];
    return row ? mapCostCalculationGenerationRow(row) : undefined;
  }

  public async latestCompleted(): Promise<CostCalculationGeneration | undefined> {
    return this.#latestWithStatus("completed");
  }

  public async latestFailed(): Promise<CostCalculationGeneration | undefined> {
    return this.#latestWithStatus("failed");
  }

  public async findCompletedIdentity(
    sourceFactRevision: string,
    pricingContentHash: string,
    calculatorVersion: string,
  ): Promise<CostCalculationGeneration | undefined> {
    const statement = await this.connection.prepare(`
      SELECT * FROM cost_calculation_generations
      WHERE status = 'completed'
        AND source_fact_revision = $sourceFactRevision
        AND pricing_content_hash = $pricingContentHash
        AND calculator_version = $calculatorVersion
      ORDER BY completed_at DESC, started_at DESC
      LIMIT 1
    `);
    statement.bind({ sourceFactRevision, pricingContentHash, calculatorVersion });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CostCalculationGenerationRow[])[0];
    return row ? mapCostCalculationGenerationRow(row) : undefined;
  }

  public async listItems(generationId: string): Promise<CostCalculationItem[]> {
    const statement = await this.connection.prepare(`
      SELECT * FROM cost_calculation_items
      WHERE generation_id = $generationId
      ORDER BY observation_id
    `);
    statement.bind({ generationId });
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as CostCalculationItemRow[]).map(
      mapCostCalculationItemRow,
    );
  }

  async #latestWithStatus(
    status: "completed" | "failed",
  ): Promise<CostCalculationGeneration | undefined> {
    const statement = await this.connection.prepare(`
      SELECT * FROM cost_calculation_generations
      WHERE status = $status
      ORDER BY completed_at DESC, started_at DESC
      LIMIT 1
    `);
    statement.bind({ status });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CostCalculationGenerationRow[])[0];
    return row ? mapCostCalculationGenerationRow(row) : undefined;
  }

  async #insertItem(
    generationId: string,
    { source, priced }: CompletedCostCalculationItem,
  ): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO cost_calculation_items (
        generation_id, observation_id, session_id, source_path, source_identity,
        source_record_number, observed_model, observation_time, canonical_model,
        price_effective_from, price_effective_to,
        uncached_input_rate, cached_input_rate, output_rate,
        uncached_input_tokens, cached_input_tokens, output_tokens,
        uncached_input_cost_usd, cached_input_cost_usd, output_cost_usd,
        estimated_cost_usd, cost_complete, gap_codes, anomaly_codes
      ) VALUES (
        $generationId, $observationId, $sessionId, $sourcePath, $sourceIdentity,
        $sourceRecordNumber, $observedModel, $observationTime, $canonicalModel,
        $effectiveFrom, $effectiveTo,
        CAST($uncachedRate AS DECIMAL(38, 24)),
        CAST($cachedRate AS DECIMAL(38, 24)),
        CAST($outputRate AS DECIMAL(38, 24)),
        $uncachedTokens, $cachedTokens, $outputTokens,
        CAST($uncachedCost AS DECIMAL(38, 24)),
        CAST($cachedCost AS DECIMAL(38, 24)),
        CAST($outputCost AS DECIMAL(38, 24)),
        CAST($estimatedCost AS DECIMAL(38, 24)),
        $costComplete, $gapCodes, $anomalyCodes
      )
    `);
    statement.bind({
      generationId,
      observationId: source.observationId,
      sessionId: source.sessionId,
      sourcePath: source.sourcePath,
      sourceIdentity: source.sourceIdentity,
      sourceRecordNumber: source.sourceRecordNumber,
      observedModel: source.model,
      observationTime: source.eventTime?.toISOString() ?? null,
      canonicalModel: priced.canonicalModel,
      effectiveFrom: priced.effectiveFrom?.toISOString() ?? null,
      effectiveTo: priced.effectiveTo?.toISOString() ?? null,
      uncachedRate: priced.rates?.uncachedInputUsdPerUnit ?? null,
      cachedRate: priced.rates?.cachedInputUsdPerUnit ?? null,
      outputRate: priced.rates?.outputUsdPerUnit ?? null,
      uncachedTokens: priced.uncachedInputTokens,
      cachedTokens: priced.cachedInputTokens,
      outputTokens: priced.outputTokens,
      uncachedCost: priced.uncachedInputUsd,
      cachedCost: priced.cachedInputUsd,
      outputCost: priced.outputUsd,
      estimatedCost: priced.estimatedCostUsd,
      costComplete: priced.costComplete,
      gapCodes: JSON.stringify(priced.gapCodes),
      anomalyCodes: JSON.stringify(priced.anomalyCodes),
    });
    await statement.run();
  }
}
