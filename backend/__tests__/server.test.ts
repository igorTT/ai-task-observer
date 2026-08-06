import { describe, expect, test } from "bun:test";

import { ConfigurationError } from "@/config/config.js";
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
});
