import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import chokidar, { type FSWatcher } from "chokidar";
import type { Logger } from "pino";

import type { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import {
  discoverRoot,
  isSupportedCodexSource,
  type RootDiscoveryStatus,
} from "@/modules/sessions/discovery.js";
import type { CodexSourceImporter } from "@/modules/sessions/importer.js";
import type { ImportRun, ImportTrigger } from "@/modules/sessions/domain.js";

export interface RescanResult {
  readonly runId: string;
  readonly state: "queued" | "running";
  readonly coalesced: boolean;
}

export interface IngestionStatusSnapshot {
  readonly roots: readonly RootDiscoveryStatus[];
  readonly currentRun?: ImportRun;
  readonly lastCompletedRun?: ImportRun;
  readonly checkpoints: readonly {
    source: string;
    status: string;
    completeOffset: string;
    unknownRecords: number;
    malformedRecords: number;
    lastError?: string;
  }[];
  readonly acceptingWork: boolean;
}

export interface IngestionCoordinatorOptions {
  readonly roots: readonly string[];
  readonly importer: CodexSourceImporter;
  readonly repository: CodexIngestionRepository;
  readonly logger: Logger;
  readonly debounceMs: number;
  readonly rediscoveryMs: number;
  readonly watchUsePolling?: boolean;
  readonly discover?: (root: string) => Promise<RootDiscoveryStatus>;
}

export class IngestionCoordinator {
  readonly #roots: readonly string[];
  readonly #importer: CodexSourceImporter;
  readonly #repository: CodexIngestionRepository;
  readonly #logger: Logger;
  readonly #debounceMs: number;
  readonly #rediscoveryMs: number;
  readonly #watchUsePolling: boolean;
  readonly #discover: (root: string) => Promise<RootDiscoveryStatus>;
  readonly #rootStatus = new Map<string, RootDiscoveryStatus>();
  readonly #watchers = new Map<string, FSWatcher>();
  readonly #debounceTimers = new Map<string, NodeJS.Timeout>();
  readonly #pending = new Map<string, { root: string; runId?: string }>();
  #acceptingWork = false;
  #drainPromise: Promise<void> | undefined;
  #runPromise: Promise<void> | undefined;
  #currentRunId: string | undefined;
  #rediscoveryTimer: NodeJS.Timeout | undefined;

  public constructor(options: IngestionCoordinatorOptions) {
    this.#roots = options.roots;
    this.#importer = options.importer;
    this.#repository = options.repository;
    this.#logger = options.logger;
    this.#debounceMs = options.debounceMs;
    this.#rediscoveryMs = options.rediscoveryMs;
    this.#watchUsePolling = options.watchUsePolling ?? false;
    this.#discover = options.discover ?? discoverRoot;
  }

  public async start(): Promise<void> {
    if (this.#acceptingWork) return;
    this.#acceptingWork = true;
    await this.#refreshRoots("all", true);
    this.#rediscoveryTimer = setInterval(() => {
      void this.#refreshRoots("unavailable", false).catch((error: unknown) =>
        this.#logger.error({ error: errorName(error) }, "Codex root rediscovery failed"),
      );
    }, this.#rediscoveryMs);
    this.#rediscoveryTimer.unref();
    await this.#scheduleRun("startup");
    await this.#runPromise;
  }

  public async rescan(): Promise<RescanResult> {
    if (!this.#acceptingWork) throw new Error("Ingestion is shutting down");
    await this.#refreshRoots("all", true);
    if (this.#currentRunId) {
      for (const status of this.#rootStatus.values()) {
        if (!status.available) continue;
        for (const path of status.files) this.#enqueue(status.root, path, this.#currentRunId);
      }
      const current = await this.#repository.runs.find(this.#currentRunId);
      return {
        runId: this.#currentRunId,
        state: current?.state === "queued" ? "queued" : "running",
        coalesced: true,
      };
    }
    const runId = await this.#scheduleRun("rescan");
    return { runId, state: "queued", coalesced: false };
  }

  public async status(): Promise<IngestionStatusSnapshot> {
    const [currentRun, lastCompletedRun, checkpoints] = await Promise.all([
      this.#currentRunId ? this.#repository.runs.find(this.#currentRunId) : undefined,
      this.#repository.runs.latestCompleted(),
      this.#repository.checkpoints.list(),
    ]);
    return {
      roots: [...this.#rootStatus.values()],
      ...(currentRun ? { currentRun } : {}),
      ...(lastCompletedRun ? { lastCompletedRun } : {}),
      checkpoints: checkpoints.map((checkpoint) => ({
        source: basename(checkpoint.sourcePath),
        status: checkpoint.status,
        completeOffset: checkpoint.committedOffset.toString(),
        unknownRecords: checkpoint.unknownRecords,
        malformedRecords: checkpoint.malformedRecords,
        ...(checkpoint.lastError ? { lastError: checkpoint.lastError } : {}),
      })),
      acceptingWork: this.#acceptingWork,
    };
  }

  public async close(): Promise<void> {
    if (!this.#acceptingWork && this.#watchers.size === 0) return;
    this.#acceptingWork = false;
    if (this.#rediscoveryTimer) clearInterval(this.#rediscoveryTimer);
    this.#rediscoveryTimer = undefined;
    for (const timer of this.#debounceTimers.values()) clearTimeout(timer);
    this.#debounceTimers.clear();
    await Promise.all(
      [...this.#watchers.values()].map((watcher) => Promise.resolve(watcher.close())),
    );
    this.#watchers.clear();
    const pending = [this.#runPromise, this.#drainPromise].filter(
      (operation): operation is Promise<void> => operation !== undefined,
    );
    await Promise.all(pending);
  }

  async #refreshRoots(mode: "all" | "unavailable", initial: boolean): Promise<void> {
    for (const configuredRoot of this.#roots) {
      const previous = this.#rootStatus.get(configuredRoot);
      if (mode === "unavailable" && previous?.available !== false) continue;
      let discovered = await this.#discover(configuredRoot);
      this.#rootStatus.set(configuredRoot, discovered);
      if (!discovered.available || this.#watchers.has(configuredRoot)) continue;
      await this.#watch(configuredRoot, discovered.root);
      discovered = await this.#discover(configuredRoot);
      this.#rootStatus.set(configuredRoot, discovered);
      if (!discovered.available) {
        const watcher = this.#watchers.get(configuredRoot);
        this.#watchers.delete(configuredRoot);
        await watcher?.close();
        continue;
      }
      if (!initial && previous?.available === false) {
        if (this.#currentRunId) {
          for (const path of discovered.files)
            this.#enqueue(discovered.root, path, this.#currentRunId);
        } else {
          await this.#scheduleRun("rediscovery", configuredRoot);
        }
      }
    }
  }

  async #watch(configuredRoot: string, canonicalRoot: string): Promise<void> {
    const watcher = chokidar.watch(canonicalRoot, {
      ignoreInitial: true,
      persistent: true,
      usePolling: this.#watchUsePolling,
      interval: Math.min(this.#debounceMs, 100),
    });
    const enqueue = (path: string): void => {
      if (isSupportedCodexSource(path)) this.#debounce(configuredRoot, path);
    };
    watcher.on("add", enqueue);
    watcher.on("change", enqueue);
    watcher.on("error", (error) => {
      this.#watchers.delete(configuredRoot);
      void watcher.close();
      this.#rootStatus.set(configuredRoot, {
        root: configuredRoot,
        available: false,
        reason: "unreadable",
        files: [],
      });
      this.#logger.warn({ error: errorName(error), root: configuredRoot }, "Codex watcher failed");
    });
    await new Promise<void>((resolveReady) => watcher.once("ready", resolveReady));
    this.#watchers.set(configuredRoot, watcher);
  }

  #debounce(root: string, path: string): void {
    if (!this.#acceptingWork) return;
    const previous = this.#debounceTimers.get(path);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.#debounceTimers.delete(path);
      this.#enqueue(root, path);
    }, this.#debounceMs);
    this.#debounceTimers.set(path, timer);
  }

  async #scheduleRun(trigger: ImportTrigger, onlyRoot?: string): Promise<string> {
    if (this.#currentRunId) return this.#currentRunId;
    const runId = randomUUID();
    this.#currentRunId = runId;
    await this.#repository.runs.create(runId, trigger);
    this.#runPromise = (async () => {
      try {
        await this.#repository.runs.setState(runId, "running");
        let rootsDiscovered = 0;
        let filesDiscovered = 0;
        for (const [configuredRoot, status] of this.#rootStatus) {
          if (onlyRoot && configuredRoot !== onlyRoot) continue;
          if (!status.available) continue;
          rootsDiscovered += 1;
          filesDiscovered += status.files.length;
          for (const path of status.files) this.#enqueue(status.root, path, runId);
        }
        await this.#repository.runs.addProgress(runId, { rootsDiscovered, filesDiscovered });
        await this.#drain();
        await this.#repository.runs.setState(runId, "completed");
      } catch (error) {
        await this.#repository.runs.addProgress(runId, { errors: 1 });
        await this.#repository.runs.setState(
          runId,
          "failed",
          `${errorName(error)}: import run failed`,
        );
      } finally {
        this.#currentRunId = undefined;
        this.#runPromise = undefined;
      }
    })();
    return runId;
  }

  #enqueue(root: string, path: string, runId?: string): void {
    if (!this.#acceptingWork) return;
    this.#pending.set(path, { root, ...(runId ? { runId } : {}) });
    void this.#drain();
  }

  #drain(): Promise<void> {
    if (this.#drainPromise) return this.#drainPromise;
    const drain = (async () => {
      while (this.#pending.size > 0) {
        const next = this.#pending.entries().next().value as
          [string, { root: string; runId?: string }] | undefined;
        if (!next) break;
        const [path, work] = next;
        this.#pending.delete(path);
        try {
          await this.#importer.importSource(work.root, path, work.runId);
        } catch (error) {
          this.#logger.error(
            { error: errorName(error), source: basename(path) },
            "Codex source import failed",
          );
          if (work.runId) await this.#repository.runs.addProgress(work.runId, { errors: 1 });
        }
      }
    })();
    this.#drainPromise = drain;
    void drain.finally(() => {
      if (this.#drainPromise === drain) this.#drainPromise = undefined;
    });
    return drain;
  }
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "Error";
}
