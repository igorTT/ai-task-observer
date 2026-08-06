import { Controller, Get, Post, Route, SuccessResponse, Tags } from "tsoa";

import { apiDependencies } from "@/api/dependencies.js";
import type {
  ImportRunResponse,
  ImportStatusResponse,
  RescanResponse,
} from "@/api/models/import-response.js";
import type { ImportRun } from "@/modules/sessions/domain.js";

@Route("api/imports")
@Tags("Imports")
export class ImportsController extends Controller {
  @Get("status")
  @SuccessResponse(200, "Status")
  public async importStatus(): Promise<ImportStatusResponse> {
    const status = await apiDependencies().ingestion.status();
    return {
      roots: status.roots.map((root) => ({
        root: root.root,
        available: root.available,
        ...(root.reason ? { reason: root.reason } : {}),
        discoveredFiles: root.files.length,
      })),
      ...(status.currentRun ? { currentRun: runResponse(status.currentRun) } : {}),
      ...(status.lastCompletedRun
        ? { lastCompletedRun: runResponse(status.lastCompletedRun) }
        : {}),
      checkpoints: status.checkpoints,
      acceptingWork: status.acceptingWork,
    };
  }

  @Post("rescan")
  @SuccessResponse(202, "Accepted")
  public async rescan(): Promise<RescanResponse> {
    this.setStatus(202);
    return apiDependencies().ingestion.rescan();
  }
}

function runResponse(run: ImportRun): ImportRunResponse {
  return {
    runId: run.runId,
    trigger: run.trigger,
    state: run.state,
    ...(run.startedAt ? { startedAt: run.startedAt.toISOString() } : {}),
    ...(run.completedAt ? { completedAt: run.completedAt.toISOString() } : {}),
    rootsDiscovered: run.rootsDiscovered,
    filesDiscovered: run.filesDiscovered,
    filesImported: run.filesImported,
    sessionsImported: run.sessionsImported,
    warnings: run.warnings,
    errors: run.errors,
    ...(run.summary ? { summary: run.summary } : {}),
  };
}
