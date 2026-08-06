import { z } from "zod";

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const environmentSchema = z.object({
  HOST: z.string().trim().min(1, "HOST must not be empty").default("127.0.0.1"),
  PORT: z.coerce.number().int("PORT must be an integer").min(1).max(65_535).default(3000),
  DATABASE_PATH: z
    .string()
    .trim()
    .min(1, "DATABASE_PATH must not be empty")
    .default("data/ai-task-observer.duckdb"),
  LOG_LEVEL: z
    .enum(logLevels, {
      error: "LOG_LEVEL must be one of fatal, error, warn, info, debug, trace, silent",
    })
    .default("info"),
});

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly logLevel: (typeof logLevels)[number];
}

export class ConfigurationError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super(`Invalid application configuration: ${issues.join("; ")}`);
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}

export function loadConfig(environment: NodeJS.ProcessEnv): Readonly<AppConfig> {
  const parsed = environmentSchema.safeParse(environment);

  if (!parsed.success) {
    throw new ConfigurationError(
      parsed.error.issues.map(
        (issue) => `${String(issue.path[0] ?? "environment")}: ${issue.message}`,
      ),
    );
  }

  return Object.freeze({
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    databasePath: parsed.data.DATABASE_PATH,
    logLevel: parsed.data.LOG_LEVEL,
  });
}
