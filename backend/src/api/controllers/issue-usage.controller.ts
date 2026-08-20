import { Controller, Get, Path, Query, Response, Route, SuccessResponse, Tags } from "tsoa";

import { apiDependencies } from "@/api/dependencies.js";
import type {
  IssueUsageDetailResponse,
  IssueUsageListResponse,
} from "@/api/models/issue-usage-response.js";
import type { ErrorResponse } from "@/api/models/session-response.js";

@Route("api/issues")
@Tags("Issue usage")
export class IssueUsageController extends Controller {
  /** Lists usage-bearing issues in identifier-then-stable-ID order. */
  @Get("usage")
  @SuccessResponse(200, "Issue usage page")
  @Response<ErrorResponse>(422, "Invalid pagination")
  public async listIssueUsage(
    @Query() limit = 50,
    @Query() offset = 0,
  ): Promise<IssueUsageListResponse> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new IssueUsageRequestError("limit must be an integer between 1 and 100");
    }
    if (!Number.isInteger(offset) || offset < 0) {
      throw new IssueUsageRequestError("offset must be a non-negative integer");
    }
    return issueUsageService().list(limit, offset);
  }

  /** Retrieves current committed-link accounting for one stable Linear issue ID. */
  @Get("{issueId}/usage")
  @SuccessResponse(200, "Issue usage detail")
  @Response<ErrorResponse>(404, "Issue has no currently linked sessions")
  public async getIssueUsage(@Path() issueId: string): Promise<IssueUsageDetailResponse> {
    const detail = await issueUsageService().find(issueId);
    if (!detail) throw new IssueUsageNotFoundError();
    return detail;
  }
}

function issueUsageService() {
  const service = apiDependencies().issueUsage;
  if (!service) throw new Error("Issue usage dependency is not configured");
  return service;
}

class IssueUsageRequestError extends Error {
  public readonly status = 422;
  public readonly code = "validation_error";

  public constructor(message: string) {
    super(message);
    this.name = "IssueUsageRequestError";
  }
}

class IssueUsageNotFoundError extends Error {
  public readonly status = 404;
  public readonly code = "not_found";

  public constructor() {
    super("Issue usage was not found");
    this.name = "IssueUsageNotFoundError";
  }
}
