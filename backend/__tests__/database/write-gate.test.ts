import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { expect, test } from "bun:test";

import { AppDatabase } from "@/database/database.js";

test("exclusive transactional writers run in FIFO order without interleaving", async () => {
  const directory = await mkdtemp(join(tmpdir(), "write-gate-"));
  const database = await AppDatabase.open(join(directory, "test.duckdb"));
  const order: string[] = [];
  let releaseFirst!: () => void;
  const firstCanFinish = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  try {
    await database.connection.run("CREATE TABLE writes (position INTEGER, label VARCHAR)");
    const first = database.exclusiveWrite(async (connection) => {
      order.push("first:start");
      await connection.run("BEGIN TRANSACTION");
      await firstCanFinish;
      await connection.run("INSERT INTO writes VALUES (1, 'first')");
      await connection.run("COMMIT");
      order.push("first:end");
    });
    const second = database.exclusiveWrite(async (connection) => {
      order.push("second:start");
      await connection.run("BEGIN TRANSACTION");
      await connection.run("INSERT INTO writes VALUES (2, 'second')");
      await connection.run("COMMIT");
      order.push("second:end");
    });
    await Promise.resolve();
    expect(order).toEqual(["first:start"]);
    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
