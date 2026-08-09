import { describe, expect, test } from "bun:test";

import {
  LinearSdkIssueReader,
  type LinearSdkClientShape,
  type LinearSdkIssueShape,
} from "@/modules/linear/linear-sdk-reader.js";
import type { LinearLookupResult } from "@/modules/linear/domain.js";

function issue(identifier = "ENG-42"): LinearSdkIssueShape {
  return {
    id: "linear-42",
    identifier,
    title: "Privacy-safe title",
    url: "https://linear.app/example/issue/ENG-42",
    updatedAt: new Date("2026-08-09T09:00:00.000Z"),
    team: Promise.resolve({ id: "team", key: "ENG", name: "Engineering" }),
    state: Promise.resolve({ id: "state", name: "In Progress" }),
  };
}

function reader(
  result: LinearSdkIssueShape | undefined | Error | { status: number; message: string },
) {
  const client: LinearSdkClientShape = {
    issue: () => {
      if (result instanceof Error) return Promise.reject(result);
      if (result && "status" in result) {
        return Promise.reject(Object.assign(new Error(result.message), { status: result.status }));
      }
      return Promise.resolve(result);
    },
  };
  return new LinearSdkIssueReader("lin_api_never_exposed", client);
}

describe("read-only Linear SDK adapter", () => {
  test("maps only the permitted summary for an exact match", async () => {
    const result = await reader(issue()).findIssue("ENG-42");
    expect(result).toEqual({
      kind: "found",
      issue: {
        linearId: "linear-42",
        identifier: "ENG-42",
        title: "Privacy-safe title",
        url: "https://linear.app/example/issue/ENG-42",
        updatedAt: new Date("2026-08-09T09:00:00.000Z"),
        team: { id: "team", key: "ENG", name: "Engineering" },
        state: { id: "state", name: "In Progress" },
      },
    });
  });

  test.each([
    [undefined, { kind: "not_found" }],
    [{ status: 404, message: "not accessible" }, { kind: "not_found" }],
    [issue("ENG-41"), { kind: "error", category: "identifier_mismatch" }],
    [
      { status: 401, message: "lin_api_secret credential rejected" },
      { kind: "error", category: "authentication" },
    ],
    [
      { status: 429, message: "raw upstream payload" },
      { kind: "error", category: "rate_limit" },
    ],
    [
      { status: 503, message: "raw server response" },
      { kind: "error", category: "upstream" },
    ],
    [new Error("request timeout with lin_api_secret"), { kind: "error", category: "timeout" }],
    [new Error("network failure with lin_api_secret"), { kind: "error", category: "network" }],
  ])("sanitizes lookup outcome %#", async (sdkResult, expected) => {
    const result = await reader(sdkResult).findIssue("ENG-42");
    expect(result).toEqual(expected as LinearLookupResult);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("raw");
  });

  test("uses no SDK mutation surface", () => {
    const adapter = reader(issue());
    expect(Object.getOwnPropertyNames(Object.getPrototypeOf(adapter))).toEqual([
      "constructor",
      "findIssue",
    ]);
  });
});
