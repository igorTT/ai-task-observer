import { sanitizedDiagnostic } from "@/modules/sessions/diagnostics.js";
import {
  tokenValues,
  type ParserDiagnostics,
  type SessionMetadataMutation,
  type SessionMutation,
  type TokenValues,
} from "@/modules/sessions/domain.js";

export const CODEX_PARSER_VERSION = 2;

type JsonObject = Record<string, unknown>;

export interface ParsedRecords {
  readonly mutations: readonly SessionMutation[];
  readonly diagnostics: ParserDiagnostics;
  readonly sessionId?: string;
}

export interface ParserContext {
  readonly sourceRoot: string;
  readonly sourcePath: string;
  readonly sessionId?: string;
  readonly startRecordNumber?: number;
  readonly parserVersion?: number;
}

export function parseCodexRecords(lines: readonly string[], context: ParserContext): ParsedRecords {
  let sessionId = context.sessionId;
  let metadata: SessionMetadataMutation | undefined;
  let developerTurns = 0n;
  let snapshot: TokenValues | undefined;
  let delta = tokenValues(0n, 0n, 0n);
  let hasDelta = false;
  let usageObserved = false;
  let unknownRecords = 0;
  let malformedRecords = 0;
  const warnings: ParserDiagnostics["warnings"][number][] = [];

  lines.forEach((line, index) => {
    const recordNumber = (context.startRecordNumber ?? 0) + index + 1;
    let record: JsonObject;
    try {
      const value: unknown = JSON.parse(line);
      if (!isObject(value) || typeof value.type !== "string" || !isObject(value.payload)) {
        throw new TypeError("record envelope must contain type and payload");
      }
      record = value;
    } catch (error) {
      malformedRecords += 1;
      warnings.push(
        sanitizedDiagnostic(
          "malformed_record",
          context.sourcePath,
          error instanceof SyntaxError ? "invalid JSON record" : "invalid record envelope",
          recordNumber,
        ),
      );
      return;
    }

    const payload = record.payload as JsonObject;
    switch (record.type) {
      case "session_meta": {
        if (typeof payload.id !== "string" || payload.id.length === 0) {
          malformedRecords += 1;
          warnings.push(
            sanitizedDiagnostic(
              "malformed_record",
              context.sourcePath,
              "session metadata is missing a stable id",
              recordNumber,
            ),
          );
          return;
        }
        sessionId = payload.id;
        metadata = mergeMetadata(metadata, {
          sessionId,
          sourceRoot: context.sourceRoot,
          sourcePath: context.sourcePath,
          ...(typeof payload.title === "string" ? { title: payload.title } : {}),
          ...dateField(payload.timestamp, "startedAt"),
        });
        break;
      }
      case "session_title": {
        if (typeof payload.title !== "string" || !sessionId) {
          malformedRecords += 1;
          warnings.push(
            sanitizedDiagnostic(
              "malformed_record",
              context.sourcePath,
              "session title record is missing title or session identity",
              recordNumber,
            ),
          );
          return;
        }
        metadata = mergeMetadata(metadata, {
          sessionId,
          sourceRoot: context.sourceRoot,
          sourcePath: context.sourcePath,
          title: payload.title,
        });
        break;
      }
      case "response_item": {
        // Codex mirrors user input into response items alongside its explicit
        // user_message event. Counting the mirror would double-count a turn.
        break;
      }
      case "event_msg": {
        if (payload.type === "user_message") developerTurns += 1n;
        if (payload.type === "token_count" && isObject(payload.info)) {
          const cumulative = tokenObject(payload.info.total_token_usage);
          const latest = tokenObject(payload.info.last_token_usage);
          if (cumulative) {
            snapshot = cumulative;
            delta = tokenValues(0n, 0n, 0n);
            hasDelta = false;
          } else if (latest) {
            delta = addTokens(delta, latest);
            hasDelta = true;
          }
          usageObserved ||= cumulative !== undefined || latest !== undefined;
        }
        if (payload.type === "session_end" && sessionId) {
          metadata = mergeMetadata(metadata, {
            sessionId,
            sourceRoot: context.sourceRoot,
            sourcePath: context.sourcePath,
            ...dateField(record.timestamp, "endedAt"),
          });
        }
        break;
      }
      case "token_usage": {
        const values = tokenObject(payload);
        if (values) {
          if (payload.cumulative === true) {
            snapshot = values;
            delta = tokenValues(0n, 0n, 0n);
            hasDelta = false;
          } else {
            delta = addTokens(delta, values);
            hasDelta = true;
          }
          usageObserved = true;
        }
        break;
      }
      case "token_usage_v2": {
        if ((context.parserVersion ?? CODEX_PARSER_VERSION) < 2) {
          unknownRecords += 1;
          warnings.push(
            sanitizedDiagnostic(
              "unknown_record",
              context.sourcePath,
              "unsupported record type",
              recordNumber,
            ),
          );
          break;
        }
        const values = tokenObject(payload);
        if (values) {
          snapshot = values;
          delta = tokenValues(0n, 0n, 0n);
          hasDelta = false;
          usageObserved = true;
        }
        break;
      }
      case "turn_context":
        break;
      default:
        unknownRecords += 1;
        warnings.push(
          sanitizedDiagnostic(
            "unknown_record",
            context.sourcePath,
            "unsupported record type",
            recordNumber,
          ),
        );
    }
  });

  const mutations: SessionMutation[] = [];
  if (metadata) mutations.push({ metadata });
  if (sessionId && (developerTurns > 0n || snapshot || hasDelta || usageObserved)) {
    mutations.push({
      sessionId,
      ...(developerTurns > 0n ? { developerTurnDelta: developerTurns } : {}),
      ...(snapshot ? { tokenSnapshot: snapshot } : {}),
      ...(hasDelta ? { tokenDelta: delta } : {}),
      ...(usageObserved ? { usageObserved: true } : {}),
    });
  }
  return {
    mutations,
    diagnostics: { unknownRecords, malformedRecords, warnings },
    ...(sessionId ? { sessionId } : {}),
  };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tokenObject(value: unknown): TokenValues | undefined {
  if (!isObject(value)) return undefined;
  try {
    return tokenValues(
      nonNegativeBigInt(value.input_tokens),
      nonNegativeBigInt(value.cached_input_tokens),
      nonNegativeBigInt(value.output_tokens),
    );
  } catch {
    return undefined;
  }
}

function nonNegativeBigInt(value: unknown): bigint {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^\d+$/u.test(value)) return BigInt(value);
  throw new TypeError("token value must be a non-negative integer");
}

function addTokens(left: TokenValues, right: TokenValues): TokenValues {
  return tokenValues(
    left.input + right.input,
    left.cachedInput + right.cachedInput,
    left.output + right.output,
  );
}

function mergeMetadata(
  current: SessionMetadataMutation | undefined,
  next: SessionMetadataMutation,
): SessionMetadataMutation {
  return { ...current, ...next };
}

function dateField<K extends "startedAt" | "endedAt">(
  value: unknown,
  key: K,
): Partial<Record<K, Date>> {
  if (typeof value !== "string") return {};
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? {} : ({ [key]: date } as Partial<Record<K, Date>>);
}
