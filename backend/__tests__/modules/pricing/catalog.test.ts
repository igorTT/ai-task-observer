import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "bun:test";

import {
  loadPricingCatalog,
  PricingCatalogError,
  resolvePrice,
} from "@/modules/pricing/catalog.js";

const fixture = (name: string): string =>
  fileURLToPath(new URL(`../../fixtures/pricing/${name}`, import.meta.url));

describe("pricing catalog", () => {
  test("loads exact bytes, canonical identities, aliases, adjacent periods, and gaps", async () => {
    const path = fixture("valid-catalog.json");
    const catalog = await loadPricingCatalog(path);
    expect(catalog.catalogVersion).toBe("fixture-v1");
    expect(catalog.tokenUnit).toBe(1_000_000n);
    expect(catalog.contentHash).toBe(
      createHash("sha256")
        .update(await readFile(path))
        .digest("hex"),
    );
    expect(catalog.modelIndex.get("model-a")?.id).toBe("model-a");
    expect(catalog.modelIndex.get("model-a-alias")?.id).toBe("model-a");
    expect(
      resolvePrice(catalog, "model-a", new Date("2026-02-01T00:00:00Z"))?.period,
    ).toMatchObject({ uncachedInputUsdPerUnit: "3.00" });
    expect(resolvePrice(catalog, "model-a", new Date("2026-03-15T00:00:00Z"))).toBeNull();
  });

  test("uses only exact case-sensitive identities and exact half-open boundaries", async () => {
    const catalog = await loadPricingCatalog(fixture("valid-catalog.json"));
    expect(resolvePrice(catalog, "MODEL-A", new Date("2026-01-01T00:00:00Z"))).toBeNull();
    expect(resolvePrice(catalog, "model", new Date("2026-01-01T00:00:00Z"))).toBeNull();
    expect(resolvePrice(catalog, "model-a", null)).toBeNull();
    expect(resolvePrice(catalog, "model-a", new Date("2025-12-31T23:59:59.999Z"))).toBeNull();
    expect(resolvePrice(catalog, "model-a", new Date("2026-01-31T23:59:59.999Z"))).not.toBeNull();
  });

  for (const [name, invariant] of [
    ["invalid-overlap.json", "overlap"],
    ["invalid-duplicate-alias.json", "assigned"],
    ["invalid-schema-version.json", "schemaVersion"],
    ["invalid-utc-boundary.json", "UTC"],
    ["invalid-negative-rate.json", "rate"],
    ["invalid-non-decimal-rate.json", "rate"],
    ["invalid-empty-identity.json", "non-empty"],
    ["malformed.txt", "valid JSON"],
  ] as const) {
    test(`rejects ${name} with a sanitized invariant`, async () => {
      const path = fixture(name);
      try {
        await loadPricingCatalog(path);
        throw new Error("expected catalog to be rejected");
      } catch (error) {
        expect(error).toBeInstanceOf(PricingCatalogError);
        expect((error as Error).message).toContain(path);
        expect((error as Error).message).toContain(invariant);
        expect((error as Error).message).not.toContain("uncachedInputUsdPerUnit");
      }
    });
  }

  test("rejects missing files without exposing file contents", () => {
    return expect(loadPricingCatalog(fixture("missing.json"))).rejects.toThrow(
      /missing or unreadable/u,
    );
  });
});
