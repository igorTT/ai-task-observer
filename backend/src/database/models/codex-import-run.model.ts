import type { ImportRun, ImportRunState, ImportTrigger } from "@/modules/sessions/domain.js";

export interface CodexImportRunRow {
  readonly run_id: string;
  readonly trigger: ImportTrigger;
  readonly state: ImportRunState;
  readonly started_at: Date | null;
  readonly completed_at: Date | null;
  readonly roots_discovered: number;
  readonly files_discovered: number;
  readonly files_imported: number;
  readonly sessions_imported: number;
  readonly warning_count: number;
  readonly error_count: number;
  readonly summary: string | null;
}

export function mapImportRunRow(row: CodexImportRunRow): ImportRun {
  return {
    runId: row.run_id,
    trigger: row.trigger,
    state: row.state,
    ...(row.started_at === null ? {} : { startedAt: new Date(row.started_at) }),
    ...(row.completed_at === null ? {} : { completedAt: new Date(row.completed_at) }),
    rootsDiscovered: Number(row.roots_discovered),
    filesDiscovered: Number(row.files_discovered),
    filesImported: Number(row.files_imported),
    sessionsImported: Number(row.sessions_imported),
    warnings: Number(row.warning_count),
    errors: Number(row.error_count),
    ...(row.summary === null ? {} : { summary: row.summary }),
  };
}
