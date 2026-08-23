import type { DuckDBTimestampTZValue } from "@duckdb/node-api";

import { mapTimestampWithTimeZone } from "@/database/models/timestamp.model.js";

export interface MigrationRecord {
  readonly version: number;
  readonly name: string;
  readonly checksum: string;
  readonly appliedAt: Date;
}

export interface MigrationRow {
  readonly version: number | bigint;
  readonly name: string;
  readonly checksum: string;
  readonly applied_at: DuckDBTimestampTZValue;
}

export function mapMigrationRow(row: MigrationRow): MigrationRecord {
  return {
    version: Number(row.version),
    name: row.name,
    checksum: row.checksum,
    appliedAt: mapTimestampWithTimeZone(row.applied_at),
  };
}
