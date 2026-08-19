import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapSessionEventRow,
  type CodexSessionEventRow,
} from "@/database/models/codex-session-event.model.js";
import type { SelectedSessionEvent } from "@/modules/sessions/domain.js";

export class CodexSessionEventRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async insert(event: SelectedSessionEvent): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO codex_session_events (
        event_id, session_id, source_path, source_identity, source_record_number,
        event_kind, message_role, event_time, message_content, parser_version
      ) VALUES (
        $eventId, $sessionId, $sourcePath, $sourceIdentity, $recordNumber,
        $kind, $role, $eventTime, $content, $parserVersion
      ) ON CONFLICT DO NOTHING
    `);
    statement.bind({
      eventId: event.eventId,
      sessionId: event.sessionId,
      sourcePath: event.sourcePath,
      sourceIdentity: event.sourceIdentity,
      recordNumber: event.sourceRecordNumber,
      kind: event.kind,
      role: event.messageRole,
      eventTime: event.eventTime?.toISOString() ?? null,
      content: event.messageContent,
      parserVersion: event.parserVersion,
    });
    await statement.run();
  }

  public async listBySessionId(sessionId: string): Promise<SelectedSessionEvent[]> {
    const statement = await this.connection.prepare(`
      SELECT * FROM codex_session_events WHERE session_id = $sessionId
      ORDER BY source_path, source_record_number, event_kind
    `);
    statement.bind({ sessionId });
    const reader = await statement.runAndReadAll();
    return (reader.getRowObjects() as unknown as CodexSessionEventRow[]).map(mapSessionEventRow);
  }

  public async deleteBySourcePath(sourcePath: string): Promise<void> {
    const statement = await this.connection.prepare(
      "DELETE FROM codex_session_events WHERE source_path = $sourcePath",
    );
    statement.bind({ sourcePath });
    await statement.run();
  }
}
