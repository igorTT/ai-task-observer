import type { IngestionCoordinator } from "@/modules/sessions/coordinator.js";
import type { SessionQueryService } from "@/modules/sessions/session-query-service.js";
import type { AttributionCoordinator } from "@/modules/linear/coordinator.js";
import type { CostCalculationCoordinator } from "@/modules/pricing/coordinator.js";
import type { IssueUsageQueryService } from "@/modules/issues/issue-usage-query-service.js";
import type { UsageTimelineQueryService } from "@/modules/usage-timeline/query-service.js";
import type { SessionPhaseService } from "@/modules/sessions/session-phase-service.js";

export interface ApiDependencies {
  readonly ingestion: Pick<IngestionCoordinator, "status" | "rescan">;
  readonly sessions: SessionQueryService;
  readonly phase?: SessionPhaseService;
  readonly linear: Pick<AttributionCoordinator, "status" | "sync" | "relink">;
  readonly costs?: Pick<CostCalculationCoordinator, "status" | "recalculate">;
  readonly issueUsage?: IssueUsageQueryService;
  readonly usageTimeline?: UsageTimelineQueryService;
}

let dependencies: ApiDependencies | undefined;

export function configureApiDependencies(next: ApiDependencies): void {
  dependencies = next;
}

export function apiDependencies(): ApiDependencies {
  if (!dependencies) throw new Error("API dependencies have not been configured");
  return dependencies;
}
