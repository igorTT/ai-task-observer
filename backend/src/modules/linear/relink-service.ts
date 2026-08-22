import type { AppDatabase } from "@/database/database.js";
import type { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import type { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import type { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import { titleFingerprint } from "@/modules/linear/attribution-state.js";
import type {
  LinearFailureCategory,
  LinearIssueReader,
  SessionAttribution,
} from "@/modules/linear/domain.js";
import { LinearNotConfiguredError, SessionRelinkError } from "@/modules/linear/errors.js";

const ISSUE_IDENTIFIER_PATTERN = /^([A-Za-z][A-Za-z0-9]*)-([1-9][0-9]*)$/u;

export interface SessionRelinkServiceOptions {
  readonly database: AppDatabase;
  readonly sessions: CodexSessionRepository;
  readonly attributions: LinearSessionAttributionRepository;
  readonly issues: LinearIssueRepository;
  readonly reader?: LinearIssueReader;
  readonly now?: () => Date;
}

export class SessionRelinkService {
  readonly #database: AppDatabase;
  readonly #sessions: CodexSessionRepository;
  readonly #attributions: LinearSessionAttributionRepository;
  readonly #issues: LinearIssueRepository;
  readonly #reader: LinearIssueReader | undefined;
  readonly #now: () => Date;

  public constructor(options: SessionRelinkServiceOptions) {
    this.#database = options.database;
    this.#sessions = options.sessions;
    this.#attributions = options.attributions;
    this.#issues = options.issues;
    this.#reader = options.reader;
    this.#now = options.now ?? (() => new Date());
  }

  public async relink(sessionId: string, issueIdentifier: string): Promise<SessionAttribution> {
    const normalizedIdentifier = normalizeIssueIdentifier(issueIdentifier);
    if (!normalizedIdentifier) {
      throw new SessionRelinkError(
        422,
        "linear_relink_invalid_identifier",
        "The supplied Linear issue identifier is invalid",
      );
    }
    if (!this.#reader) throw new LinearNotConfiguredError();
    const session = await this.#sessions.findById(sessionId);
    if (!session) {
      throw new SessionRelinkError(404, "session_not_found", "Session was not found");
    }

    let result = await this.#reader.findIssue(normalizedIdentifier);
    if (
      result.kind === "found" &&
      normalizeIssueIdentifier(result.issue.identifier) !== normalizedIdentifier
    ) {
      result = { kind: "error", category: "identifier_mismatch" };
    }
    if (result.kind !== "found") {
      throw relinkFailure(result);
    }

    return this.#database.exclusiveWrite(async (connection) => {
      await connection.run("BEGIN TRANSACTION");
      try {
        const currentSession = await this.#sessions.findById(sessionId);
        if (!currentSession) {
          throw new SessionRelinkError(404, "session_not_found", "Session was not found");
        }

        const previous = await this.#attributions.findBySessionId(sessionId);
        if (
          previous?.status === "linked" &&
          previous.linearId === result.issue.linearId &&
          previous.candidateIdentifier === normalizedIdentifier
        ) {
          await connection.run("COMMIT");
          return previous;
        }
        const now = this.#now();
        const linked: SessionAttribution & { readonly linearId: string } = {
          sessionId,
          titleFingerprint: titleFingerprint(currentSession.currentTitle),
          candidateIdentifier: normalizedIdentifier,
          ...(previous?.phase ? { phase: previous.phase } : {}),
          status: "linked",
          linearId: result.issue.linearId,
          lastAttemptAt: now,
          lastSuccessAt: now,
          updatedAt: now,
        };
        await this.#issues.upsert(result.issue, now);
        if (previous) await this.#attributions.replaceLink(linked);
        else await this.#attributions.save(linked);
        await connection.run("COMMIT");
        return linked;
      } catch (error) {
        await rollback(connection);
        throw error;
      }
    });
  }
}

function relinkFailure(
  result:
    | { readonly kind: "not_found" }
    | { readonly kind: "error"; readonly category: LinearFailureCategory },
): SessionRelinkError {
  if (result.kind === "not_found") {
    return new SessionRelinkError(
      404,
      "linear_relink_not_found",
      "The requested Linear issue was not found or is inaccessible",
    );
  }
  return new SessionRelinkError(
    failureStatus(result.category),
    `linear_relink_${result.category}`,
    "The requested Linear issue could not be resolved",
    result.category,
  );
}

function normalizeIssueIdentifier(identifier: string): string | undefined {
  const match = ISSUE_IDENTIFIER_PATTERN.exec(identifier);
  if (!match?.[1] || !match[2]) return undefined;
  return `${match[1].toUpperCase()}-${match[2]}`;
}

function failureStatus(category: LinearFailureCategory): number {
  return ["rate_limit", "network", "timeout", "upstream"].includes(category) ? 503 : 502;
}

async function rollback(connection: AppDatabase["connection"]): Promise<void> {
  try {
    await connection.run("ROLLBACK");
  } catch {
    // Preserve the original transaction failure.
  }
}
