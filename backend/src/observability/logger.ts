import pino, { type Logger } from "pino";

import type { AppConfig } from "@/config/config.js";

export function createLogger(config: Pick<AppConfig, "logLevel">): Logger {
  return pino({
    level: config.logLevel,
    base: { service: "ai-task-observer-backend" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export function createStartupLogger(): Logger {
  return createLogger({ logLevel: "info" });
}
