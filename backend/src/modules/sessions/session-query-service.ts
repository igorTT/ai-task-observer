import { jsonSafeCount } from "@/database/models/codex-session-usage.model.js";
import type { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import type { CodexSessionUsageRepository } from "@/database/repositories/codex-session-usage-repository.js";
import type { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import type { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import type { SessionAttributionResponse } from "@/api/models/linear-response.js";

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
  readonly attribution: SessionAttributionResponse;
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
    private readonly attributions?: LinearSessionAttributionRepository,
    private readonly issues?: LinearIssueRepository,
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
    const [session, usage, attribution] = await Promise.all([
      this.sessions.findById(sessionId),
      this.usage.findBySessionId(sessionId),
      this.attributions?.findBySessionId(sessionId),
    ]);
    if (!session) throw new Error("Session disappeared during query");
    const issue =
      attribution?.linearId && this.issues ? await this.#issue(attribution.linearId) : undefined;
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
      attribution: attribution
        ? {
            status: attribution.status,
            ...(attribution.candidateIdentifier
              ? { candidateIdentifier: attribution.candidateIdentifier }
              : {}),
            ...(attribution.phase ? { phase: attribution.phase } : {}),
            ...(issue ? { issue } : {}),
            relinkRequired:
              attribution.status === "linked" &&
              attribution.candidateIdentifier !== undefined &&
              issue !== undefined &&
              attribution.candidateIdentifier !== issue.identifier,
            ...(attribution.lastAttemptAt
              ? { lastAttemptAt: attribution.lastAttemptAt.toISOString() }
              : {}),
            ...(attribution.lastSuccessAt
              ? { lastSuccessAt: attribution.lastSuccessAt.toISOString() }
              : {}),
            synchronizationState:
              attribution.status === "linked" ? "synchronized" : attribution.status,
            ...(attribution.failureCategory
              ? { failureCategory: attribution.failureCategory }
              : {}),
          }
        : { status: "unlinked", relinkRequired: false, synchronizationState: "unlinked" },
    };
  }

  async #issue(linearId: string): Promise<NonNullable<SessionAttributionResponse["issue"]>> {
    const issue = await this.issues!.findById(linearId);
    if (!issue) throw new Error("Attributed Linear issue disappeared during query");
    return {
      id: issue.linearId,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url,
      team: issue.team,
      state: issue.state,
      updatedAt: issue.updatedAt.toISOString(),
      synchronizedAt: issue.syncedAt.toISOString(),
    };
  }
}
