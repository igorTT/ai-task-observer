import { randomUUID } from "node:crypto";

import type { Logger } from "pino";

import type { AppDatabase } from "@/database/database.js";
import type { CodexSessionRecord } from "@/database/models/codex-session.model.js";
import type { CodexSessionRepository } from "@/database/repositories/codex-session-repository.js";
import type { LinearIssueRepository } from "@/database/repositories/linear-issue-repository.js";
import type { LinearSessionAttributionRepository } from "@/database/repositories/linear-session-attribution-repository.js";
import type { LinearSyncRunRepository } from "@/database/repositories/linear-sync-run-repository.js";
import {
  stateForCurrentTitle,
  stateForLookupResult,
  titleFingerprint,
} from "@/modules/linear/attribution-state.js";
import type {
  AttributionStatus,
  LinearFailureCategory,
  LinearIssueReader,
  LinearLookupResult,
  LinearSyncRun,
  LinearSyncTrigger,
  SessionAttribution,
} from "@/modules/linear/domain.js";
import { LinearNotConfiguredError } from "@/modules/linear/errors.js";
import { SessionRelinkService } from "@/modules/linear/relink-service.js";

export { LinearNotConfiguredError } from "@/modules/linear/errors.js";

export interface LinearSyncResult {
  readonly runId: string;
  readonly state: "queued" | "running";
  readonly coalesced: boolean;
}

export interface LinearStatusSnapshot {
  readonly configured: boolean;
  readonly state: "unconfigured" | "idle" | "queued" | "running" | "shutting_down";
  readonly acceptingWork: boolean;
  readonly currentRun?: LinearSyncRun;
  readonly lastCompletedRun?: LinearSyncRun;
  readonly counts: Record<AttributionStatus, number>;
}

export interface AttributionCoordinatorOptions {
  readonly database: AppDatabase;
  readonly sessions: CodexSessionRepository;
  readonly attributions: LinearSessionAttributionRepository;
  readonly issues: LinearIssueRepository;
  readonly runs: LinearSyncRunRepository;
  readonly reader?: LinearIssueReader;
  readonly logger: Logger;
  readonly cacheTtlMs: number;
  readonly maxConcurrency: number;
  readonly now?: () => Date;
}

interface RunCounts {
  candidateCount: number;
  linkedCount: number;
  notFoundCount: number;
  errorCount: number;
}

interface ReconciliationGroup {
  readonly initial: SessionAttribution[];
  readonly refresh: SessionAttribution[];
}

export class AttributionCoordinator {
  readonly #database: AppDatabase;
  readonly #sessions: CodexSessionRepository;
  readonly #attributions: LinearSessionAttributionRepository;
  readonly #issues: LinearIssueRepository;
  readonly #runs: LinearSyncRunRepository;
  readonly #reader: LinearIssueReader | undefined;
  readonly #logger: Logger;
  readonly #cacheTtlMs: number;
  readonly #maxConcurrency: number;
  readonly #now: () => Date;
  readonly #relinkService: SessionRelinkService;
  readonly #pendingSessionIds = new Set<string>();
  readonly #lookups = new Map<string, Promise<LinearLookupResult>>();
  readonly #activeRelinks = new Set<Promise<SessionAttribution>>();
  #acceptingWork = false;
  #currentRunId: string | undefined;
  #currentState: "queued" | "running" | undefined;
  #activePromise: Promise<void> | undefined;
  #reconcileAll = false;

  public constructor(options: AttributionCoordinatorOptions) {
    this.#database = options.database;
    this.#sessions = options.sessions;
    this.#attributions = options.attributions;
    this.#issues = options.issues;
    this.#runs = options.runs;
    this.#reader = options.reader;
    this.#logger = options.logger;
    this.#cacheTtlMs = options.cacheTtlMs;
    this.#maxConcurrency = options.maxConcurrency;
    this.#now = options.now ?? (() => new Date());
    this.#relinkService = new SessionRelinkService({
      database: options.database,
      sessions: options.sessions,
      attributions: options.attributions,
      issues: options.issues,
      ...(options.reader ? { reader: options.reader } : {}),
      now: this.#now,
    });
  }

  public async start(): Promise<void> {
    if (this.#acceptingWork) return;
    this.#acceptingWork = true;
    await this.#schedule("startup", undefined);
  }

  public async notifySessions(sessionIds: readonly string[]): Promise<void> {
    if (!this.#acceptingWork || sessionIds.length === 0) return;
    for (const sessionId of sessionIds) this.#pendingSessionIds.add(sessionId);
    await this.#schedule("event", sessionIds);
  }

  public async sync(): Promise<LinearSyncResult> {
    if (!this.#reader) throw new LinearNotConfiguredError();
    if (!this.#acceptingWork) throw new Error("Linear attribution is shutting down");
    if (this.#currentRunId) {
      this.#reconcileAll = true;
      return {
        runId: this.#currentRunId,
        state: this.#currentState ?? "running",
        coalesced: true,
      };
    }
    const runId = await this.#schedule("manual", undefined);
    return { runId, state: "queued", coalesced: false };
  }

  public relink(sessionId: string): Promise<SessionAttribution> {
    if (!this.#acceptingWork) {
      return Promise.reject(new Error("Linear attribution is shutting down"));
    }
    const relink = this.#relinkService.relink(sessionId);
    this.#activeRelinks.add(relink);
    const remove = (): void => {
      this.#activeRelinks.delete(relink);
    };
    void relink.then(remove, remove);
    return relink;
  }

  public async status(): Promise<LinearStatusSnapshot> {
    const { currentRun, lastCompletedRun, counts } = await this.#database.exclusiveWrite(
      async () => ({
        currentRun: this.#currentRunId ? await this.#runs.find(this.#currentRunId) : undefined,
        lastCompletedRun: await this.#runs.latestCompleted(),
        counts: await this.#attributions.counts(),
      }),
    );
    return {
      configured: this.#reader !== undefined,
      state: !this.#reader
        ? "unconfigured"
        : !this.#acceptingWork
          ? "shutting_down"
          : (this.#currentState ?? "idle"),
      acceptingWork: this.#acceptingWork,
      ...(currentRun ? { currentRun } : {}),
      ...(lastCompletedRun ? { lastCompletedRun } : {}),
      counts,
    };
  }

  public async close(): Promise<void> {
    this.#acceptingWork = false;
    await Promise.all([this.#activePromise, Promise.allSettled([...this.#activeRelinks])]);
  }

  async #schedule(
    trigger: LinearSyncTrigger,
    sessionIds: readonly string[] | undefined,
  ): Promise<string> {
    if (sessionIds) for (const sessionId of sessionIds) this.#pendingSessionIds.add(sessionId);
    else this.#reconcileAll = true;
    if (this.#currentRunId) return this.#currentRunId;

    const runId = randomUUID();
    this.#currentRunId = runId;
    this.#currentState = "queued";
    await this.#database.exclusiveWrite(() => this.#runs.create(runId, trigger));
    const active = this.#executeRun(runId);
    this.#activePromise = active;
    const remove = (): void => {
      if (this.#activePromise === active) this.#activePromise = undefined;
    };
    void active.then(remove, remove);
    return runId;
  }

  async #executeRun(runId: string): Promise<void> {
    const counts: RunCounts = {
      candidateCount: 0,
      linkedCount: 0,
      notFoundCount: 0,
      errorCount: 0,
    };
    let authenticationFailure = false;
    try {
      this.#currentState = "running";
      await this.#database.exclusiveWrite(() => this.#runs.setState(runId, "running"));
      do {
        const all = this.#reconcileAll;
        this.#reconcileAll = false;
        const requestedIds = new Set(this.#pendingSessionIds);
        this.#pendingSessionIds.clear();
        const sessions = all
          ? await this.#sessions.listAll()
          : await this.#loadSessions(requestedIds);
        const result = await this.#reconcile(runId, sessions, counts);
        authenticationFailure ||= result.authenticationFailure;
      } while (!authenticationFailure && (this.#reconcileAll || this.#pendingSessionIds.size > 0));

      await this.#database.exclusiveWrite(async () => {
        await this.#runs.setCounts(runId, counts);
        await this.#runs.setState(
          runId,
          authenticationFailure ? "failed" : "completed",
          authenticationFailure ? "authentication" : undefined,
        );
      });
    } catch {
      this.#logger.error({ runId, category: "unknown" }, "Linear synchronization failed");
      await this.#database.exclusiveWrite(async () => {
        await this.#runs.setCounts(runId, { ...counts, errorCount: counts.errorCount + 1 });
        await this.#runs.setState(runId, "failed", "unknown");
      });
    } finally {
      this.#currentRunId = undefined;
      this.#currentState = undefined;
    }
  }

  async #loadSessions(sessionIds: ReadonlySet<string>): Promise<CodexSessionRecord[]> {
    const sessions = await Promise.all(
      [...sessionIds].map((sessionId) => this.#sessions.findById(sessionId)),
    );
    return sessions.filter((session): session is CodexSessionRecord => session !== undefined);
  }

  async #reconcile(
    runId: string,
    sessions: readonly CodexSessionRecord[],
    counts: RunCounts,
  ): Promise<{ authenticationFailure: boolean }> {
    const candidates = new Map<string, ReconciliationGroup>();
    const changed: SessionAttribution[] = [];
    for (const session of sessions) {
      const previous = await this.#attributions.findBySessionId(session.sessionId);
      const current = stateForCurrentTitle({
        sessionId: session.sessionId,
        ...(session.currentTitle ? { title: session.currentTitle } : {}),
        configured: this.#reader !== undefined,
        ...(previous ? { previous } : {}),
        now: this.#now(),
      });
      if (current !== previous) changed.push(current);
      if (!this.#reader) continue;
      if (current.status === "linked" && current.linearId) {
        const linkedIssue = await this.#issues.findById(current.linearId);
        if (
          linkedIssue &&
          this.#now().getTime() - linkedIssue.syncedAt.getTime() >= this.#cacheTtlMs
        ) {
          const group = candidates.get(linkedIssue.identifier) ?? { initial: [], refresh: [] };
          group.refresh.push(current);
          candidates.set(linkedIssue.identifier, group);
        }
        continue;
      }
      if (!current.candidateIdentifier) continue;
      const cache = await this.#issues.findByIdentifier(current.candidateIdentifier);
      const fresh = cache && this.#now().getTime() - cache.syncedAt.getTime() < this.#cacheTtlMs;
      const needsLookup =
        current.status === "pending" ||
        current.status === "not_found" ||
        current.status === "error" ||
        current.status === "unconfigured" ||
        !fresh;
      if (!needsLookup) continue;
      const group = candidates.get(current.candidateIdentifier) ?? { initial: [], refresh: [] };
      group.initial.push(current);
      candidates.set(current.candidateIdentifier, group);
    }

    if (changed.length > 0) await this.#saveStates(changed);
    if (!this.#reader || candidates.size === 0) return { authenticationFailure: false };

    let authenticationFailure = false;
    const entries = [...candidates.entries()];
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
      while (!authenticationFailure) {
        const index = nextIndex;
        nextIndex += 1;
        const entry = entries[index];
        if (!entry) return;
        const [identifier, group] = entry;
        const cached = await this.#issues.findByIdentifier(identifier);
        const isFresh =
          cached && this.#now().getTime() - cached.syncedAt.getTime() < this.#cacheTtlMs;
        const result: LinearLookupResult = isFresh
          ? { kind: "found", issue: cached }
          : await this.#lookup(identifier);
        if (result.kind === "error" && result.category === "authentication") {
          authenticationFailure = true;
        }
        const updatedCount = await this.#persistResult(runId, group, result);
        counts.candidateCount += 1;
        if (result.kind === "found") counts.linkedCount += updatedCount;
        else if (result.kind === "not_found") counts.notFoundCount += updatedCount;
        else counts.errorCount += updatedCount;
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(this.#maxConcurrency, entries.length) }, () => worker()),
    );
    return { authenticationFailure };
  }

  #lookup(identifier: string): Promise<LinearLookupResult> {
    const existing = this.#lookups.get(identifier);
    if (existing) return existing;
    const lookup = this.#reader!.findIssue(identifier);
    this.#lookups.set(identifier, lookup);
    void lookup.finally(() => {
      if (this.#lookups.get(identifier) === lookup) this.#lookups.delete(identifier);
    });
    return lookup;
  }

  async #saveStates(states: readonly SessionAttribution[]): Promise<void> {
    await this.#database.exclusiveWrite(async (connection) => {
      await connection.run("BEGIN TRANSACTION");
      try {
        for (const state of states) await this.#attributions.save(state);
        await connection.run("COMMIT");
      } catch (error) {
        await rollback(connection);
        throw error;
      }
    });
  }

  async #persistResult(
    runId: string,
    group: ReconciliationGroup,
    result: LinearLookupResult,
  ): Promise<number> {
    return this.#database.exclusiveWrite(async (connection) => {
      await connection.run("BEGIN TRANSACTION");
      try {
        let updatedCount = 0;
        if (result.kind === "found") await this.#issues.upsert(result.issue, this.#now());
        for (const candidateState of group.initial) {
          const session = await this.#sessions.findById(candidateState.sessionId);
          if (
            !session ||
            titleFingerprint(session.currentTitle) !== candidateState.titleFingerprint
          ) {
            continue;
          }
          const current = await this.#attributions.findBySessionId(candidateState.sessionId);
          if (
            !current ||
            current.titleFingerprint !== candidateState.titleFingerprint ||
            current.candidateIdentifier !== candidateState.candidateIdentifier ||
            current.status === "linked" ||
            current.linearId !== undefined
          ) {
            continue;
          }
          await this.#attributions.save(stateForLookupResult(current, result, this.#now()));
          updatedCount += 1;
        }
        for (const refreshState of group.refresh) {
          const current = await this.#attributions.findBySessionId(refreshState.sessionId);
          if (!current || !refreshState.linearId || current.linearId !== refreshState.linearId) {
            continue;
          }
          await this.#attributions.save(stateForLookupResult(current, result, this.#now()));
          updatedCount += 1;
        }
        await this.#runs.addCounts(runId, {
          candidateCount: 1,
          ...(result.kind === "found" ? { linkedCount: updatedCount } : {}),
          ...(result.kind === "not_found" ? { notFoundCount: updatedCount } : {}),
          ...(result.kind === "error" ? { errorCount: updatedCount } : {}),
        });
        await connection.run("COMMIT");
        return updatedCount;
      } catch (error) {
        await rollback(connection);
        throw error;
      }
    });
  }
}

async function rollback(connection: AppDatabase["connection"]): Promise<void> {
  try {
    await connection.run("ROLLBACK");
  } catch {
    // Preserve the original transaction failure.
  }
}

export function isRetryableFailure(category: LinearFailureCategory): boolean {
  return ["rate_limit", "network", "timeout", "upstream", "unknown"].includes(category);
}
