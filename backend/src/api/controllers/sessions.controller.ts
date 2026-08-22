import {
  Body,
  Controller,
  Get,
  Path,
  Post,
  Query,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from "tsoa";

import { apiDependencies } from "@/api/dependencies.js";
import type {
  SessionRelinkErrorResponse,
  SessionRelinkRequest,
  SessionRelinkResponse,
} from "@/api/models/linear-response.js";
import type {
  ErrorResponse,
  SessionPageResponse,
  SessionResponse,
} from "@/api/models/session-response.js";

@Route("api/sessions")
@Tags("Sessions")
export class SessionsController extends Controller {
  @Get()
  @SuccessResponse(200, "Session page")
  public async list(@Query() limit = 50, @Query() offset = 0): Promise<SessionPageResponse> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const boundedOffset = Math.max(offset, 0);
    return apiDependencies().sessions.list(boundedLimit, boundedOffset);
  }

  @Get("{sessionId}")
  @SuccessResponse(200, "Session detail")
  @Response<ErrorResponse>(404, "Session not found")
  public async detail(@Path() sessionId: string): Promise<SessionResponse> {
    const session = await apiDependencies().sessions.find(sessionId);
    if (!session) throw new SessionNotFoundError();
    return session;
  }

  @Post("{sessionId}/relink")
  @SuccessResponse(200, "Session attribution relinked")
  @Response<SessionRelinkErrorResponse>(404, "Session or Linear issue not found")
  @Response<SessionRelinkErrorResponse>(409, "Linear integration is not configured")
  @Response<SessionRelinkErrorResponse>(422, "Invalid Linear issue identifier")
  @Response<SessionRelinkErrorResponse>(502, "Linear rejected or mismatched the exact lookup")
  @Response<SessionRelinkErrorResponse>(503, "Linear exact lookup temporarily unavailable")
  public async relink(
    @Path() sessionId: string,
    @Body() request: SessionRelinkRequest,
  ): Promise<SessionRelinkResponse> {
    await apiDependencies().linear.relink(sessionId, request.issueIdentifier);
    const session = await apiDependencies().sessions.find(sessionId);
    if (!session) throw new SessionNotFoundError();
    return { attribution: session.attribution };
  }
}

class SessionNotFoundError extends Error {
  public readonly status = 404;

  public constructor() {
    super("Session was not found");
    this.name = "SessionNotFoundError";
  }
}
