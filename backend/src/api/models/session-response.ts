import type { SessionAttributionResponse } from "@/api/models/linear-response.js";

export interface SessionResponse {
  readonly sessionId: string;
  readonly currentTitle?: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
  readonly developerTurns: string;
  readonly inputTokens: string;
  readonly cachedInputTokens: string;
  readonly outputTokens: string;
  readonly totalTokens: string;
  readonly usageObserved: boolean;
  readonly importState: string;
  readonly attribution: SessionAttributionResponse;
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
