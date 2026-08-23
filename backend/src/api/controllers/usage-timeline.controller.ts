import { Controller, Get, Query, Response, Route, SuccessResponse, Tags } from "tsoa";

import { apiDependencies } from "@/api/dependencies.js";
import type { ErrorResponse } from "@/api/models/session-response.js";
import type { UsageTimelineResponse } from "@/api/models/usage-timeline-response.js";
import { usageTimelineRange } from "@/modules/usage-timeline/domain.js";

@Route("api/usage")
@Tags("Usage timeline")
export class UsageTimelineController extends Controller {
  /** Returns global committed usage in a supported rolling range. */
  @Get("timeline")
  @SuccessResponse(200, "Usage timeline")
  @Response<ErrorResponse>(422, "Unsupported usage range")
  public async timeline(@Query() range?: string): Promise<UsageTimelineResponse> {
    const service = apiDependencies().usageTimeline;
    if (!service) throw new Error("Usage timeline dependency is not configured");
    return service.get(usageTimelineRange(range));
  }
}
