import { once } from "node:events";
import { pathToFileURL } from "node:url";
import type { Server } from "node:http";

import type { Logger } from "pino";

import { createApp } from "./app.js";
import { loadConfig, type AppConfig } from "@/config/config.js";
import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";
import { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { LinearSyncRunRepository } from "@/database/repositories/linear-sync-run-repository.js";
import { AttributionCoordinator } from "@/modules/linear/coordinator.js";
import { LinearSdkIssueReader } from "@/modules/linear/linear-sdk-reader.js";
import { IngestionCoordinator } from "@/modules/sessions/coordinator.js";
import { CodexSourceImporter } from "@/modules/sessions/importer.js";
import { SessionQueryService } from "@/modules/sessions/session-query-service.js";
import { createLogger, createStartupLogger } from "@/observability/logger.js";
import { CostCalculationService } from "@/modules/pricing/calculation-service.js";
import { loadPricingCatalog } from "@/modules/pricing/catalog.js";
import { CostCalculationCoordinator } from "@/modules/pricing/coordinator.js";
import type { PricingCatalog } from "@/modules/pricing/domain.js";

export interface RunningServer {
  readonly httpServer: Server;
  readonly database: AppDatabase;
  readonly ingestion: IngestionLifecycle;
  readonly attribution: AttributionLifecycle;
  readonly costs: CostCalculationLifecycle;
  readonly close: () => Promise<void>;
}

export interface AttributionLifecycle {
  readonly start: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly status: AttributionCoordinator["status"];
  readonly sync: AttributionCoordinator["sync"];
  readonly relink: AttributionCoordinator["relink"];
  readonly notifySessions: AttributionCoordinator["notifySessions"];
}

export interface IngestionLifecycle {
  readonly start: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly status: IngestionCoordinator["status"];
  readonly rescan: IngestionCoordinator["rescan"];
  readonly sessions: SessionQueryService;
}

export interface CostCalculationLifecycle {
  readonly start: () => Promise<void>;
  readonly close: () => Promise<void>;
  readonly status: CostCalculationCoordinator["status"];
  readonly recalculate: CostCalculationCoordinator["recalculate"];
  readonly notifyCommitted: CostCalculationCoordinator["notifyCommitted"];
}

export interface ServerFactories {
  readonly openDatabase?: (path: string) => Promise<AppDatabase>;
  readonly migrate?: typeof applyMigrations;
  readonly loadPricing?: (path: string) => Promise<PricingCatalog>;
  readonly createIngestion?: (
    config: Readonly<AppConfig>,
    database: AppDatabase,
    logger: Logger,
    onSessionsCommitted?: (sessionIds: readonly string[]) => void | Promise<void>,
  ) => IngestionLifecycle;
  readonly createAttribution?: (
    config: Readonly<AppConfig>,
    database: AppDatabase,
    logger: Logger,
  ) => AttributionLifecycle;
  readonly createCalculations?: (
    config: Readonly<AppConfig>,
    database: AppDatabase,
    catalog: PricingCatalog,
    logger: Logger,
  ) => CostCalculationLifecycle;
}

export async function startServer(
  environment: NodeJS.ProcessEnv = process.env,
  factories: ServerFactories = {},
): Promise<RunningServer> {
  const config = loadConfig(environment);
  const catalog = await (factories.loadPricing ?? loadPricingCatalog)(config.pricingCatalogPath);
  const logger = createLogger(config);
  const database = await (factories.openDatabase ?? AppDatabase.open)(config.databasePath);
  let ingestion: IngestionLifecycle | undefined;
  let attribution: AttributionLifecycle | undefined;
  let costs: CostCalculationLifecycle | undefined;

  try {
    await (factories.migrate ?? applyMigrations)(database, logger);
    attribution = (factories.createAttribution ?? createAttribution)(config, database, logger);
    const activeAttribution = attribution;
    costs = (factories.createCalculations ?? createCalculations)(config, database, catalog, logger);
    const activeCosts = costs;
    ingestion = (factories.createIngestion ?? createIngestion)(
      config,
      database,
      logger,
      async (sessionIds) => {
        await activeAttribution.notifySessions(sessionIds);
        activeCosts.notifyCommitted();
      },
    );
    await ingestion.start();
    const activeIngestion = ingestion;
    await activeAttribution.start();
    await activeCosts.start();
    const app = createApp({
      logger,
      api: {
        ingestion: activeIngestion,
        sessions: activeIngestion.sessions,
        linear: activeAttribution,
        costs: activeCosts,
      },
    });
    const httpServer = app.listen(config.port, config.host);
    await once(httpServer, "listening");
    logger.info({ host: config.host, port: config.port }, "backend listening");

    let closing: Promise<void> | undefined;
    const close = (): Promise<void> => {
      closing ??= (async () => {
        httpServer.close();
        await once(httpServer, "close");
        await Promise.all([
          activeIngestion.close(),
          activeAttribution.close(),
          activeCosts.close(),
        ]);
        database.close();
        logger.info("backend stopped");
      })();
      return closing;
    };

    return {
      httpServer,
      database,
      ingestion: activeIngestion,
      attribution: activeAttribution,
      costs: activeCosts,
      close,
    };
  } catch (error) {
    await Promise.all([ingestion?.close(), attribution?.close(), costs?.close()]);
    database.close();
    throw error;
  }
}

function createCalculations(
  config: Readonly<AppConfig>,
  database: AppDatabase,
  catalog: PricingCatalog,
  logger: Logger,
): CostCalculationLifecycle {
  return new CostCalculationCoordinator({
    service: new CostCalculationService({ database, catalog }),
    logger,
    debounceMs: config.costCalculationDebounceMs,
  });
}

function createIngestion(
  config: Readonly<AppConfig>,
  database: AppDatabase,
  logger: Logger,
  onSessionsCommitted?: (sessionIds: readonly string[]) => void | Promise<void>,
): IngestionLifecycle {
  const repository = new CodexIngestionRepository(database);
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
    ...(onSessionsCommitted ? { onSessionsCommitted } : {}),
  });
  const attributions = new LinearSessionAttributionRepository(database.connection);
  const issues = new LinearIssueRepository(database.connection);
  return Object.assign(coordinator, {
    sessions: new SessionQueryService(repository.sessions, repository.usage, attributions, issues),
  });
}

function createAttribution(
  config: Readonly<AppConfig>,
  database: AppDatabase,
  logger: Logger,
): AttributionLifecycle {
  return new AttributionCoordinator({
    database,
    sessions: new CodexSessionRepository(database.connection),
    attributions: new LinearSessionAttributionRepository(database.connection),
    issues: new LinearIssueRepository(database.connection),
    runs: new LinearSyncRunRepository(database.connection),
    ...(config.linearApiKey ? { reader: new LinearSdkIssueReader(config.linearApiKey) } : {}),
    logger,
    cacheTtlMs: config.linearCacheTtlMs,
    maxConcurrency: config.linearMaxConcurrency,
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
