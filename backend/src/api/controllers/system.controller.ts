import { Controller, Get, Route, SuccessResponse, Tags } from "tsoa";

import type { HealthResponse } from "@/api/models/health-response.js";

@Route("api")
@Tags("System")
export class SystemController extends Controller {
  @Get("health")
  @SuccessResponse(200, "Healthy")
  public getHealth(): HealthResponse {
    return { status: "healthy" };
  }
}
