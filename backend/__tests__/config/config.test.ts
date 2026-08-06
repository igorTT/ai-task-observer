import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { resolve } from "node:path";

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
      codexReadChunkBytes: 1_024 * 1_024,
      codexWatchDebounceMs: 1_000,
      codexRootRediscoveryMs: 60_000,
    });
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

  test("reports the invalid setting", () => {
    expect(() => loadConfig({ PORT: "not-a-port", LOG_LEVEL: "loud" })).toThrow(ConfigurationError);
    expect(() => loadConfig({ PORT: "not-a-port", LOG_LEVEL: "loud" })).toThrow(/PORT.*LOG_LEVEL/u);
  });

  test("rejects empty roots and out-of-range ingestion settings", () => {
    expect(() => loadConfig({ CODEX_SESSION_ROOTS: " , ", CODEX_READ_CHUNK_BYTES: "10" })).toThrow(
      /CODEX_SESSION_ROOTS.*CODEX_READ_CHUNK_BYTES/u,
    );
  });
});
