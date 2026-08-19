import { randomUUID } from "node:crypto";

import type { Logger } from "pino";

import type { CostCalculationGeneration } from "@/database/models/cost-calculation-generation.model.js";
import type { PricingCatalog } from "@/modules/pricing/domain.js";

export interface CostCalculationOperations {
  readonly catalog: PricingCatalog;
  readonly calculatorVersion: string;
  readonly calculate: (generationId?: string) => Promise<CostCalculationGeneration>;
  readonly currentRevision: () => Promise<string>;
  readonly latestCompleted: () => Promise<CostCalculationGeneration | undefined>;
  readonly latestFailed: () => Promise<CostCalculationGeneration | undefined>;
  readonly completedForCurrentIdentity: () => Promise<CostCalculationGeneration | undefined>;
}

export interface CalculationWorkState {
  readonly generationId: string;
  readonly state: "running" | "queued";
}

export interface RecalculationResult extends CalculationWorkState {
  readonly coalesced: boolean;
}

export interface CostCalculationStatusSnapshot {
  readonly latestCompleted?: CostCalculationGeneration;
  readonly active?: CalculationWorkState;
  readonly queued?: CalculationWorkState;
  readonly latestFailure?: CostCalculationGeneration;
  readonly currentFactRevision: string;
  readonly coverage: "current" | "stale" | "missing";
  readonly catalog: PricingCatalog;
  readonly calculatorVersion: string;
  readonly acceptingWork: boolean;
}

export interface CostCalculationCoordinatorOptions {
  readonly service: CostCalculationOperations;
  readonly logger: Logger;
  readonly debounceMs: number;
  readonly createId?: () => string;
}

export class CostCalculationCoordinator {
  readonly #service: CostCalculationOperations;
  readonly #logger: Logger;
  readonly #debounceMs: number;
  readonly #createId: () => string;
  #acceptingWork = false;
  #active: CalculationWorkState | undefined;
  #queued: CalculationWorkState | undefined;
  #activePromise: Promise<void> | undefined;
  #debounceTimer: NodeJS.Timeout | undefined;

  public constructor(options: CostCalculationCoordinatorOptions) {
    this.#service = options.service;
    this.#logger = options.logger;
    this.#debounceMs = options.debounceMs;
    this.#createId = options.createId ?? randomUUID;
  }

  public async start(): Promise<void> {
    if (this.#acceptingWork) return;
    this.#acceptingWork = true;
    if (await this.#service.completedForCurrentIdentity()) return;
    const generationId = this.#createId();
    this.#startRun(generationId, true);
    await this.#activePromise;
  }

  public notifyCommitted(): void {
    if (!this.#acceptingWork) return;
    this.#queued ??= { generationId: this.#createId(), state: "queued" };
    if (this.#active) return;
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = undefined;
      this.#startQueued();
    }, this.#debounceMs);
    this.#debounceTimer.unref();
  }

  public recalculate(): RecalculationResult {
    if (!this.#acceptingWork) throw new Error("Cost calculation is shutting down");
    if (this.#active) {
      const coalesced = this.#queued !== undefined;
      this.#queued ??= { generationId: this.#createId(), state: "queued" };
      return { ...this.#queued, coalesced };
    }
    if (this.#queued) {
      const queued = this.#queued;
      if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
      this.#debounceTimer = undefined;
      this.#startQueued();
      return { generationId: queued.generationId, state: "running", coalesced: true };
    }
    const generationId = this.#createId();
    this.#startRun(generationId, false);
    return { generationId, state: "running", coalesced: false };
  }

  public async status(): Promise<CostCalculationStatusSnapshot> {
    const active = this.#active;
    const queued = this.#queued;
    const [latestCompleted, latestFailure, currentFactRevision] = await Promise.all([
      this.#service.latestCompleted(),
      this.#service.latestFailed(),
      this.#service.currentRevision(),
    ]);
    const coverage = latestCompleted
      ? latestCompleted.sourceFactRevision === currentFactRevision &&
        latestCompleted.pricingContentHash === this.#service.catalog.contentHash &&
        latestCompleted.calculatorVersion === this.#service.calculatorVersion
        ? "current"
        : "stale"
      : "missing";
    return {
      ...(latestCompleted ? { latestCompleted } : {}),
      ...(active ? { active } : {}),
      ...(queued ? { queued } : {}),
      ...(latestFailure ? { latestFailure } : {}),
      currentFactRevision,
      coverage,
      catalog: this.#service.catalog,
      calculatorVersion: this.#service.calculatorVersion,
      acceptingWork: this.#acceptingWork,
    };
  }

  public async close(): Promise<void> {
    this.#acceptingWork = false;
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = undefined;
    this.#queued = undefined;
    await this.#activePromise;
  }

  #startQueued(): void {
    if (!this.#queued || this.#active || !this.#acceptingWork) return;
    const generationId = this.#queued.generationId;
    this.#queued = undefined;
    this.#startRun(generationId, false);
  }

  #startRun(generationId: string, propagateFailure: boolean): void {
    if (this.#active) return;
    this.#active = { generationId, state: "running" };
    const run = this.#service
      .calculate(generationId)
      .then(() => undefined)
      .catch((error: unknown) => {
        this.#logger.error(
          { category: "calculation_failed", error: errorName(error) },
          "Cost calculation failed",
        );
        if (propagateFailure) throw error;
      })
      .finally(() => {
        this.#active = undefined;
        if (this.#activePromise === run) this.#activePromise = undefined;
        this.#startQueued();
      });
    this.#activePromise = run;
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "Error";
}
