import { Controller, Get, Post, Response, Route, SuccessResponse, Tags } from "tsoa";

import { apiDependencies } from "@/api/dependencies.js";
import { linearRunResponse } from "@/api/models/linear-response.js";
import type { LinearStatusResponse, LinearSyncResponse } from "@/api/models/linear-response.js";
import type { ErrorResponse } from "@/api/models/session-response.js";

@Route("api/linear")
@Tags("Linear")
export class LinearController extends Controller {
  @Get("status")
  @SuccessResponse(200, "Linear integration status")
  public async status(): Promise<LinearStatusResponse> {
    const status = await apiDependencies().linear.status();
    return {
      configured: status.configured,
      state: status.state,
      acceptingWork: status.acceptingWork,
      counts: status.counts,
      ...(status.currentRun ? { currentRun: linearRunResponse(status.currentRun) } : {}),
      ...(status.lastCompletedRun
        ? { lastCompletedRun: linearRunResponse(status.lastCompletedRun) }
        : {}),
    };
  }

  @Post("sync")
  @SuccessResponse(202, "Synchronization accepted")
  @Response<ErrorResponse>(409, "Linear is not configured")
  public async sync(): Promise<LinearSyncResponse> {
    this.setStatus(202);
    return apiDependencies().linear.sync();
  }
}
