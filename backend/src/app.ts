import express, { type Express } from "express";
import { pinoHttp } from "pino-http";
import type { Logger } from "pino";

import { errorHandler, notFoundHandler } from "@/api/middleware/errors.js";
import { createApiRouter } from "@/api/router.js";
import { configureApiDependencies, type ApiDependencies } from "@/api/dependencies.js";

export interface AppDependencies {
  readonly logger: Logger;
  readonly api?: ApiDependencies;
}

export function createApp({ logger, api }: AppDependencies): Express {
  if (api) configureApiDependencies(api);
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());
  app.use(pinoHttp({ logger }));
  app.use(createApiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
