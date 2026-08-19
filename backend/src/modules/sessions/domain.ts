export type ImportState = "pending" | "importing" | "ready" | "stale" | "failed";
export type ImportRunState = "queued" | "running" | "completed" | "failed";
export type ImportTrigger = "startup" | "watch" | "rescan" | "rediscovery";

export interface TokenValues {
  readonly input: bigint;
  readonly cachedInput: bigint;
  readonly output: bigint;
}

export interface RawTokenCounters {
  readonly input: bigint | null;
  readonly cachedInput: bigint | null;
  readonly output: bigint | null;
}

export interface NormalizedTokenCategories {
  readonly input: bigint | null;
  readonly cachedInput: bigint | null;
  readonly uncachedInput: bigint | null;
  readonly output: bigint | null;
  readonly total: bigint | null;
}

export type SelectedEventKind =
  "user_message" | "assistant_message" | "model_context" | "token_usage";
export type MessageRole = "user" | "assistant";
export type NormalizationMethod =
  | "cumulative_difference"
  | "reset_last_usage"
  | "reset_incomplete"
  | "standalone_delta"
  | "legacy_aggregate";
export type UsageAnomalyCode =
  | "last_usage_mismatch"
  | "counter_reset"
  | "reset_without_last_usage"
  | "negative_counter"
  | "cached_exceeds_input"
  | "missing_counter"
  | "legacy_aggregate";

export interface SelectedSessionEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly sourcePath: string;
  readonly sourceIdentity: string;
  readonly sourceRecordNumber: bigint;
  readonly kind: SelectedEventKind;
  readonly messageRole: MessageRole | null;
  readonly eventTime: Date | null;
  readonly messageContent: string | null;
  readonly parserVersion: number;
}

export interface UsageObservation {
  readonly observationId: string;
  readonly sessionId: string;
  readonly sourcePath: string;
  readonly sourceIdentity: string;
  readonly sourceRecordNumber: bigint;
  readonly parserVersion: number;
  readonly model: string;
  readonly eventTime: Date | null;
  readonly rawCumulative: RawTokenCounters | null;
  readonly rawLast: RawTokenCounters | null;
  readonly normalized: NormalizedTokenCategories;
  readonly epoch: number;
  readonly method: NormalizationMethod;
  readonly complete: boolean;
  readonly anomalyCodes: readonly UsageAnomalyCode[];
  readonly legacy: boolean;
}

export interface SourceParseState {
  readonly sourcePath: string;
  readonly sessionId: string;
  readonly sourceIdentity: string;
  readonly parserVersion: number;
  readonly activeModel: string;
  readonly epoch: number;
  readonly baseline: RawTokenCounters | null;
  readonly nextRecordNumber: bigint;
  readonly factRevision: bigint;
}

export interface SessionMetadataMutation {
  readonly sessionId: string;
  readonly sourceRoot: string;
  readonly sourcePath: string;
  readonly title?: string;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
}

export interface SessionMutation {
  readonly metadata?: SessionMetadataMutation;
  readonly sessionId?: string;
  readonly developerTurnDelta?: bigint;
  readonly tokenSnapshot?: TokenValues;
  readonly tokenDelta?: TokenValues;
  readonly usageObserved?: boolean;
}

export interface ParserDiagnostics {
  readonly unknownRecords: number;
  readonly malformedRecords: number;
  readonly warnings: readonly SanitizedDiagnostic[];
}

export interface SanitizedDiagnostic {
  readonly category: "unknown_record" | "malformed_record" | "source_failure";
  readonly sourcePath: string;
  readonly recordNumber?: number;
  readonly message: string;
}

export interface SourceIdentity {
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: bigint;
  readonly modifiedAtMs: bigint;
}

export interface ImportCheckpoint {
  readonly sourcePath: string;
  readonly sourceRoot: string;
  readonly sourceIdentity: string;
  readonly committedOffset: bigint;
  readonly observedSize: bigint;
  readonly observedModifiedAtMs: bigint;
  readonly parserVersion: number;
  readonly status: ImportState;
  readonly unknownRecords: number;
  readonly malformedRecords: number;
  readonly lastError?: string;
  readonly updatedAt: Date;
}

export interface ImportRun {
  readonly runId: string;
  readonly trigger: ImportTrigger;
  readonly state: ImportRunState;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  readonly rootsDiscovered: number;
  readonly filesDiscovered: number;
  readonly filesImported: number;
  readonly sessionsImported: number;
  readonly warnings: number;
  readonly errors: number;
  readonly summary?: string;
}

export interface SourceChunkMutation {
  readonly sourcePath: string;
  readonly sourceRoot: string;
  readonly sourceIdentity: string;
  readonly committedOffset: bigint;
  readonly observedSize: bigint;
  readonly observedModifiedAtMs: bigint;
  readonly parserVersion: number;
  readonly mutations: readonly SessionMutation[];
  readonly events: readonly SelectedSessionEvent[];
  readonly observations: readonly UsageObservation[];
  readonly parseState: SourceParseState;
  readonly diagnostics: ParserDiagnostics;
  readonly runId?: string;
  readonly rebuild: boolean;
}

export function assertNonNegative(value: bigint, name: string): bigint {
  if (value < 0n) throw new RangeError(`${name} must be non-negative`);
  return value;
}

export function tokenValues(input: bigint, cachedInput: bigint, output: bigint): TokenValues {
  return {
    input: assertNonNegative(input, "input tokens"),
    cachedInput: assertNonNegative(cachedInput, "cached input tokens"),
    output: assertNonNegative(output, "output tokens"),
  };
}

export function emptyRawTokenCounters(): RawTokenCounters {
  return { input: null, cachedInput: null, output: null };
}
