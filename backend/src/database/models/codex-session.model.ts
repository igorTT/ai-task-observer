import type { DuckDBTimestampTZValue } from "@duckdb/node-api";

import { mapTimestampWithTimeZone } from "@/database/models/timestamp.model.js";
import type { ImportState } from "@/modules/sessions/domain.js";

export interface CodexSessionRow {
  readonly session_id: string;
  readonly source_root: string;
  readonly source_path: string;
  readonly current_title: string | null;
  readonly started_at: DuckDBTimestampTZValue | null;
  readonly ended_at: DuckDBTimestampTZValue | null;
  readonly developer_turns: bigint;
  readonly import_state: ImportState;
  readonly parser_version: number;
  readonly last_error: string | null;
  readonly created_at: DuckDBTimestampTZValue;
  readonly updated_at: DuckDBTimestampTZValue;
}

export interface CodexSessionRecord {
  readonly sessionId: string;
  readonly sourceRoot: string;
  readonly sourcePath: string;
  readonly currentTitle?: string;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
  readonly developerTurns: bigint;
  readonly importState: ImportState;
  readonly parserVersion: number;
  readonly lastError?: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function mapSessionRow(row: CodexSessionRow): CodexSessionRecord {
  return {
    sessionId: row.session_id,
    sourceRoot: row.source_root,
    sourcePath: row.source_path,
    ...(row.current_title === null ? {} : { currentTitle: row.current_title }),
    ...(row.started_at === null ? {} : { startedAt: mapTimestampWithTimeZone(row.started_at) }),
    ...(row.ended_at === null ? {} : { endedAt: mapTimestampWithTimeZone(row.ended_at) }),
    developerTurns: BigInt(row.developer_turns),
    importState: row.import_state,
    parserVersion: Number(row.parser_version),
    ...(row.last_error === null ? {} : { lastError: row.last_error }),
    createdAt: mapTimestampWithTimeZone(row.created_at),
    updatedAt: mapTimestampWithTimeZone(row.updated_at),
  };
}
