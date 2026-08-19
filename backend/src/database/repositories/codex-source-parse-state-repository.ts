import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapSourceParseStateRow,
  type CodexSourceParseStateRow,
} from "@/database/models/codex-source-parse-state.model.js";
import type { SourceParseState } from "@/modules/sessions/domain.js";

export class CodexSourceParseStateRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async find(sourcePath: string): Promise<SourceParseState | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM codex_source_parse_state WHERE source_path = $sourcePath",
    );
    statement.bind({ sourcePath });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CodexSourceParseStateRow[])[0];
    return row ? mapSourceParseStateRow(row) : undefined;
  }

  public async upsert(state: SourceParseState): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO codex_source_parse_state (
        source_path, session_id, source_identity, parser_version, active_model,
        normalization_epoch, baseline_input, baseline_cached_input, baseline_output,
        next_record_number, fact_revision
      ) VALUES (
        $sourcePath, $sessionId, $sourceIdentity, $parserVersion, $activeModel,
        $epoch, $baselineInput, $baselineCached, $baselineOutput,
        $nextRecordNumber, $factRevision
      ) ON CONFLICT (source_path) DO UPDATE SET
        session_id = excluded.session_id,
        source_identity = excluded.source_identity,
        parser_version = excluded.parser_version,
        active_model = excluded.active_model,
        normalization_epoch = excluded.normalization_epoch,
        baseline_input = excluded.baseline_input,
        baseline_cached_input = excluded.baseline_cached_input,
        baseline_output = excluded.baseline_output,
        next_record_number = excluded.next_record_number,
        fact_revision = excluded.fact_revision,
        updated_at = now()
    `);
    statement.bind({
      sourcePath: state.sourcePath,
      sessionId: state.sessionId,
      sourceIdentity: state.sourceIdentity,
      parserVersion: state.parserVersion,
      activeModel: state.activeModel,
      epoch: state.epoch,
      baselineInput: state.baseline?.input ?? null,
      baselineCached: state.baseline?.cachedInput ?? null,
      baselineOutput: state.baseline?.output ?? null,
      nextRecordNumber: state.nextRecordNumber,
      factRevision: state.factRevision,
    });
    await statement.run();
  }

  public async delete(sourcePath: string): Promise<void> {
    const statement = await this.connection.prepare(
      "DELETE FROM codex_source_parse_state WHERE source_path = $sourcePath",
    );
    statement.bind({ sourcePath });
    await statement.run();
  }
}
