import type { SessionAttributionResponse } from "@/api/models/linear-response.js";

export interface SessionResponse {
  readonly sessionId: string;
  readonly currentTitle?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly developerTurns: string;
  readonly inputTokens: string | null;
  readonly cachedInputTokens: string | null;
  readonly uncachedInputTokens: string | null;
  readonly outputTokens: string | null;
  readonly totalTokens: string | null;
  readonly usageObserved: boolean;
  readonly tokenCompleteness: TokenCompletenessResponse;
  readonly usageAnomalies: readonly string[];
  readonly importState: string;
  readonly attribution: SessionAttributionResponse;
}

export interface TokenCompletenessResponse {
  readonly input: boolean;
  readonly cachedInput: boolean;
  readonly uncachedInput: boolean;
  readonly output: boolean;
  readonly total: boolean;
}

export interface SessionPageResponse {
  readonly items: readonly SessionResponse[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ErrorResponse {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}
