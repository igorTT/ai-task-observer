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
  readonly applied_at: Date;
}

export function mapMigrationRow(row: MigrationRow): MigrationRecord {
  return {
    version: Number(row.version),
    name: row.name,
    checksum: row.checksum,
    appliedAt: new Date(row.applied_at),
  };
}
