import { expect, test, type Page, type Route } from "@playwright/test";

const metrics = {
  sessionCount: "1",
  developerTurns: "2",
  inputTokens: "9007199254740993",
  cachedInputTokens: "10",
  outputTokens: "20",
  totalTokens: "9007199254741013",
  estimatedCostUsd: "1.25",
  tokenComplete: true,
  costComplete: true,
  anomalyCodes: [],
  pricingGapCodes: [],
};
const issue = {
  id: "issue-1",
  identifier: "ENG-1",
  title: "Build dashboard",
  url: "https://linear.app/example/issue/ENG-1",
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installApi(page: Page) {
  await page.route(/^https?:\/\/[^/]+\/api\//u, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/issues/usage")
      return json(route, { items: [{ issue, metrics }], total: "1", limit: 20, offset: 0 });
    if (path === "/api/issues/issue-1/usage")
      return json(route, {
        issue,
        metrics,
        latestCompletedCostGeneration: null,
        sessions: [],
        models: [{ model: "unknown", observedModels: [], metrics }],
        daily: [{ date: null, metrics }],
      });
    if (path === "/api/sessions" && route.request().method() === "GET")
      return json(route, {
        items: [
          {
            sessionId: "session-1",
            currentTitle: "ENG-1: apply",
            developerTurns: "2",
            inputTokens: "100",
            cachedInputTokens: "10",
            uncachedInputTokens: "90",
            outputTokens: "20",
            totalTokens: "120",
            usageObserved: true,
            tokenCompleteness: {
              input: true,
              cachedInput: true,
              uncachedInput: true,
              output: true,
              total: true,
            },
            usageAnomalies: [],
            importState: "complete",
            attribution: {
              status: "unlinked",
              candidateIdentifier: "ENG-1",
              phase: "apply",
              relinkRequired: false,
              synchronizationState: "unlinked",
            },
          },
        ],
        total: 1,
        limit: 20,
        offset: 0,
      });
    if (path === "/api/sessions/session-1/relink")
      return json(route, {
        attribution: {
          status: "linked",
          candidateIdentifier: "ENG-1",
          issue: {
            ...issue,
            team: { name: "Engineering", key: "ENG", id: "team" },
            state: { name: "Todo", id: "state" },
            updatedAt: "2026-01-01",
            synchronizedAt: "2026-01-01",
          },
          relinkRequired: false,
          synchronizationState: "synchronized",
        },
      });
    if (path === "/api/imports/status")
      return json(route, {
        roots: [{ root: "/sessions", available: true, discoveredFiles: 1 }],
        checkpoints: [],
        acceptingWork: true,
      });
    if (path === "/api/linear/status")
      return json(route, {
        configured: true,
        state: "idle",
        acceptingWork: true,
        counts: { unlinked: 1, unconfigured: 0, pending: 0, linked: 0, not_found: 0, error: 0 },
      });
    if (path === "/api/costs/status")
      return json(route, {
        estimateKind: "configured_api_equivalent_usd",
        currentFactRevision: "1",
        coverage: "current",
        config: {
          schemaVersion: 1,
          catalogVersion: "1",
          contentHash: "x",
          currency: "USD",
          tokenUnit: "1m",
        },
        calculatorVersion: "1",
        acceptingWork: true,
      });
    return json(route, { state: "queued", runId: "run-1", coalesced: false }, 202);
  });
}

async function expectNoPageOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

test.beforeEach(async ({ page }) => installApi(page));

test("issue overview navigates directly to detail at the support boundary", async ({
  page,
}, testInfo) => {
  await page.goto("/issues?page=malformed");
  await expect(page).toHaveURL(/\/issues$/u);
  await expect(page.getByRole("link", { name: "ENG-1" })).toBeVisible();
  await expect(page.getByText("9,007,199,254,740,993")).toBeVisible();
  await expectNoPageOverflow(page);
  await page.getByRole("link", { name: "ENG-1" }).click();
  await expect(page).toHaveURL(/\/issues\/issue-1$/u);
  await expect(page.getByText("Unknown model")).toBeVisible();
  await expectNoPageOverflow(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/issues$/u);
  await page.getByRole("link", { name: "ENG-1" }).click();
  await expectNoPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath("issue-detail.png"), fullPage: true });
});

test("active status polling stops after a terminal response", async ({ page }) => {
  let statusRequests = 0;
  await page.route(/^https?:\/\/[^/]+\/api\/imports\/status$/u, async (route) => {
    statusRequests += 1;
    return json(route, {
      roots: [{ root: "/sessions", available: true, discoveredFiles: 1 }],
      checkpoints: [],
      acceptingWork: true,
      ...(statusRequests === 1
        ? {
            currentRun: {
              runId: "run-active",
              trigger: "manual",
              state: "running",
              rootsDiscovered: 1,
              filesDiscovered: 1,
              filesImported: 0,
              sessionsImported: 0,
              warnings: 0,
              errors: 0,
            },
          }
        : {}),
    });
  });
  await page.goto("/issues");
  await expect.poll(() => statusRequests, { timeout: 4000 }).toBe(2);
  await page.waitForTimeout(1800);
  expect(statusRequests).toBe(2);
});

test("unlinked session requires confirmation and relinks once", async ({ page }) => {
  let relinks = 0;
  let relinkBody: unknown;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/relink")) {
      relinks += 1;
      relinkBody = request.postDataJSON();
    }
  });
  await page.goto("/sessions");
  await expectNoPageOverflow(page);
  await page.getByRole("button", { name: "Link candidate" }).click();
  await expect(page.getByRole("dialog", { name: "Link this session?" })).toBeVisible();
  await expectNoPageOverflow(page);
  await page.getByRole("button", { name: "Confirm link" }).click();
  await expect.poll(() => relinks).toBe(1);
  expect(relinkBody).toEqual({ issueIdentifier: "ENG-1" });
});

test("operational failure is retained and can be retried", async ({ page }) => {
  let attempts = 0;
  await page.route(/^https?:\/\/[^/]+\/api\/imports\/rescan$/u, async (route) => {
    attempts += 1;
    return attempts === 1
      ? json(route, { error: { code: "UNKNOWN", message: "private" } }, 503)
      : json(route, { state: "queued", runId: "run-2", coalesced: false }, 202);
  });
  await page.goto("/issues");
  await expectNoPageOverflow(page);
  await page.getByRole("button", { name: /Operations/u }).click();
  await expectNoPageOverflow(page);
  await page.getByRole("button", { name: "Rescan sessions" }).click();
  await expect(
    page.getByText("The request could not be completed. Please try again."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry rescan sessions" }).click();
  await expect.poll(() => attempts).toBe(2);
});
