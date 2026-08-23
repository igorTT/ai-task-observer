import { cp, mkdir, rm } from "node:fs/promises";

const destination = new URL("../dist/database/migrations/", import.meta.url);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(new URL("../src/database/migrations/", import.meta.url), destination, { recursive: true });
