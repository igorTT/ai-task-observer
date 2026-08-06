import { describe, expect, test } from "bun:test";
import express from "express";
import { once } from "node:events";
import type { Server } from "node:http";
import pino from "pino";
import request from "supertest";

import { errorHandler } from "@/api/middleware/errors.js";
import { createApp } from "@/app.js";

const logger = pino({ enabled: false });

async function withServer<T>(
  app: express.Express,
  assertion: (server: Server) => Promise<T>,
): Promise<T> {
  // Bun's Node compatibility layer does not currently allocate port 0 reliably.
  const server = app.listen(30_000 + Math.floor(Math.random() * 20_000), "127.0.0.1");
  await once(server, "listening");
  try {
    return await assertion(server);
  } finally {
    server.close();
    await once(server, "close");
  }
}

describe("createApp", () => {
  test("serves the generated health route", async () => {
    await withServer(createApp({ logger }), async (server) => {
      const response = await request(server).get("/api/health");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: "healthy" });
    });
  });

  test("serializes errors centrally", async () => {
    const app = express();
    app.get("/failure", () => {
      throw new Error("private detail");
    });
    app.use(errorHandler);
    await withServer(app, async (server) => {
      const response = await request(server).get("/failure");
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: "internal_error", message: "An unexpected error occurred" },
      });
    });
  });

  test("constructs without opening a listener", () => {
    const app = createApp({ logger });
    expect(typeof app.listen).toBe("function");
    expect(app.settings).not.toHaveProperty("port");
  });
});
