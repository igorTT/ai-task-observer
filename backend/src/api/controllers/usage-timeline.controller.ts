import { Controller, Get, Query, Response, Route, SuccessResponse, Tags } from "tsoa";

import { apiDependencies } from "@/api/dependencies.js";
import type { ErrorResponse } from "@/api/models/session-response.js";
import type {
  UsageTimelineResponse,
  UsageTimelineSessionPhaseResponse,
} from "@/api/models/usage-timeline-response.js";
import { usageTimelineRange, usageTimelineSessionPhase } from "@/modules/usage-timeline/domain.js";

@Route("api/usage")
@Tags("Usage timeline")
export class UsageTimelineController extends Controller {
  /** Returns committed usage in a supported rolling range and optional current session phase. */
  @Get("timeline")
  @SuccessResponse(200, "Usage timeline")
  @Response<ErrorResponse>(422, "Unsupported usage range or session phase")
  public async timeline(
    @Query() range?: string,
    @Query() sessionPhase?: UsageTimelineSessionPhaseResponse,
  ): Promise<UsageTimelineResponse> {
    const service = apiDependencies().usageTimeline;
    if (!service) throw new Error("Usage timeline dependency is not configured");
    return service.get(usageTimelineRange(range), usageTimelineSessionPhase(sessionPhase));
  }
}
