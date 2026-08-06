import { jsonSafeCount } from "@/database/models/codex-session-usage.model.js";
import type { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import type { CodexSessionUsageRepository } from "@/database/repositories/codex-session-usage-repository.js";

export interface SessionView {
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
}

export interface SessionPage {
  readonly items: readonly SessionView[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export class SessionQueryService {
  public constructor(
    private readonly sessions: CodexSessionRepository,
    private readonly usage: CodexSessionUsageRepository,
  ) {}

  public async list(limit: number, offset: number): Promise<SessionPage> {
    const [records, total] = await Promise.all([
      this.sessions.list(limit, offset),
      this.sessions.count(),
    ]);
    return {
      items: await Promise.all(records.map(async (record) => this.#view(record.sessionId))),
      total,
      limit,
      offset,
    };
  }

  public async find(sessionId: string): Promise<SessionView | undefined> {
    const session = await this.sessions.findById(sessionId);
    return session ? this.#view(sessionId) : undefined;
  }

  async #view(sessionId: string): Promise<SessionView> {
    const [session, usage] = await Promise.all([
      this.sessions.findById(sessionId),
      this.usage.findBySessionId(sessionId),
    ]);
    if (!session) throw new Error("Session disappeared during query");
    return {
      sessionId: session.sessionId,
      ...(session.currentTitle ? { currentTitle: session.currentTitle } : {}),
      ...(session.startedAt ? { startedAt: session.startedAt.toISOString() } : {}),
      ...(session.endedAt ? { endedAt: session.endedAt.toISOString() } : {}),
      developerTurns: jsonSafeCount(session.developerTurns),
      inputTokens: jsonSafeCount(usage?.inputTokens ?? 0n),
      cachedInputTokens: jsonSafeCount(usage?.cachedInputTokens ?? 0n),
      outputTokens: jsonSafeCount(usage?.outputTokens ?? 0n),
      totalTokens: jsonSafeCount(usage?.totalTokens ?? 0n),
      usageObserved: usage?.usageObserved ?? false,
      importState: session.importState,
    };
  }
}
