import { sanitizedDiagnostic } from "@/modules/sessions/diagnostics.js";
import type {
  NormalizedTokenCategories,
  ParserDiagnostics,
  RawTokenCounters,
  SelectedEventKind,
  SelectedSessionEvent,
  SessionMetadataMutation,
  SessionMutation,
  SourceParseState,
  UsageAnomalyCode,
  UsageObservation,
} from "@/modules/sessions/domain.js";

export const CODEX_PARSER_VERSION = 3;

type JsonObject = Record<string, unknown>;

export interface ParsedRecords {
  readonly mutations: readonly SessionMutation[];
  readonly events: readonly SelectedSessionEvent[];
  readonly observations: readonly UsageObservation[];
  readonly diagnostics: ParserDiagnostics;
  readonly sessionId?: string;
  readonly parseState?: SourceParseState;
}

export interface ParserContext {
  readonly sourceRoot: string;
  readonly sourcePath: string;
  readonly sourceIdentity?: string;
  readonly sessionId?: string;
  readonly startRecordNumber?: number;
  readonly parserVersion?: number;
  readonly parseState?: SourceParseState;
}

export function parseCodexRecords(lines: readonly string[], context: ParserContext): ParsedRecords {
  const parserVersion = context.parserVersion ?? CODEX_PARSER_VERSION;
  const sourceIdentity = context.sourceIdentity ?? "unknown";
  let sessionId = context.parseState?.sessionId ?? context.sessionId;
  let metadata: SessionMetadataMutation | undefined;
  let activeModel = context.parseState?.activeModel ?? "unknown";
  let epoch = context.parseState?.epoch ?? 0;
  let baseline = context.parseState?.baseline ?? null;
  const firstRecordNumber =
    context.parseState?.nextRecordNumber ?? BigInt((context.startRecordNumber ?? 0) + 1);
  let nextRecordNumber = firstRecordNumber;
  const events: SelectedSessionEvent[] = [];
  const observations: UsageObservation[] = [];
  let unknownRecords = 0;
  let malformedRecords = 0;
  const warnings: ParserDiagnostics["warnings"][number][] = [];

  lines.forEach((line, index) => {
    const recordNumber = firstRecordNumber + BigInt(index);
    nextRecordNumber = recordNumber + 1n;
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
          Number(recordNumber),
        ),
      );
      return;
    }

    const payload = record.payload as JsonObject;
    const eventTime = sourceDate(record.timestamp);
    switch (record.type) {
      case "session_meta": {
        if (typeof payload.id !== "string" || payload.id.length === 0) {
          malformedRecords += 1;
          warnings.push(
            sanitizedDiagnostic(
              "malformed_record",
              context.sourcePath,
              "session metadata is missing a stable id",
              Number(recordNumber),
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
          ...dateField(payload.timestamp ?? record.timestamp, "startedAt"),
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
              Number(recordNumber),
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
      case "turn_context": {
        if (typeof payload.model === "string" && payload.model.length > 0) {
          activeModel = payload.model;
          if (sessionId) {
            events.push(
              selectedEvent(
                sessionId,
                context.sourcePath,
                sourceIdentity,
                recordNumber,
                "model_context",
                eventTime,
                parserVersion,
              ),
            );
          }
        }
        break;
      }
      case "response_item": {
        const content = permittedMessageContent(payload.content);
        if (sessionId && payload.type === "message" && payload.role === "assistant" && content) {
          events.push(
            selectedEvent(
              sessionId,
              context.sourcePath,
              sourceIdentity,
              recordNumber,
              "assistant_message",
              eventTime,
              parserVersion,
              "assistant",
              content,
            ),
          );
        }
        // Mirrored user messages, reasoning, function calls, and tool results are excluded.
        break;
      }
      case "event_msg": {
        if (payload.type === "user_message" && sessionId && typeof payload.message === "string") {
          events.push(
            selectedEvent(
              sessionId,
              context.sourcePath,
              sourceIdentity,
              recordNumber,
              "user_message",
              eventTime,
              parserVersion,
              "user",
              payload.message,
            ),
          );
        } else if (
          payload.type === "agent_message" &&
          sessionId &&
          typeof payload.message === "string"
        ) {
          events.push(
            selectedEvent(
              sessionId,
              context.sourcePath,
              sourceIdentity,
              recordNumber,
              "assistant_message",
              eventTime,
              parserVersion,
              "assistant",
              payload.message,
            ),
          );
        } else if (payload.type === "token_count" && isObject(payload.info) && sessionId) {
          const cumulative = rawTokenObject(payload.info.total_token_usage);
          const last = rawTokenObject(payload.info.last_token_usage);
          if (cumulative !== null || last !== null) {
            const normalized = normalizeObservation(cumulative, last, baseline, epoch);
            epoch = normalized.epoch;
            if (cumulative !== null) baseline = cumulative;
            observations.push(
              usageObservation({
                sessionId,
                sourcePath: context.sourcePath,
                sourceIdentity,
                recordNumber,
                parserVersion,
                model: activeModel,
                eventTime,
                cumulative,
                last,
                normalized,
              }),
            );
            events.push(
              selectedEvent(
                sessionId,
                context.sourcePath,
                sourceIdentity,
                recordNumber,
                "token_usage",
                eventTime,
                parserVersion,
              ),
            );
          }
        } else if (payload.type === "session_end" && sessionId) {
          metadata = mergeMetadata(metadata, {
            sessionId,
            sourceRoot: context.sourceRoot,
            sourcePath: context.sourcePath,
            ...dateField(record.timestamp, "endedAt"),
          });
        }
        break;
      }
      case "token_usage":
      case "token_usage_v2": {
        if (record.type === "token_usage_v2" && parserVersion < 2) {
          unknownRecords += 1;
          warnings.push(
            sanitizedDiagnostic(
              "unknown_record",
              context.sourcePath,
              "unsupported record type",
              Number(recordNumber),
            ),
          );
          break;
        }
        const raw = rawTokenObject(payload);
        if (raw !== null && sessionId) {
          const cumulative = payload.cumulative === true || record.type === "token_usage_v2";
          const normalized = cumulative
            ? normalizeObservation(raw, null, baseline, epoch)
            : standaloneObservation(raw, epoch);
          epoch = normalized.epoch;
          if (cumulative) baseline = raw;
          observations.push(
            usageObservation({
              sessionId,
              sourcePath: context.sourcePath,
              sourceIdentity,
              recordNumber,
              parserVersion,
              model: activeModel,
              eventTime,
              cumulative: cumulative ? raw : null,
              last: cumulative ? null : raw,
              normalized,
            }),
          );
          events.push(
            selectedEvent(
              sessionId,
              context.sourcePath,
              sourceIdentity,
              recordNumber,
              "token_usage",
              eventTime,
              parserVersion,
            ),
          );
        }
        break;
      }
      default:
        unknownRecords += 1;
        warnings.push(
          sanitizedDiagnostic(
            "unknown_record",
            context.sourcePath,
            "unsupported record type",
            Number(recordNumber),
          ),
        );
    }
  });

  const mutations: SessionMutation[] = metadata ? [{ metadata }] : [];
  const parseState = sessionId
    ? {
        sourcePath: context.sourcePath,
        sessionId,
        sourceIdentity,
        parserVersion,
        activeModel,
        epoch,
        baseline,
        nextRecordNumber,
        factRevision: (context.parseState?.factRevision ?? 0n) + 1n,
      }
    : undefined;
  return {
    mutations,
    events,
    observations,
    diagnostics: { unknownRecords, malformedRecords, warnings },
    ...(sessionId ? { sessionId } : {}),
    ...(parseState ? { parseState } : {}),
  };
}

interface NormalizationResult {
  readonly categories: NormalizedTokenCategories;
  readonly epoch: number;
  readonly method: UsageObservation["method"];
  readonly anomalyCodes: readonly UsageAnomalyCode[];
}

function normalizeObservation(
  cumulative: RawTokenCounters | null,
  last: RawTokenCounters | null,
  baseline: RawTokenCounters | null,
  currentEpoch: number,
): NormalizationResult {
  if (cumulative === null) return standaloneObservation(last ?? emptyRaw(), currentEpoch);
  const reset = baseline !== null && counterDecreased(cumulative, baseline);
  if (reset) {
    const lastNormalized = last === null ? undefined : normalizeCategories(last);
    if (lastNormalized?.complete) {
      return {
        categories: lastNormalized.categories,
        epoch: currentEpoch + 1,
        method: "reset_last_usage",
        anomalyCodes: uniqueAnomalies(["counter_reset", ...lastNormalized.anomalyCodes]),
      };
    }
    return {
      categories: nullCategories(),
      epoch: currentEpoch + 1,
      method: "reset_incomplete",
      anomalyCodes: uniqueAnomalies([
        "counter_reset",
        "reset_without_last_usage",
        ...(lastNormalized?.anomalyCodes ?? []),
      ]),
    };
  }

  const difference = subtractCounters(cumulative, baseline ?? zeroRaw());
  const normalized = normalizeCategories(difference);
  const anomalies = [...normalized.anomalyCodes];
  if (last !== null) {
    const lastNormalized = normalizeCategories(last);
    if (
      lastNormalized.complete &&
      !sameCategories(normalized.categories, lastNormalized.categories)
    ) {
      anomalies.push("last_usage_mismatch");
    }
  }
  return {
    categories: normalized.categories,
    epoch: currentEpoch,
    method: "cumulative_difference",
    anomalyCodes: uniqueAnomalies(anomalies),
  };
}

function standaloneObservation(raw: RawTokenCounters, epoch: number): NormalizationResult {
  const normalized = normalizeCategories(raw);
  return {
    categories: normalized.categories,
    epoch,
    method: "standalone_delta",
    anomalyCodes: normalized.anomalyCodes,
  };
}

function normalizeCategories(raw: RawTokenCounters): {
  categories: NormalizedTokenCategories;
  complete: boolean;
  anomalyCodes: UsageAnomalyCode[];
} {
  const anomalies: UsageAnomalyCode[] = [];
  for (const value of [raw.input, raw.cachedInput, raw.output]) {
    if (value === null) anomalies.push("missing_counter");
    else if (value < 0n) anomalies.push("negative_counter");
  }
  const input = validCounter(raw.input);
  const output = validCounter(raw.output);
  let cachedInput = validCounter(raw.cachedInput);
  if (input !== null && cachedInput !== null && cachedInput > input) {
    cachedInput = null;
    anomalies.push("cached_exceeds_input");
  }
  const uncachedInput = input !== null && cachedInput !== null ? input - cachedInput : null;
  const total = input !== null && output !== null ? input + output : null;
  const categories = { input, cachedInput, uncachedInput, output, total };
  return {
    categories,
    complete: Object.values(categories).every((value) => value !== null),
    anomalyCodes: uniqueAnomalies(anomalies),
  };
}

function usageObservation(input: {
  sessionId: string;
  sourcePath: string;
  sourceIdentity: string;
  recordNumber: bigint;
  parserVersion: number;
  model: string;
  eventTime: Date | null;
  cumulative: RawTokenCounters | null;
  last: RawTokenCounters | null;
  normalized: NormalizationResult;
}): UsageObservation {
  return {
    observationId: `${input.sourcePath}:${input.recordNumber}:usage`,
    sessionId: input.sessionId,
    sourcePath: input.sourcePath,
    sourceIdentity: input.sourceIdentity,
    sourceRecordNumber: input.recordNumber,
    parserVersion: input.parserVersion,
    model: input.model,
    eventTime: input.eventTime,
    rawCumulative: input.cumulative,
    rawLast: input.last,
    normalized: input.normalized.categories,
    epoch: input.normalized.epoch,
    method: input.normalized.method,
    complete: Object.values(input.normalized.categories).every((value) => value !== null),
    anomalyCodes: input.normalized.anomalyCodes,
    legacy: false,
  };
}

function selectedEvent(
  sessionId: string,
  sourcePath: string,
  sourceIdentity: string,
  recordNumber: bigint,
  kind: SelectedEventKind,
  eventTime: Date | null,
  parserVersion: number,
  messageRole: "user" | "assistant" | null = null,
  messageContent: string | null = null,
): SelectedSessionEvent {
  return {
    eventId: `${sourcePath}:${recordNumber}:${kind}`,
    sessionId,
    sourcePath,
    sourceIdentity,
    sourceRecordNumber: recordNumber,
    kind,
    messageRole,
    eventTime,
    messageContent,
    parserVersion,
  };
}

function rawTokenObject(value: unknown): RawTokenCounters | null {
  if (!isObject(value)) return null;
  return {
    input: signedBigInt(value.input_tokens),
    cachedInput: signedBigInt(value.cached_input_tokens),
    output: signedBigInt(value.output_tokens),
  };
}

function signedBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/u.test(value)) return BigInt(value);
  return null;
}

function subtractCounters(current: RawTokenCounters, previous: RawTokenCounters): RawTokenCounters {
  return {
    input: subtract(current.input, previous.input),
    cachedInput: subtract(current.cachedInput, previous.cachedInput),
    output: subtract(current.output, previous.output),
  };
}

function subtract(current: bigint | null, previous: bigint | null): bigint | null {
  return current === null || previous === null ? null : current - previous;
}

function counterDecreased(current: RawTokenCounters, previous: RawTokenCounters): boolean {
  return (["input", "cachedInput", "output"] as const).some((key) => {
    const left = current[key];
    const right = previous[key];
    return left !== null && right !== null && left < right;
  });
}

function validCounter(value: bigint | null): bigint | null {
  return value !== null && value >= 0n ? value : null;
}

function sameCategories(
  left: NormalizedTokenCategories,
  right: NormalizedTokenCategories,
): boolean {
  return (Object.keys(left) as (keyof NormalizedTokenCategories)[]).every(
    (key) => left[key] === right[key],
  );
}

function nullCategories(): NormalizedTokenCategories {
  return { input: null, cachedInput: null, uncachedInput: null, output: null, total: null };
}

function zeroRaw(): RawTokenCounters {
  return { input: 0n, cachedInput: 0n, output: 0n };
}

function emptyRaw(): RawTokenCounters {
  return { input: null, cachedInput: null, output: null };
}

function uniqueAnomalies(values: readonly UsageAnomalyCode[]): UsageAnomalyCode[] {
  return [...new Set(values)];
}

function permittedMessageContent(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return null;
  const parts = value.flatMap((item) => {
    if (!isObject(item)) return [];
    if (item.type !== "output_text" && item.type !== "text") return [];
    return typeof item.text === "string" ? [item.text] : [];
  });
  return parts.length > 0 ? parts.join("\n") : null;
}

function sourceDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  const date = sourceDate(value);
  return date === null ? {} : ({ [key]: date } as Partial<Record<K, Date>>);
}
