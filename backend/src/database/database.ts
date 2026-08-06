import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

export class AppDatabase {
  readonly #instance: DuckDBInstance;
  readonly #connection: DuckDBConnection;
  #closed = false;

  private constructor(instance: DuckDBInstance, connection: DuckDBConnection) {
    this.#instance = instance;
    this.#connection = connection;
  }

  public static async open(databasePath: string): Promise<AppDatabase> {
    const absolutePath = resolve(databasePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    const instance = await DuckDBInstance.create(absolutePath);
    const connection = await instance.connect();
    return new AppDatabase(instance, connection);
  }

  public get connection(): DuckDBConnection {
    if (this.#closed) {
      throw new Error("Database is closed");
    }
    return this.#connection;
  }

  public close(): void {
    if (this.#closed) return;
    this.#connection.closeSync();
    this.#instance.closeSync();
    this.#closed = true;
  }
}
