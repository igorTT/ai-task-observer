import { z } from "zod";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const defaultPricingCatalogPath = fileURLToPath(
  new URL("../../config/models.json", import.meta.url),
);
const defaultCodexSessionIndexPath = resolve(homedir(), ".codex", "session_index.jsonl");

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const positiveInteger = (name: string, minimum: number, maximum: number, fallback: number) =>
  z.coerce
    .number()
    .int(`${name} must be an integer`)
    .min(minimum, `${name} must be at least ${minimum}`)
    .max(maximum, `${name} must be at most ${maximum}`)
    .default(fallback);

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
  CODEX_SESSION_ROOTS: z
    .string()
    .transform((value, context) => {
      const roots = value
        .split(",")
        .map((root) => root.trim())
        .filter(Boolean)
        .map((root) => resolve(root));
      if (roots.length === 0) {
        context.addIssue({ code: "custom", message: "CODEX_SESSION_ROOTS must contain a path" });
        return z.NEVER;
      }
      return [...new Set(roots)];
    })
    .default([resolve(homedir(), ".codex", "sessions")]),
  CODEX_SESSION_INDEX_PATH: z
    .string()
    .trim()
    .min(1, "CODEX_SESSION_INDEX_PATH must not be empty")
    .transform((value) => resolve(value))
    .default(defaultCodexSessionIndexPath),
  CODEX_READ_CHUNK_BYTES: positiveInteger(
    "CODEX_READ_CHUNK_BYTES",
    1_024,
    16 * 1_024 * 1_024,
    1_024 * 1_024,
  ),
  CODEX_WATCH_DEBOUNCE_MS: positiveInteger("CODEX_WATCH_DEBOUNCE_MS", 10, 60_000, 1_000),
  CODEX_ROOT_REDISCOVERY_MS: positiveInteger("CODEX_ROOT_REDISCOVERY_MS", 1_000, 3_600_000, 60_000),
  LINEAR_API_KEY: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().min(10, "LINEAR_API_KEY must be at least 10 characters").optional(),
  ),
  LINEAR_CACHE_TTL_MS: positiveInteger(
    "LINEAR_CACHE_TTL_MS",
    1_000,
    30 * 24 * 60 * 60 * 1_000,
    60 * 60 * 1_000,
  ),
  LINEAR_MAX_CONCURRENCY: positiveInteger("LINEAR_MAX_CONCURRENCY", 1, 20, 4),
  PRICING_CATALOG_PATH: z
    .string()
    .trim()
    .min(1, "PRICING_CATALOG_PATH must not be empty")
    .transform((value) => resolve(value))
    .default(defaultPricingCatalogPath),
  COST_CALCULATION_DEBOUNCE_MS: positiveInteger("COST_CALCULATION_DEBOUNCE_MS", 10, 60_000, 250),
});

export interface AppConfig {
  readonly host: string;
  readonly port: number;
  readonly databasePath: string;
  readonly logLevel: (typeof logLevels)[number];
  readonly codexSessionRoots: readonly string[];
  readonly codexSessionIndexPath: string;
  readonly codexReadChunkBytes: number;
  readonly codexWatchDebounceMs: number;
  readonly codexRootRediscoveryMs: number;
  readonly linearApiKey?: string;
  readonly linearCacheTtlMs: number;
  readonly linearMaxConcurrency: number;
  readonly pricingCatalogPath: string;
  readonly costCalculationDebounceMs: number;
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
    codexSessionRoots: Object.freeze(parsed.data.CODEX_SESSION_ROOTS),
    codexSessionIndexPath: parsed.data.CODEX_SESSION_INDEX_PATH,
    codexReadChunkBytes: parsed.data.CODEX_READ_CHUNK_BYTES,
    codexWatchDebounceMs: parsed.data.CODEX_WATCH_DEBOUNCE_MS,
    codexRootRediscoveryMs: parsed.data.CODEX_ROOT_REDISCOVERY_MS,
    ...(parsed.data.LINEAR_API_KEY ? { linearApiKey: parsed.data.LINEAR_API_KEY } : {}),
    linearCacheTtlMs: parsed.data.LINEAR_CACHE_TTL_MS,
    linearMaxConcurrency: parsed.data.LINEAR_MAX_CONCURRENCY,
    pricingCatalogPath: parsed.data.PRICING_CATALOG_PATH,
    costCalculationDebounceMs: parsed.data.COST_CALCULATION_DEBOUNCE_MS,
  });
}
