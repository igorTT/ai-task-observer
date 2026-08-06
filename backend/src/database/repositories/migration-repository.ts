import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapMigrationRow,
  type MigrationRecord,
  type MigrationRow,
} from "@/database/models/migration.model.js";

export class MigrationRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async ledgerExists(): Promise<boolean> {
    const reader = await this.connection.runAndReadAll(
      "SELECT count(*) AS count FROM information_schema.tables WHERE table_schema = 'main' AND table_name = 'schema_migrations'",
    );
    const [row] = reader.getRowObjects() as Array<{ count: bigint }>;
    return row?.count === 1n;
  }

  public async findAll(): Promise<MigrationRecord[]> {
    if (!(await this.ledgerExists())) return [];
    const reader = await this.connection.runAndReadAll(
      "SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version",
    );
    return (reader.getRowObjects() as unknown as MigrationRow[]).map(mapMigrationRow);
  }

  public async insert(version: number, name: string, checksum: string): Promise<void> {
    const statement = await this.connection.prepare(
      "INSERT INTO schema_migrations (version, name, checksum) VALUES ($version, $name, $checksum)",
    );
    statement.bind({ version, name, checksum });
    await statement.run();
  }
}
