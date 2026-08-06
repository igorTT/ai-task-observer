import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const generatedRoots = [
  "backend/generated",
  "backend/src/api/generated",
  "frontend/src/api/generated",
];

async function snapshot() {
  const hashes = new Map();
  for (const relativeRoot of generatedRoots) {
    const directory = resolve(root, relativeRoot);
    for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || entry.name.startsWith(".")) continue;
      const path = resolve(entry.parentPath, entry.name);
      const content = await readFile(path);
      hashes.set(path.slice(root.length + 1), createHash("sha256").update(content).digest("hex"));
    }
  }
  return hashes;
}

const before = await snapshot();
const generation = spawnSync("npm", ["run", "generate:api"], { cwd: root, stdio: "inherit" });
if (generation.status !== 0) process.exit(generation.status ?? 1);
const after = await snapshot();

const paths = new Set([...before.keys(), ...after.keys()]);
const changed = [...paths].filter((path) => before.get(path) !== after.get(path));
if (changed.length > 0) {
  process.stderr.write(
    `Generated API output is stale:\n${changed.map((path) => `- ${path}`).join("\n")}\n`,
  );
  process.exit(1);
}

const tsoaConfig = JSON.parse(await readFile(resolve(root, "backend/tsoa.json"), "utf8"));
const frontendConfig = await readFile(resolve(root, "frontend/openapi-config.mjs"), "utf8");
if (
  tsoaConfig.routes?.routesDir !== "src/api/generated" ||
  tsoaConfig.spec?.outputDirectory !== "generated" ||
  !frontendConfig.includes('outputFile: "./src/api/generated/api.ts"')
) {
  throw new Error("Generated outputs must remain inside their dedicated generated directories");
}

process.stdout.write("Generated API output is current and boundaries are valid.\n");
