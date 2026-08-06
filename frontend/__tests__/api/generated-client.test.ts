import { describe, expect, mock, test } from "bun:test";

import { generatedApi, type GetHealthApiResponse } from "@/api/generated/api";
import { createAppStore } from "@/app/store";

describe("generated health client", () => {
  test("matches the backend health route and response contract", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl = "";
    globalThis.fetch = mock((input: RequestInfo | URL) => {
      requestedUrl = input instanceof Request ? input.url : String(input);
      const response: GetHealthApiResponse = { status: "healthy" };
      return Promise.resolve(
        new Response(JSON.stringify(response), {
          headers: { "content-type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch;

    try {
      const result = await createAppStore()
        .dispatch(generatedApi.endpoints.getHealth.initiate())
        .unwrap();
      expect(requestedUrl.endsWith("/api/health")).toBe(true);
      expect(result).toEqual({ status: "healthy" });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
