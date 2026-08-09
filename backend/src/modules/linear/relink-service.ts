import type { AppDatabase } from "@/database/database.js";
import type { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import type { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import type { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import {
  stateForCurrentTitle,
  stateForLookupResult,
  titleFingerprint,
} from "@/modules/linear/attribution-state.js";
import type {
  LinearFailureCategory,
  LinearIssueReader,
  LinearLookupResult,
  SessionAttribution,
} from "@/modules/linear/domain.js";
import { LinearNotConfiguredError, SessionRelinkError } from "@/modules/linear/errors.js";
import { parseSessionTitle } from "@/modules/linear/title-parser.js";

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

  public async relink(sessionId: string): Promise<SessionAttribution> {
    if (!this.#reader) throw new LinearNotConfiguredError();
    const session = await this.#sessions.findById(sessionId);
    if (!session) {
      throw new SessionRelinkError(404, "session_not_found", "Session was not found");
    }
    const fingerprint = titleFingerprint(session.currentTitle);
    const parsed = parseSessionTitle(session.currentTitle);
    if (parsed.kind === "unlinked") {
      throw new SessionRelinkError(
        422,
        "linear_relink_candidate_missing",
        "The current session title does not contain a valid Linear issue candidate",
      );
    }

    let result = await this.#reader.findIssue(parsed.candidateIdentifier);
    if (
      result.kind === "found" &&
      result.issue.identifier.toUpperCase() !== parsed.candidateIdentifier
    ) {
      result = { kind: "error", category: "identifier_mismatch" };
    }
    if (result.kind !== "found") {
      await this.#recordFailedAttempt(sessionId, fingerprint, result);
      throw relinkFailure(result);
    }

    return this.#database.exclusiveWrite(async (connection) => {
      await connection.run("BEGIN TRANSACTION");
      try {
        const currentSession = await this.#sessions.findById(sessionId);
        const currentParsed = parseSessionTitle(currentSession?.currentTitle);
        if (
          !currentSession ||
          titleFingerprint(currentSession.currentTitle) !== fingerprint ||
          currentParsed.kind !== "candidate" ||
          currentParsed.candidateIdentifier !== parsed.candidateIdentifier
        ) {
          throw new SessionRelinkError(
            409,
            "linear_relink_stale_title",
            "The session title changed while the Linear issue was being resolved",
          );
        }

        const previous = await this.#attributions.findBySessionId(sessionId);
        const now = this.#now();
        const linked: SessionAttribution & { readonly linearId: string } = {
          sessionId,
          titleFingerprint: fingerprint,
          candidateIdentifier: currentParsed.candidateIdentifier,
          ...(currentParsed.phase ? { phase: currentParsed.phase } : {}),
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

  async #recordFailedAttempt(
    sessionId: string,
    fingerprint: string,
    result: Exclude<LinearLookupResult, { readonly kind: "found" }>,
  ): Promise<void> {
    await this.#database.exclusiveWrite(async (connection) => {
      await connection.run("BEGIN TRANSACTION");
      try {
        const session = await this.#sessions.findById(sessionId);
        if (!session || titleFingerprint(session.currentTitle) !== fingerprint) {
          await connection.run("COMMIT");
          return;
        }
        const previous = await this.#attributions.findBySessionId(sessionId);
        const current = stateForCurrentTitle({
          sessionId,
          ...(session.currentTitle ? { title: session.currentTitle } : {}),
          configured: true,
          ...(previous ? { previous } : {}),
          now: this.#now(),
        });
        await this.#attributions.save(stateForLookupResult(current, result, this.#now()));
        await connection.run("COMMIT");
      } catch (error) {
        await rollback(connection);
        throw error;
      }
    });
  }
}

function relinkFailure(
  result: Exclude<LinearLookupResult, { readonly kind: "found" }>,
): SessionRelinkError {
  if (result.kind === "not_found") {
    return new SessionRelinkError(
      404,
      "linear_relink_not_found",
      "The current Linear issue candidate was not found or is inaccessible",
    );
  }
  return new SessionRelinkError(
    failureStatus(result.category),
    `linear_relink_${result.category}`,
    "The current Linear issue candidate could not be resolved",
    result.category,
  );
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
