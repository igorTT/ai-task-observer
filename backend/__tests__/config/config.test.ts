import { describe, expect, test } from "bun:test";

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
    });
  });

  test("reports the invalid setting", () => {
    expect(() => loadConfig({ PORT: "not-a-port", LOG_LEVEL: "loud" })).toThrow(ConfigurationError);
    expect(() => loadConfig({ PORT: "not-a-port", LOG_LEVEL: "loud" })).toThrow(/PORT.*LOG_LEVEL/u);
  });
});
