import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { expect, test } from "bun:test";

const databaseSourceRoots = [
  join(import.meta.dir, "../../src/database/models"),
  join(import.meta.dir, "../../src/database/repositories"),
];
const directRowDatePattern = /new\s+Date\s*\(\s*row(?:\.|\[)/u;

test("database mappings do not coerce row timestamps through Date strings", async () => {
  const files = (await Promise.all(databaseSourceRoots.map(listTypeScriptFiles))).flat();
  const violations: string[] = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (directRowDatePattern.test(source)) violations.push(file);
  }
  expect(violations).toEqual([]);
});

async function listTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listTypeScriptFiles(path)));
    else if (entry.isFile() && path.endsWith(".ts")) files.push(path);
  }
  return files;
}
