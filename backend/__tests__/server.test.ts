import { describe, expect, mock, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { ConfigurationError } from "@/config/config.js";
import type { AppDatabase } from "@/database/database.js";
import type { IngestionLifecycle } from "@/server.js";
import { startServer } from "@/server.js";

describe("startServer", () => {
  test("rejects invalid configuration before startup", async () => {
    try {
      await startServer({ PORT: "invalid" });
      throw new Error("Expected startup to reject invalid configuration");
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationError);
    }
  });

  test("does not create ingestion when migration initialization fails", () => {
    const closeDatabase = mock(() => undefined);
    const database = { close: closeDatabase } as unknown as AppDatabase;
    const createIngestion = mock((): IngestionLifecycle => {
      throw new Error("must not be called");
    });
    expect(
      startServer(
        { DATABASE_PATH: "unused.duckdb", LOG_LEVEL: "silent" },
        {
          openDatabase: () => Promise.resolve(database),
          migrate: () => Promise.reject(new Error("migration failed")),
          createIngestion,
        },
      ),
    ).rejects.toThrow("migration failed");
    expect(createIngestion).not.toHaveBeenCalled();
    expect(closeDatabase).toHaveBeenCalled();
  });

  test("rejects an invalid pricing catalog before opening the database or listener", () => {
    const openDatabase = mock(() => Promise.reject(new Error("must not be called")));
    const pricingPath = fileURLToPath(
      new URL("./fixtures/pricing/invalid-overlap.json", import.meta.url),
    );
    const result = expect(
      startServer({ PRICING_CATALOG_PATH: pricingPath, LOG_LEVEL: "silent" }, { openDatabase }),
    ).rejects.toThrow(/price periods overlap/u);
    expect(openDatabase).not.toHaveBeenCalled();
    return result;
  });
});
