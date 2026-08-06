import type { IngestionCoordinator } from "@/modules/sessions/coordinator.js";
import type { SessionQueryService } from "@/modules/sessions/session-query-service.js";

export interface ApiDependencies {
  readonly ingestion: Pick<IngestionCoordinator, "status" | "rescan">;
  readonly sessions: SessionQueryService;
}

let dependencies: ApiDependencies | undefined;

export function configureApiDependencies(next: ApiDependencies): void {
  dependencies = next;
}

export function apiDependencies(): ApiDependencies {
  if (!dependencies) throw new Error("API dependencies have not been configured");
  return dependencies;
}
