import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

import {
  classifyInspection,
  exitStatus,
  parseArgs,
  parseTitle,
  resolveObserverUrl,
  runWorkflow,
} from "../../scripts/link-current-session.mjs";

const sessionId = "session/with spaces";

function detail(
  title = "ENG-215: apply",
  issueIdentifier?: string,
  status: "unlinked" | "linked" = issueIdentifier ? "linked" : "unlinked",
) {
  return {
    sessionId,
    currentTitle: title,
    importState: "complete",
    attribution: {
      status,
      relinkRequired: Boolean(issueIdentifier && issueIdentifier !== "ENG-215"),
      synchronizationState: status === "linked" ? "synchronized" : "unlinked",
      ...(issueIdentifier ? { issue: { identifier: issueIdentifier, title: "Issue title" } } : {}),
    },
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function fetchSequence(sequence: Response[]) {
  const requests: string[] = [];
  return {
    requests,
    fetch: async (url: string) => {
      requests.push(url);
      const next = sequence.shift();
      if (!next) throw new Error("unexpected request");
      return next;
    },
  };
}

describe("link-current-session arguments and URL safety", () => {
  test("parses inspect and link arguments", () => {
    expect(parseArgs(["inspect", "--session-id", "abc"])).toEqual({
      command: "inspect",
      "session-id": "abc",
    });
    expect(parseArgs(["link", "--session-id", "abc", "--expected-candidate", "ENG-215"])).toEqual({
      command: "link",
      "session-id": "abc",
      "expected-candidate": "ENG-215",
    });
  });

  test("rejects unknown, incomplete, credential, and malformed arguments", () => {
    expect(() => parseArgs(["inspect"])).toThrow();
    expect(() => parseArgs(["inspect", "--session-id", "abc", "--linear-api-key", "secret"])).toThrow();
    expect(() => parseArgs(["link", "--session-id", "abc", "--expected-candidate", "not-an-issue"])).toThrow();
    expect(() => parseArgs(["inspect", "--session-id", "abc", "--confirm-replace-from", "ENG-1"])).toThrow();
  });

  test("uses command, environment, then loopback URL precedence", () => {
    expect(resolveObserverUrl("https://observer.example/", { AI_TASK_OBSERVER_URL: "http://wrong" })).toBe(
      "https://observer.example",
    );
    expect(resolveObserverUrl(undefined, { AI_TASK_OBSERVER_URL: "http://observer.example:3010" })).toBe(
      "http://observer.example:3010",
    );
    expect(resolveObserverUrl(undefined, {})).toBe("http://127.0.0.1:3000");
  });

  test("rejects credentials, unsupported protocols, queries, and fragments", () => {
    for (const value of [
      "ftp://observer.example",
      "http://user:secret@observer.example",
      "http://observer.example/api?token=secret",
      "http://observer.example/#fragment",
    ]) {
      expect(() => resolveObserverUrl(value, {})).toThrow();
    }
  });
});

describe("inspection and readiness", () => {
  test("classifies a valid unlinked title and preserves phase", () => {
    const result = classifyInspection(detail());
    expect(result).toMatchObject({
      version: 1,
      outcome: "ready_to_link",
      sessionId,
      title: "ENG-215: apply",
      candidate: "ENG-215",
      phase: "apply",
    });
  });

  test("classifies already linked, replacement, and invalid titles", () => {
    expect(classifyInspection(detail("ENG-215: apply", "ENG-215"))).toMatchObject({ outcome: "already_linked" });
    expect(classifyInspection(detail("ENG-215: apply", "ENG-99"))).toMatchObject({
      outcome: "confirmation_required",
      committedIssue: { identifier: "ENG-99" },
    });
    expect(classifyInspection(detail("work on ENG-215"))).toMatchObject({ outcome: "invalid_title" });
  });

  test("returns a protocol error for malformed session details", async () => {
    const fake = fetchSequence([response({ sessionId, attribution: {} })]);
    const result = await runWorkflow(
      { command: "inspect", "session-id": sessionId },
      { fetchImplementation: fake.fetch },
    );
    expect(result).toMatchObject({ outcome: "observer_protocol_error", sessionId });
  });

  test("polls a delayed watcher before rescanning", async () => {
    const fake = fetchSequence([
      response({ error: { code: "not_found", message: "not found" } }, 404),
      response(detail()),
    ]);
    const result = await runWorkflow(
      { command: "inspect", "session-id": sessionId },
      { fetchImplementation: fake.fetch, timing: { initialWaitMs: 0, afterRescanWaitMs: 0 } },
    );
    expect(result.outcome).toBe("ready_to_link");
    expect(fake.requests).toHaveLength(2);
  });

  test("rescans once after 404 exhaustion and polls the observer again", async () => {
    const fake = fetchSequence([
      response({ error: { code: "not_found", message: "not found" } }, 404),
      response({ error: { code: "not_found", message: "not found" } }, 404),
      response({ runId: "run", state: "queued", coalesced: true }, 202),
      response(detail()),
    ]);
    const result = await runWorkflow(
      { command: "inspect", "session-id": sessionId },
      { fetchImplementation: fake.fetch, timing: { initialWaitMs: 0, afterRescanWaitMs: 0 } },
    );
    expect(result.outcome).toBe("ready_to_link");
    expect(fake.requests).toHaveLength(4);
    expect(fake.requests[2]).toEndWith("/api/imports/rescan");
  });

  test("stops after one rescan when the session remains unknown", async () => {
    const notFound = () => response({ error: { code: "not_found", message: "not found" } }, 404);
    const fake = fetchSequence([
      notFound(),
      notFound(),
      response({ runId: "run", state: "running", coalesced: false }, 202),
      notFound(),
    ]);
    const result = await runWorkflow(
      { command: "inspect", "session-id": sessionId },
      { fetchImplementation: fake.fetch, timing: { initialWaitMs: 0, afterRescanWaitMs: 0 } },
    );
    expect(result.outcome).toBe("session_not_imported");
    expect(fake.requests.filter((url) => url.endsWith("/api/imports/rescan"))).toHaveLength(1);
  });

  test("does not rescan on observer transport or non-404 API failures", async () => {
    const transport = await runWorkflow(
      { command: "inspect", "session-id": sessionId },
      {
        fetchImplementation: async () => {
          throw new Error("secret transport detail");
        },
      },
    );
    expect(transport.outcome).toBe("observer_unavailable");
    const fake = fetchSequence([response({ error: { code: "internal_error", message: "private" } }, 500)]);
    const rejected = await runWorkflow(
      { command: "inspect", "session-id": sessionId },
      { fetchImplementation: fake.fetch, timing: { initialWaitMs: 0, afterRescanWaitMs: 0 } },
    );
    expect(rejected.outcome).toBe("observer_rejected");
    expect(fake.requests).toHaveLength(1);
  });

  test("maps redirects and request aborts without exposing transport details", async () => {
    const redirect = fetchSequence([new Response("", { status: 302, headers: { location: "https://elsewhere" } })]);
    expect(
      (
        await runWorkflow(
          { command: "inspect", "session-id": sessionId },
          { fetchImplementation: redirect.fetch },
        )
      ).outcome,
    ).toBe("observer_protocol_error");

    const timeout = await runWorkflow(
      { command: "inspect", "session-id": sessionId },
      {
        timing: { requestTimeoutMs: 1 },
        fetchImplementation: (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(new Error("private timeout detail")));
          }),
      },
    );
    expect(timeout.outcome).toBe("observer_unavailable");
    expect(JSON.stringify(timeout)).not.toContain("private");
  });
});

describe("linking and relinking", () => {
  test("links an unlinked candidate using an encoded session path", async () => {
    const fake = fetchSequence([
      response(detail()),
      response(detail()),
      response({ attribution: { status: "linked", issue: { identifier: "ENG-215", title: "Issue title" } } }),
    ]);
    const result = await runWorkflow(
      { command: "link", "session-id": sessionId, "expected-candidate": "ENG-215" },
      { fetchImplementation: fake.fetch },
    );
    expect(result).toMatchObject({ outcome: "linked", issue: { identifier: "ENG-215" } });
    expect(fake.requests[0]).toContain("session%2Fwith%20spaces");
    expect(fake.requests[2]).toEndWith("/relink");
  });

  test("requires matching confirmation for replacement and reports relink", async () => {
    const fake = fetchSequence([
      response(detail("ENG-215: apply", "ENG-99")),
      response(detail("ENG-215: apply", "ENG-99")),
      response({ attribution: { status: "linked", issue: { identifier: "ENG-215", title: "Issue title" } } }),
    ]);
    const result = await runWorkflow(
      {
        command: "link",
        "session-id": sessionId,
        "expected-candidate": "ENG-215",
        "confirm-replace-from": "ENG-99",
      },
      { fetchImplementation: fake.fetch },
    );
    expect(result).toMatchObject({ outcome: "relinked", previousIssue: { identifier: "ENG-99" } });
  });

  test("requires confirmation and never mutates when it is absent or mismatched", async () => {
    const absent = fetchSequence([
      response(detail("ENG-215: apply", "ENG-99")),
      response(detail("ENG-215: apply", "ENG-99")),
    ]);
    expect(
      (
        await runWorkflow(
          { command: "link", "session-id": sessionId, "expected-candidate": "ENG-215" },
          { fetchImplementation: absent.fetch },
        )
      ).outcome,
    ).toBe("confirmation_required");
    expect(absent.requests).toHaveLength(2);

    const mismatch = fetchSequence([
      response(detail("ENG-215: apply", "ENG-99")),
      response(detail("ENG-215: apply", "ENG-99")),
    ]);
    expect(
      (
        await runWorkflow(
          {
            command: "link",
            "session-id": sessionId,
            "expected-candidate": "ENG-215",
            "confirm-replace-from": "ENG-100",
          },
          { fetchImplementation: mismatch.fetch },
        )
      ).outcome,
    ).toBe("stale_preflight");
  });

  test("detects changed title during preflight and does not relink", async () => {
    const fake = fetchSequence([response(detail()), response(detail("ENG-216: apply"))]);
    const result = await runWorkflow(
      { command: "link", "session-id": sessionId, "expected-candidate": "ENG-215" },
      { fetchImplementation: fake.fetch },
    );
    expect(result.outcome).toBe("stale_preflight");
    expect(fake.requests).toHaveLength(2);
  });

  test("detects a changed committed link during preflight", async () => {
    const fake = fetchSequence([response(detail()), response(detail("ENG-215: apply", "ENG-99"))]);
    const result = await runWorkflow(
      { command: "link", "session-id": sessionId, "expected-candidate": "ENG-215" },
      { fetchImplementation: fake.fetch },
    );
    expect(result.outcome).toBe("stale_preflight");
  });

  test("maps sanitized Linear and protocol failures without leaking payloads", async () => {
    const cases = [
      [409, "linear_unconfigured", undefined, "linear_unconfigured"],
      [404, "linear_relink_not_found", undefined, "linear_not_found"],
      [409, "linear_relink_stale_title", undefined, "stale_title"],
      [503, "linear_relink_rate_limit", "rate_limit", "linear_failure"],
      [422, "linear_relink_candidate_missing", undefined, "invalid_title"],
    ] as const;
    for (const [status, code, failureCategory, outcome] of cases) {
      const fake = fetchSequence([
        response(detail()),
        response(detail()),
        response(
          { error: { code, message: "SECRET RAW RESPONSE", ...(failureCategory ? { failureCategory } : {}) } },
          status,
        ),
      ]);
      const result = await runWorkflow(
        { command: "link", "session-id": sessionId, "expected-candidate": "ENG-215" },
        { fetchImplementation: fake.fetch },
      );
      expect(result.outcome).toBe(outcome);
      expect(JSON.stringify(result)).not.toContain("SECRET");
    }
  });
});

test("uses stable exit status classes and title parsing", () => {
  expect(exitStatus("linked")).toBe(0);
  expect(exitStatus("confirmation_required")).toBe(2);
  expect(exitStatus("observer_unavailable")).toBe(1);
  expect(parseTitle(" ENG-215: phase ")).toEqual({ candidate: "ENG-215", phase: "phase" });
  expect(parseTitle("work on ENG-215")).toBeUndefined();
});

test("skill metadata is explicit-only and duplicate guidance never chooses by recency", async () => {
  const [metadata, instructions] = await Promise.all([
    readFile(new URL("../../agents/openai.yaml", import.meta.url), "utf8"),
    readFile(new URL("../../SKILL.md", import.meta.url), "utf8"),
  ]);
  expect(metadata).toContain("allow_implicit_invocation: false");
  expect(instructions).toContain("Never use recency");
  expect(instructions).toContain("For zero or duplicate");
});
