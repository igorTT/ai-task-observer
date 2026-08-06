import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapImportRunRow,
  type CodexImportRunRow,
} from "@/database/models/codex-import-run.model.js";
import type { ImportRun, ImportRunState, ImportTrigger } from "@/modules/sessions/domain.js";

export class CodexImportRunRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async create(runId: string, trigger: ImportTrigger): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO codex_import_runs (run_id, trigger, state)
      VALUES ($runId, $trigger, 'queued')
    `);
    statement.bind({ runId, trigger });
    await statement.run();
  }

  public async setState(runId: string, state: ImportRunState, summary?: string): Promise<void> {
    const statement = await this.connection.prepare(`
      UPDATE codex_import_runs SET
        state = $state,
        started_at = CASE WHEN $state = 'running' THEN coalesce(started_at, now()) ELSE started_at END,
        completed_at = CASE WHEN $state IN ('completed', 'failed') THEN now() ELSE completed_at END,
        summary = $summary,
        updated_at = now()
      WHERE run_id = $runId
    `);
    statement.bind({ runId, state, summary: summary ?? null });
    await statement.run();
  }

  public async addProgress(
    runId: string,
    progress: Partial<
      Pick<
        ImportRun,
        | "rootsDiscovered"
        | "filesDiscovered"
        | "filesImported"
        | "sessionsImported"
        | "warnings"
        | "errors"
      >
    >,
  ): Promise<void> {
    const statement = await this.connection.prepare(`
      UPDATE codex_import_runs SET
        roots_discovered = roots_discovered + $roots,
        files_discovered = files_discovered + $discovered,
        files_imported = files_imported + $imported,
        sessions_imported = sessions_imported + $sessions,
        warning_count = warning_count + $warnings,
        error_count = error_count + $errors,
        updated_at = now()
      WHERE run_id = $runId
    `);
    statement.bind({
      runId,
      roots: progress.rootsDiscovered ?? 0,
      discovered: progress.filesDiscovered ?? 0,
      imported: progress.filesImported ?? 0,
      sessions: progress.sessionsImported ?? 0,
      warnings: progress.warnings ?? 0,
      errors: progress.errors ?? 0,
    });
    await statement.run();
  }

  public async find(runId: string): Promise<ImportRun | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM codex_import_runs WHERE run_id = $runId",
    );
    statement.bind({ runId });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CodexImportRunRow[])[0];
    return row ? mapImportRunRow(row) : undefined;
  }

  public async latestCompleted(): Promise<ImportRun | undefined> {
    const reader = await this.connection.runAndReadAll(`
      SELECT * FROM codex_import_runs
      WHERE state IN ('completed', 'failed')
      ORDER BY completed_at DESC NULLS LAST, run_id DESC LIMIT 1
    `);
    const row = (reader.getRowObjects() as unknown as CodexImportRunRow[])[0];
    return row ? mapImportRunRow(row) : undefined;
  }
}
