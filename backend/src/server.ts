import { once } from "node:events";
import { pathToFileURL } from "node:url";
import type { Server } from "node:http";

import type { Logger } from "pino";

import { createApp } from "./app.js";
import { loadConfig } from "@/config/config.js";
import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { createLogger, createStartupLogger } from "@/observability/logger.js";

export interface RunningServer {
  readonly httpServer: Server;
  readonly database: AppDatabase;
  readonly close: () => Promise<void>;
}

export async function startServer(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<RunningServer> {
  const config = loadConfig(environment);
  const logger = createLogger(config);
  const database = await AppDatabase.open(config.databasePath);

  try {
    await applyMigrations(database, logger);
    const app = createApp({ logger });
    const httpServer = app.listen(config.port, config.host);
    await once(httpServer, "listening");
    logger.info({ host: config.host, port: config.port }, "backend listening");

    let closing: Promise<void> | undefined;
    const close = (): Promise<void> => {
      closing ??= (async () => {
        httpServer.close();
        await once(httpServer, "close");
        database.close();
        logger.info("backend stopped");
      })();
      return closing;
    };

    return { httpServer, database, close };
  } catch (error) {
    database.close();
    throw error;
  }
}

async function main(logger: Logger): Promise<void> {
  const running = await startServer();
  const shutdown = (): void => {
    void running
      .close()
      .catch((error: unknown) => logger.error({ error }, "graceful shutdown failed"));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  const startupLogger = createStartupLogger();
  void main(startupLogger).catch((error: unknown) => {
    startupLogger.fatal({ error }, "backend startup failed");
    process.exitCode = 1;
  });
}
