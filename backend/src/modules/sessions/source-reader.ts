import { createHash } from "node:crypto";
import { open, stat } from "node:fs/promises";

import type { ImportCheckpoint, SourceIdentity } from "@/modules/sessions/domain.js";

export interface CompleteRecordRange {
  readonly records: readonly string[];
  readonly startOffset: bigint;
  readonly completeOffset: bigint;
  readonly reachedEnd: boolean;
}

export type SourceCompatibility = "new" | "append" | "unchanged" | "rebuild";

export async function inspectSource(
  path: string,
): Promise<SourceIdentity & { readonly key: string }> {
  const sourceStat = await stat(path, { bigint: true });
  const file = await open(path, "r");
  try {
    const length = Number(sourceStat.size < 256n ? sourceStat.size : 256n);
    const prefix = Buffer.alloc(length);
    if (length > 0) await file.read(prefix, 0, length, 0);
    return {
      device: sourceStat.dev,
      inode: sourceStat.ino,
      size: sourceStat.size,
      modifiedAtMs: sourceStat.mtimeMs,
      key: `${sourceStat.dev}:${sourceStat.ino}:${createHash("sha256").update(prefix).digest("hex")}`,
    };
  } finally {
    await file.close();
  }
}

export function sourceCompatibility(
  checkpoint: ImportCheckpoint | undefined,
  source: SourceIdentity & { readonly key: string },
  parserVersion: number,
): SourceCompatibility {
  if (!checkpoint) return "new";
  const [checkpointDevice, checkpointInode, checkpointPrefix] =
    checkpoint.sourceIdentity.split(":");
  const [sourceDevice, sourceInode, sourcePrefix] = source.key.split(":");
  const sameFile = checkpointDevice === sourceDevice && checkpointInode === sourceInode;
  const prefixMustMatch = checkpoint.observedSize >= 256n || source.size <= checkpoint.observedSize;
  if (
    !sameFile ||
    (prefixMustMatch && checkpointPrefix !== sourcePrefix) ||
    source.size < checkpoint.committedOffset ||
    checkpoint.parserVersion < parserVersion
  ) {
    return "rebuild";
  }
  if (source.size === checkpoint.committedOffset) return "unchanged";
  return "append";
}

export async function readCompleteRecords(
  path: string,
  startOffset: bigint,
  readChunkBytes: number,
): Promise<CompleteRecordRange> {
  const file = await open(path, "r");
  const chunks: Buffer[] = [];
  let position = startOffset;
  let reachedEnd: boolean;
  let lastNewline = -1;
  let accumulated = 0;
  try {
    do {
      const buffer = Buffer.alloc(readChunkBytes);
      const { bytesRead } = await file.read(buffer, 0, readChunkBytes, position);
      if (bytesRead === 0) {
        reachedEnd = true;
        break;
      }
      const slice = buffer.subarray(0, bytesRead);
      chunks.push(slice);
      const newlineInChunk = slice.lastIndexOf(0x0a);
      if (newlineInChunk >= 0) lastNewline = accumulated + newlineInChunk;
      accumulated += bytesRead;
      position += BigInt(bytesRead);
      reachedEnd = bytesRead < readChunkBytes;
    } while (lastNewline < 0 && !reachedEnd);
  } finally {
    await file.close();
  }

  if (lastNewline < 0) {
    return { records: [], startOffset, completeOffset: startOffset, reachedEnd };
  }
  const complete = Buffer.concat(chunks).subarray(0, lastNewline + 1);
  const text = complete.toString("utf8");
  const records = text
    .split("\n")
    .slice(0, -1)
    .map((record) => (record.endsWith("\r") ? record.slice(0, -1) : record));
  return {
    records,
    startOffset,
    completeOffset: startOffset + BigInt(complete.byteLength),
    reachedEnd,
  };
}
