import { randomUUID } from "node:crypto";

import type { AppDatabase } from "@/database/database.js";
import type { CostCalculationGeneration } from "@/database/models/cost-calculation-generation.model.js";
import { CostCalculationRepository } from "@/database/repositories/cost-calculation-repository.js";
import { CodexUsageObservationRepository } from "@/database/repositories/codex-usage-observation-repository.js";
import { calculateObservationCost } from "@/modules/pricing/calculator.js";
import {
  CALCULATOR_VERSION,
  type PricedObservation,
  type PricingCatalog,
} from "@/modules/pricing/domain.js";
import type { UsageObservation } from "@/modules/sessions/domain.js";

export interface CalculationServiceOptions {
  readonly database: AppDatabase;
  readonly catalog: PricingCatalog;
  readonly calculatorVersion?: string;
  readonly calculateObservation?: (
    catalog: PricingCatalog,
    observation: UsageObservation,
  ) => PricedObservation;
  readonly createId?: () => string;
  readonly now?: () => Date;
}

export class CostCalculationService {
  readonly #database: AppDatabase;
  readonly #catalog: PricingCatalog;
  readonly #calculatorVersion: string;
  readonly #calculateObservation: NonNullable<CalculationServiceOptions["calculateObservation"]>;
  readonly #createId: () => string;
  readonly #now: () => Date;
  readonly #observations: CodexUsageObservationRepository;
  readonly #generations: CostCalculationRepository;

  public constructor(options: CalculationServiceOptions) {
    this.#database = options.database;
    this.#catalog = options.catalog;
    this.#calculatorVersion = options.calculatorVersion ?? CALCULATOR_VERSION;
    this.#calculateObservation = options.calculateObservation ?? calculateObservationCost;
    this.#createId = options.createId ?? randomUUID;
    this.#now = options.now ?? (() => new Date());
    this.#observations = new CodexUsageObservationRepository(options.database.connection);
    this.#generations = new CostCalculationRepository(options.database.connection);
  }

  public get catalog(): PricingCatalog {
    return this.#catalog;
  }

  public get calculatorVersion(): string {
    return this.#calculatorVersion;
  }

  public async calculate(requestedGenerationId?: string): Promise<CostCalculationGeneration> {
    return this.#database.exclusiveWrite(async () => {
      const snapshot = await this.#observations.stableSnapshot();
      const generationId = requestedGenerationId ?? this.#createId();
      await this.#generations.create({
        generationId,
        sourceFactRevision: snapshot.revision,
        catalog: this.#catalog,
        calculatorVersion: this.#calculatorVersion,
        startedAt: this.#now(),
      });
      try {
        const items = snapshot.observations.map((source) => ({
          source,
          priced: this.#calculateObservation(this.#catalog, source),
        }));
        await this.#generations.complete(generationId, items, this.#now());
      } catch (error) {
        await this.#generations.fail(generationId, "calculation_failed", this.#now());
        throw error;
      }
      const completed = await this.#generations.find(generationId);
      if (!completed) throw new Error("Completed cost generation could not be read");
      return completed;
    });
  }

  public async currentRevision(): Promise<string> {
    return this.#database.exclusiveWrite(
      async () => (await this.#observations.stableSnapshot()).revision,
    );
  }

  public async latestCompleted(): Promise<CostCalculationGeneration | undefined> {
    return this.#database.exclusiveWrite(() => this.#generations.latestCompleted());
  }

  public async latestFailed(): Promise<CostCalculationGeneration | undefined> {
    return this.#database.exclusiveWrite(() => this.#generations.latestFailed());
  }

  public async completedForCurrentIdentity(): Promise<CostCalculationGeneration | undefined> {
    return this.#database.exclusiveWrite(async () => {
      const revision = (await this.#observations.stableSnapshot()).revision;
      return this.#generations.findCompletedIdentity(
        revision,
        this.#catalog.contentHash,
        this.#calculatorVersion,
      );
    });
  }
}
