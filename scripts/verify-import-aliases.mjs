import { readFile, readdir } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const applicationRoots = ["backend", "frontend"];
const violations = [];
const aliasCoverage = new Map(
  applicationRoots.map((application) => [application, { source: 0, tests: 0 }]),
);

async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), "utf8"));
}

for (const application of applicationRoots) {
  const tsconfig = await readJson(`${application}/tsconfig.json`);
  const mapping = tsconfig.compilerOptions?.paths?.["@/*"];
  if (JSON.stringify(mapping) !== JSON.stringify(["./src/*"])) {
    violations.push(`${application}/tsconfig.json must map @/* to ./src/*`);
  }
}

const tsoa = await readJson("backend/tsoa.json");
if (JSON.stringify(tsoa.compilerOptions?.paths?.["@/*"]) !== JSON.stringify(["src/*"])) {
  violations.push("backend/tsoa.json must map @/* to backend src/*");
}

const viteConfig = await readFile(resolve(root, "frontend/vite.config.ts"), "utf8");
if (!viteConfig.includes('alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }')) {
  violations.push("frontend/vite.config.ts must map @ to the local frontend src directory");
}

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "generated") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (/\.(?:ts|tsx)$/u.test(entry.name)) files.push(path);
  }
  return files;
}

for (const application of applicationRoots) {
  for (const area of ["src", "__tests__"]) {
    const directory = resolve(root, application, area);
    for (const file of await sourceFiles(directory)) {
      const content = await readFile(file, "utf8");
      const specifiers = [
        ...content.matchAll(/(?:from\s+|import\s*\(|import\s+)["']([^"']+)["']/gu),
      ].map((match) => match[1]);

      for (const specifier of specifiers) {
        if (specifier?.startsWith("../")) {
          violations.push(
            `${relative(root, file)} uses forbidden parent-relative import ${specifier}`,
          );
        }
        if (specifier?.startsWith("./") && specifier.slice(2).includes("/")) {
          violations.push(
            `${relative(root, file)} must use @/ for cross-directory import ${specifier}`,
          );
        }
        if (specifier?.startsWith("@/")) {
          aliasCoverage.get(application)[area === "src" ? "source" : "tests"] += 1;
        }
      }
    }
  }
}

for (const [application, coverage] of aliasCoverage) {
  if (coverage.source === 0 || coverage.tests === 0) {
    violations.push(
      `${application} must exercise @/ imports in both authored source and Bun tests`,
    );
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Import alias verification failed:\n${violations.map((item) => `- ${item}`).join("\n")}\n`,
  );
  process.exit(1);
}

process.stdout.write("Application-local aliases and authored import boundaries are valid.\n");
