import type { SessionAttributionResponse } from "@/api/models/linear-response.js";
import type { SessionPhase } from "@/modules/sessions/domain.js";

export interface SessionPhaseRequest {
  /** Canonical phase to assign, or null to clear the explicit assignment. */
  readonly phase: SessionPhase | null;
}

export interface SessionPhaseResponse {
  readonly attribution: SessionAttributionResponse;
}
