import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

async function reservePort() {
  const server = createServer();
  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListening);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unable to reserve a loopback port");
  await new Promise((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  return address.port;
}

async function emittedJavaScript(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await emittedJavaScript(path)));
    else if (entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

const backendDist = resolve(root, "backend/dist");
for (const file of await emittedJavaScript(backendDist)) {
  if ((await readFile(file, "utf8")).includes('"@/')) {
    throw new Error(`Compiled backend contains an unresolved alias: ${file}`);
  }
}

const port = await reservePort();
const directory = await mkdtemp(join(tmpdir(), "ai-task-observer-smoke-"));
const output = [];
const child = spawn(process.execPath, ["backend/dist/server.js"], {
  cwd: root,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    DATABASE_PATH: join(directory, "smoke.duckdb"),
    LOG_LEVEL: "info",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stdout.on("data", (chunk) => output.push(String(chunk)));
child.stderr.on("data", (chunk) => output.push(String(chunk)));

try {
  const deadline = Date.now() + 10_000;
  let response;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Backend exited early:\n${output.join("")}`);
    try {
      response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) break;
    } catch {
      // Startup is still in progress.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }

  if (!response?.ok) throw new Error(`Backend health check timed out:\n${output.join("")}`);
  const body = await response.json();
  if (body.status !== "healthy")
    throw new Error(`Unexpected health response: ${JSON.stringify(body)}`);
  process.stdout.write(
    "Compiled Node.js backend resolved aliases and returned a healthy response.\n",
  );
} finally {
  if (child.exitCode === null) {
    child.kill("SIGTERM");
    await Promise.race([
      once(child, "exit"),
      new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
  await rm(directory, { recursive: true, force: true });
}
