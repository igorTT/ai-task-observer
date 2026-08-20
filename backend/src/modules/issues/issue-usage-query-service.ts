import type {
  IssueUsageDailyResponse,
  IssueUsageDetailResponse,
  IssueUsageListResponse,
  IssueUsageModelResponse,
  IssueUsageSessionResponse,
  IssueUsageSummaryResponse,
  UsageMetricsResponse,
} from "@/api/models/issue-usage-response.js";
import type { IssueUsageMetrics } from "@/database/models/issue-usage.model.js";
import type { CostCalculationRepository } from "@/database/repositories/cost-calculation-repository.js";
import type { IssueUsageRepository } from "@/database/repositories/issue-usage-repository.js";

export class IssueUsageQueryService {
  public constructor(
    private readonly usage: IssueUsageRepository,
    private readonly costs: CostCalculationRepository,
  ) {}

  public async list(limit: number, offset: number): Promise<IssueUsageListResponse> {
    const [records, total] = await Promise.all([
      this.usage.listIssues(limit, offset),
      this.usage.countIssues(),
    ]);
    return {
      items: records.map(summaryResponse),
      total: total.toString(10),
      limit,
      offset,
    };
  }

  public async find(linearId: string): Promise<IssueUsageDetailResponse | undefined> {
    const summary = await this.usage.findIssue(linearId);
    if (!summary) return undefined;
    const [sessions, models, daily, generation] = await Promise.all([
      this.usage.listSessions(linearId),
      this.usage.listModels(linearId),
      this.usage.listDaily(linearId),
      this.costs.latestCompleted(),
    ]);
    const sessionResponses = await Promise.all(
      sessions.map(async (session): Promise<IssueUsageSessionResponse> => ({
        sessionId: session.sessionId,
        title: session.title,
        phase: session.phase,
        importState: session.importState,
        lastError: session.lastError,
        startedAt: session.startedAt?.toISOString() ?? null,
        endedAt: session.endedAt?.toISOString() ?? null,
        metrics: metricsResponse(session.metrics),
        models: (await this.usage.listModels(linearId, session.sessionId)).map(modelResponse),
      })),
    );
    return {
      ...summaryResponse(summary),
      latestCompletedCostGeneration: generation
        ? {
            generationId: generation.generationId,
            sourceFactRevision: generation.sourceFactRevision,
            pricingCatalogVersion: generation.pricingCatalogVersion,
            pricingContentHash: generation.pricingContentHash,
            calculatorVersion: generation.calculatorVersion,
            completedAt: generation.completedAt!.toISOString(),
          }
        : null,
      sessions: sessionResponses,
      models: models.map(modelResponse),
      daily: daily.map(dailyResponse),
    };
  }
}

function summaryResponse(
  record: Awaited<ReturnType<IssueUsageRepository["listIssues"]>>[number],
): IssueUsageSummaryResponse {
  return {
    issue: {
      id: record.linearId,
      identifier: record.identifier,
      title: record.title,
      url: record.url,
    },
    metrics: metricsResponse(record.metrics),
  };
}

function modelResponse(
  record: Awaited<ReturnType<IssueUsageRepository["listModels"]>>[number],
): IssueUsageModelResponse {
  return {
    model: record.model,
    observedModels: record.observedModels,
    metrics: metricsResponse(record.metrics),
  };
}

function dailyResponse(
  record: Awaited<ReturnType<IssueUsageRepository["listDaily"]>>[number],
): IssueUsageDailyResponse {
  return {
    date: record.date?.toISOString().slice(0, 10) ?? null,
    metrics: metricsResponse(record.metrics),
  };
}

export function metricsResponse(metrics: IssueUsageMetrics): UsageMetricsResponse {
  return {
    sessionCount: metrics.sessionCount.toString(10),
    developerTurns: metrics.developerTurns.toString(10),
    inputTokens: nullableCount(metrics.inputTokens),
    cachedInputTokens: nullableCount(metrics.cachedInputTokens),
    outputTokens: nullableCount(metrics.outputTokens),
    totalTokens: nullableCount(metrics.totalTokens),
    estimatedCostUsd: metrics.estimatedCostUsd,
    tokenComplete: metrics.tokenComplete,
    costComplete: metrics.costComplete,
    anomalyCodes: metrics.anomalyCodes,
    pricingGapCodes: metrics.pricingGapCodes,
  };
}

function nullableCount(value: bigint | null): string | null {
  return value === null ? null : value.toString(10);
}
