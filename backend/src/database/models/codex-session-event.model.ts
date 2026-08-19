import type {
  MessageRole,
  SelectedEventKind,
  SelectedSessionEvent,
} from "@/modules/sessions/domain.js";

export interface CodexSessionEventRow {
  readonly event_id: string;
  readonly session_id: string;
  readonly source_path: string;
  readonly source_identity: string;
  readonly source_record_number: bigint;
  readonly event_kind: SelectedEventKind;
  readonly message_role: MessageRole | null;
  readonly event_time: Date | null;
  readonly message_content: string | null;
  readonly parser_version: number;
}

export function mapSessionEventRow(row: CodexSessionEventRow): SelectedSessionEvent {
  return {
    eventId: row.event_id,
    sessionId: row.session_id,
    sourcePath: row.source_path,
    sourceIdentity: row.source_identity,
    sourceRecordNumber: BigInt(row.source_record_number),
    kind: row.event_kind,
    messageRole: row.message_role,
    eventTime: row.event_time === null ? null : new Date(row.event_time),
    messageContent: row.message_content,
    parserVersion: Number(row.parser_version),
  };
}
