import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ConfigurationError, loadConfig } from "@/config/config.js";

describe("loadConfig", () => {
  test("normalizes valid foundation settings", () => {
    expect(
      loadConfig({
        HOST: " 0.0.0.0 ",
        PORT: "4100",
        DATABASE_PATH: " ./data/test.duckdb ",
        LOG_LEVEL: "debug",
      }),
    ).toEqual({
      host: "0.0.0.0",
      port: 4100,
      databasePath: "./data/test.duckdb",
      logLevel: "debug",
      codexSessionRoots: [resolve(homedir(), ".codex", "sessions")],
      codexSessionIndexPath: resolve(homedir(), ".codex", "session_index.jsonl"),
      codexReadChunkBytes: 1_024 * 1_024,
      codexWatchDebounceMs: 1_000,
      codexRootRediscoveryMs: 60_000,
      linearCacheTtlMs: 60 * 60 * 1_000,
      linearMaxConcurrency: 4,
      pricingCatalogPath: fileURLToPath(new URL("../../config/models.json", import.meta.url)),
      costCalculationDebounceMs: 250,
    });
  });

  test("normalizes the optional pricing catalog path and calculation debounce", () => {
    expect(
      loadConfig({
        PRICING_CATALOG_PATH: " ./fixtures/models.json ",
        COST_CALCULATION_DEBOUNCE_MS: "500",
      }),
    ).toMatchObject({
      pricingCatalogPath: resolve("./fixtures/models.json"),
      costCalculationDebounceMs: 500,
    });
    expect(() => loadConfig({ PRICING_CATALOG_PATH: " " })).toThrow(/PRICING_CATALOG_PATH/u);
  });

  test("normalizes multiple Codex roots and ingestion limits", () => {
    const config = loadConfig({
      CODEX_SESSION_ROOTS: " ./fixtures/one, ./fixtures/two, ./fixtures/one ",
      CODEX_READ_CHUNK_BYTES: "4096",
      CODEX_WATCH_DEBOUNCE_MS: "50",
      CODEX_ROOT_REDISCOVERY_MS: "1000",
    });
    expect(config.codexSessionRoots).toEqual([
      resolve("./fixtures/one"),
      resolve("./fixtures/two"),
    ]);
    expect(config.codexReadChunkBytes).toBe(4096);
    expect(config.codexWatchDebounceMs).toBe(50);
    expect(config.codexRootRediscoveryMs).toBe(1000);
    expect(Object.isFrozen(config.codexSessionRoots)).toBe(true);
  });

  test("normalizes a custom session index path", () => {
    expect(
      loadConfig({ CODEX_SESSION_INDEX_PATH: " ./fixtures/session_index.jsonl " }),
    ).toMatchObject({
      codexSessionIndexPath: resolve("./fixtures/session_index.jsonl"),
    });
    expect(() => loadConfig({ CODEX_SESSION_INDEX_PATH: " " })).toThrow(
      /CODEX_SESSION_INDEX_PATH/u,
    );
  });

  test("reports the invalid setting", () => {
    expect(() => loadConfig({ PORT: "not-a-port", LOG_LEVEL: "loud" })).toThrow(ConfigurationError);
    expect(() => loadConfig({ PORT: "not-a-port", LOG_LEVEL: "loud" })).toThrow(/PORT.*LOG_LEVEL/u);
  });

  test("rejects empty roots and out-of-range ingestion settings", () => {
    expect(() => loadConfig({ CODEX_SESSION_ROOTS: " , ", CODEX_READ_CHUNK_BYTES: "10" })).toThrow(
      /CODEX_SESSION_ROOTS.*CODEX_READ_CHUNK_BYTES/u,
    );
  });

  test("accepts optional Linear configuration and treats an empty key as unconfigured", () => {
    expect(loadConfig({ LINEAR_API_KEY: "" }).linearApiKey).toBeUndefined();
    expect(
      loadConfig({
        LINEAR_API_KEY: " lin_api_example_key ",
        LINEAR_CACHE_TTL_MS: "5000",
        LINEAR_MAX_CONCURRENCY: "2",
      }),
    ).toMatchObject({
      linearApiKey: "lin_api_example_key",
      linearCacheTtlMs: 5000,
      linearMaxConcurrency: 2,
    });
    expect(() => loadConfig({ LINEAR_API_KEY: "short" })).toThrow(/LINEAR_API_KEY/u);
  });
});
