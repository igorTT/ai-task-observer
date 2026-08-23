import type { AppDatabase } from "@/database/database.js";
import type { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import type { SessionPhaseAssignmentRepository } from "@/database/repositories/session-phase-assignment-repository.js";
import type { SessionPhase } from "@/modules/sessions/domain.js";
import type { SessionQueryService, SessionView } from "@/modules/sessions/session-query-service.js";

export interface SessionPhaseServiceOptions {
  readonly database: AppDatabase;
  readonly sessions: CodexSessionRepository;
  readonly assignments: SessionPhaseAssignmentRepository;
  readonly query: SessionQueryService;
}

export class SessionPhaseService {
  readonly #database: AppDatabase;
  readonly #sessions: CodexSessionRepository;
  readonly #assignments: SessionPhaseAssignmentRepository;
  readonly #query: SessionQueryService;

  public constructor(options: SessionPhaseServiceOptions) {
    this.#database = options.database;
    this.#sessions = options.sessions;
    this.#assignments = options.assignments;
    this.#query = options.query;
  }

  public async set(sessionId: string, phase: SessionPhase | null): Promise<SessionView> {
    await this.#database.exclusiveWrite(async (connection) => {
      await connection.run("BEGIN TRANSACTION");
      try {
        if (!(await this.#sessions.findById(sessionId))) throw new SessionPhaseNotFoundError();
        if (phase === null) await this.#assignments.clear(sessionId);
        else await this.#assignments.upsert(sessionId, phase);
        await connection.run("COMMIT");
      } catch (error) {
        try {
          await connection.run("ROLLBACK");
        } catch {
          // Preserve the original failure.
        }
        throw error;
      }
    });

    const session = await this.#query.find(sessionId);
    if (!session) throw new SessionPhaseNotFoundError();
    return session;
  }
}

export class SessionPhaseNotFoundError extends Error {
  public readonly status = 404;
  public readonly code = "session_not_found";

  public constructor() {
    super("Session was not found");
    this.name = "SessionPhaseNotFoundError";
  }
}
