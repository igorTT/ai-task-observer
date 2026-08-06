import type { Logger } from "pino";
import { basename } from "node:path";

import type { CodexIngestionRepository } from "@/database/repositories/codex-ingestion-repository.js";
import { sanitizedError } from "@/modules/sessions/diagnostics.js";
import { CODEX_PARSER_VERSION, parseCodexRecords } from "@/modules/sessions/parser.js";
import {
  inspectSource,
  readCompleteRecords,
  sourceCompatibility,
} from "@/modules/sessions/source-reader.js";
import type {
  ParserDiagnostics,
  SessionMutation,
  SourceChunkMutation,
} from "@/modules/sessions/domain.js";

export interface ImportSourceResult {
  readonly sourcePath: string;
  readonly state: "unchanged" | "imported";
  readonly rebuilt: boolean;
  readonly sessions: readonly string[];
  readonly completeOffset: bigint;
}

export interface CodexSourceImporterOptions {
  readonly repository: CodexIngestionRepository;
  readonly readChunkBytes: number;
  readonly logger: Logger;
  readonly parserVersion?: number;
}

export class CodexSourceImporter {
  readonly #repository: CodexIngestionRepository;
  readonly #readChunkBytes: number;
  readonly #logger: Logger;
  readonly #parserVersion: number;

  public constructor(options: CodexSourceImporterOptions) {
    this.#repository = options.repository;
    this.#readChunkBytes = options.readChunkBytes;
    this.#logger = options.logger;
    this.#parserVersion = options.parserVersion ?? CODEX_PARSER_VERSION;
  }

  public async importSource(
    sourceRoot: string,
    sourcePath: string,
    runId?: string,
  ): Promise<ImportSourceResult> {
    const checkpoint = await this.#repository.checkpoints.find(sourcePath);
    const source = await inspectSource(sourcePath);
    const compatibility = sourceCompatibility(checkpoint, source, this.#parserVersion);
    if (compatibility === "unchanged") {
      return {
        sourcePath,
        state: "unchanged",
        rebuilt: false,
        sessions: [],
        completeOffset: checkpoint!.committedOffset,
      };
    }

    const rebuild = compatibility === "new" || compatibility === "rebuild";
    try {
      return rebuild
        ? await this.#rebuild(sourceRoot, sourcePath, source, runId)
        : await this.#append(sourceRoot, sourcePath, source, checkpoint!, runId);
    } catch (error) {
      const summary = sanitizedError(error);
      if (compatibility === "rebuild")
        await this.#repository.markRebuildFailed(sourcePath, summary);
      this.#logger.error({ source: basename(sourcePath), category: "source_failure" }, summary);
      throw error;
    }
  }

  async #rebuild(
    sourceRoot: string,
    sourcePath: string,
    source: Awaited<ReturnType<typeof inspectSource>>,
    runId?: string,
  ): Promise<ImportSourceResult> {
    let offset = 0n;
    let sessionId: string | undefined;
    let recordNumber = 0;
    const mutations: SessionMutation[] = [];
    const diagnostics = emptyDiagnostics();

    while (offset < source.size) {
      const range = await readCompleteRecords(sourcePath, offset, this.#readChunkBytes);
      if (range.completeOffset === offset) break;
      const parsed = parseCodexRecords(range.records, {
        sourceRoot,
        sourcePath,
        ...(sessionId ? { sessionId } : {}),
        startRecordNumber: recordNumber,
        parserVersion: this.#parserVersion,
      });
      sessionId = parsed.sessionId ?? sessionId;
      mutations.push(...parsed.mutations);
      mergeDiagnostics(diagnostics, parsed.diagnostics);
      recordNumber += range.records.length;
      offset = range.completeOffset;
    }
    if (!sessionId) throw new Error("Codex source did not provide a stable session identity");
    ensureMetadataMutation(mutations, sessionId, sourceRoot, sourcePath);

    const chunk = sourceChunk({
      sourceRoot,
      sourcePath,
      source,
      offset,
      mutations,
      diagnostics,
      rebuild: true,
      ...(runId ? { runId } : {}),
      parserVersion: this.#parserVersion,
    });
    const sessions = await this.#repository.applySourceChunk(chunk);
    return {
      sourcePath,
      state: "imported",
      rebuilt: true,
      sessions: [...sessions],
      completeOffset: offset,
    };
  }

  async #append(
    sourceRoot: string,
    sourcePath: string,
    source: Awaited<ReturnType<typeof inspectSource>>,
    checkpoint: NonNullable<Awaited<ReturnType<CodexIngestionRepository["checkpoints"]["find"]>>>,
    runId?: string,
  ): Promise<ImportSourceResult> {
    let offset = checkpoint.committedOffset;
    const existing = await this.#repository.sessions.findBySourcePath(sourcePath);
    let sessionId = existing?.sessionId;
    const sessions = new Set<string>();
    let unknownRecords = checkpoint.unknownRecords;
    let malformedRecords = checkpoint.malformedRecords;

    while (offset < source.size) {
      const range = await readCompleteRecords(sourcePath, offset, this.#readChunkBytes);
      if (range.completeOffset === offset) break;
      const parsed = parseCodexRecords(range.records, {
        sourceRoot,
        sourcePath,
        ...(sessionId ? { sessionId } : {}),
        parserVersion: this.#parserVersion,
      });
      sessionId = parsed.sessionId ?? sessionId;
      if (!sessionId) throw new Error("Appended range has no known session identity");
      unknownRecords += parsed.diagnostics.unknownRecords;
      malformedRecords += parsed.diagnostics.malformedRecords;
      const diagnostics = {
        unknownRecords,
        malformedRecords,
        warnings: parsed.diagnostics.warnings,
      };
      const touched = await this.#repository.applySourceChunk(
        sourceChunk({
          sourceRoot,
          sourcePath,
          source,
          offset: range.completeOffset,
          mutations: parsed.mutations,
          diagnostics,
          rebuild: false,
          ...(runId ? { runId } : {}),
          parserVersion: this.#parserVersion,
        }),
      );
      touched.forEach((id) => sessions.add(id));
      offset = range.completeOffset;
    }
    return {
      sourcePath,
      state: "imported",
      rebuilt: false,
      sessions: [...sessions],
      completeOffset: offset,
    };
  }
}

function emptyDiagnostics(): {
  unknownRecords: number;
  malformedRecords: number;
  warnings: ParserDiagnostics["warnings"][number][];
} {
  return { unknownRecords: 0, malformedRecords: 0, warnings: [] };
}

function mergeDiagnostics(
  target: ReturnType<typeof emptyDiagnostics>,
  addition: ParserDiagnostics,
): void {
  target.unknownRecords += addition.unknownRecords;
  target.malformedRecords += addition.malformedRecords;
  target.warnings.push(...addition.warnings);
}

function ensureMetadataMutation(
  mutations: SessionMutation[],
  sessionId: string,
  sourceRoot: string,
  sourcePath: string,
): void {
  if (mutations.some((mutation) => mutation.metadata)) return;
  mutations.unshift({ metadata: { sessionId, sourceRoot, sourcePath } });
}

function sourceChunk(input: {
  sourceRoot: string;
  sourcePath: string;
  source: Awaited<ReturnType<typeof inspectSource>>;
  offset: bigint;
  mutations: readonly SessionMutation[];
  diagnostics: ParserDiagnostics;
  rebuild: boolean;
  runId?: string;
  parserVersion: number;
}): SourceChunkMutation {
  return {
    sourceRoot: input.sourceRoot,
    sourcePath: input.sourcePath,
    sourceIdentity: input.source.key,
    committedOffset: input.offset,
    observedSize: input.source.size,
    observedModifiedAtMs: input.source.modifiedAtMs,
    parserVersion: input.parserVersion,
    mutations: input.mutations,
    diagnostics: input.diagnostics,
    rebuild: input.rebuild,
    ...(input.runId ? { runId: input.runId } : {}),
  };
}
