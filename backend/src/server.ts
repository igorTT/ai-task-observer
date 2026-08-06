import { once } from "node:events";
import { pathToFileURL } from "node:url";
import type { Server } from "node:http";

import type { Logger } from "pino";

import { createApp } from "./app.js";
import { loadConfig, type AppConfig } from "@/config/config.js";
import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { IngestionCoordinator } from "@/modules/sessions/coordinator.js";
import { CodexSourceImporter } from "@/modules/sessions/importer.js";
import { SessionQueryService } from "@/modules/sessions/session-query-service.js";
import { createLogger, createStartupLogger } from "@/observability/logger.js";

export interface RunningServer {
  readonly httpServer: Server;
  readonly database: AppDatabase;
  readonly ingestion: IngestionLifecycle;
  readonly close: () => Promise<void>;
}

export interface IngestionLifecycle {
  readonly start: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly status: IngestionCoordinator["status"];
  readonly rescan: IngestionCoordinator["rescan"];
  readonly sessions: SessionQueryService;
}

export interface ServerFactories {
  readonly openDatabase?: (path: string) => Promise<AppDatabase>;
  readonly migrate?: typeof applyMigrations;
  readonly createIngestion?: (
    config: Readonly<AppConfig>,
    database: AppDatabase,
    logger: Logger,
  ) => IngestionLifecycle;
}

export async function startServer(
  environment: NodeJS.ProcessEnv = process.env,
  factories: ServerFactories = {},
): Promise<RunningServer> {
  const config = loadConfig(environment);
  const logger = createLogger(config);
  const database = await (factories.openDatabase ?? AppDatabase.open)(config.databasePath);
  let ingestion: IngestionLifecycle | undefined;

  try {
    await (factories.migrate ?? applyMigrations)(database, logger);
    ingestion = (factories.createIngestion ?? createIngestion)(config, database, logger);
    await ingestion.start();
    const activeIngestion = ingestion;
    const app = createApp({
      logger,
      api: { ingestion: activeIngestion, sessions: activeIngestion.sessions },
    });
    const httpServer = app.listen(config.port, config.host);
    await once(httpServer, "listening");
    logger.info({ host: config.host, port: config.port }, "backend listening");

    let closing: Promise<void> | undefined;
    const close = (): Promise<void> => {
      closing ??= (async () => {
        httpServer.close();
        await once(httpServer, "close");
        await activeIngestion.close();
        database.close();
        logger.info("backend stopped");
      })();
      return closing;
    };

    return { httpServer, database, ingestion: activeIngestion, close };
  } catch (error) {
    await ingestion?.close();
    database.close();
    throw error;
  }
}

function createIngestion(
  config: Readonly<AppConfig>,
  database: AppDatabase,
  logger: Logger,
): IngestionLifecycle {
  const repository = new CodexIngestionRepository(database.connection);
  const importer = new CodexSourceImporter({
    repository,
    readChunkBytes: config.codexReadChunkBytes,
    logger,
  });
  const coordinator = new IngestionCoordinator({
    roots: config.codexSessionRoots,
    importer,
    repository,
    logger,
    debounceMs: config.codexWatchDebounceMs,
    rediscoveryMs: config.codexRootRediscoveryMs,
  });
  return Object.assign(coordinator, {
    sessions: new SessionQueryService(repository.sessions, repository.usage),
  });
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
