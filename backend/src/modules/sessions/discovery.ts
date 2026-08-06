import { opendir, realpath, stat } from "node:fs/promises";
import { join } from "node:path";

export interface RootDiscoveryStatus {
  readonly root: string;
  readonly available: boolean;
  readonly reason?: "missing" | "unreadable" | "not_a_directory";
  readonly files: readonly string[];
}

export function isSupportedCodexSource(path: string): boolean {
  return /(?:^|[/\\])(?:rollout-[^/\\]+|[^/\\]+)\.jsonl$/u.test(path);
}

export async function discoverRoot(root: string): Promise<RootDiscoveryStatus> {
  let rootStat;
  try {
    rootStat = await stat(root);
  } catch (error) {
    const reason = isPermissionError(error) ? "unreadable" : "missing";
    return { root, available: false, reason, files: [] };
  }
  if (!rootStat.isDirectory())
    return { root, available: false, reason: "not_a_directory", files: [] };

  try {
    const canonicalRoot = await realpath(root);
    const files = await walk(canonicalRoot);
    files.sort((left, right) => left.localeCompare(right));
    return { root: canonicalRoot, available: true, files };
  } catch {
    return { root, available: false, reason: "unreadable", files: [] };
  }
}

export async function discoverRoots(roots: readonly string[]): Promise<RootDiscoveryStatus[]> {
  return Promise.all(roots.map(discoverRoot));
}

async function walk(directory: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await opendir(directory);
  for await (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path)));
    else if (entry.isFile() && isSupportedCodexSource(path)) files.push(await realpath(path));
  }
  return files;
}

function isPermissionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EACCES" || error.code === "EPERM")
  );
}
