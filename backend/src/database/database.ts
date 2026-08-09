import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { DuckDBInstance, type DuckDBConnection } from "@duckdb/node-api";

export class AppDatabase {
  readonly #instance: DuckDBInstance;
  readonly #connection: DuckDBConnection;
  #closed = false;
  #writeTail: Promise<void> = Promise.resolve();

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

  public exclusiveWrite<T>(operation: (connection: DuckDBConnection) => Promise<T>): Promise<T> {
    if (this.#closed) return Promise.reject(new Error("Database is closed"));
    const result = this.#writeTail.then(() => {
      if (this.#closed) throw new Error("Database is closed");
      return operation(this.#connection);
    });
    this.#writeTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  public close(): void {
    if (this.#closed) return;
    this.#connection.closeSync();
    this.#instance.closeSync();
    this.#closed = true;
  }
}
