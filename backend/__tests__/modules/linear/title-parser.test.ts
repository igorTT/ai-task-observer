import { describe, expect, test } from "bun:test";

import {
  stateForCurrentTitle,
  stateForLookupResult,
  titleFingerprint,
} from "@/modules/linear/attribution-state.js";
import { parseSessionTitle } from "@/modules/linear/title-parser.js";

describe("Linear session title parser", () => {
  test.each([
    ["ENG-215", { kind: "candidate", candidateIdentifier: "ENG-215" }],
    [" eng-215:  apply ", { kind: "candidate", candidateIdentifier: "ENG-215", phase: "apply" }],
    ["A1-9:", { kind: "candidate", candidateIdentifier: "A1-9" }],
    ["ENG-0", { kind: "unlinked" }],
    ["ENG--1", { kind: "unlinked" }],
    ["215-ENG", { kind: "unlinked" }],
    ["work ENG-215", { kind: "unlinked" }],
    ["ENG-215 apply", { kind: "unlinked" }],
    ["ENG-215: ", { kind: "candidate", candidateIdentifier: "ENG-215" }],
    ["", { kind: "unlinked" }],
  ])("parses %p deterministically", (title, expected) => {
    expect(parseSessionTitle(title)).toEqual(expected as ReturnType<typeof parseSessionTitle>);
  });
});

describe("current attribution state", () => {
  test("handles new, renamed, phase-only, unconfigured, not-found, and retryable states", () => {
    const initial = stateForCurrentTitle({
      sessionId: "session",
      title: "ENG-1: explore",
      configured: true,
    });
    expect(initial).toMatchObject({ status: "pending", candidateIdentifier: "ENG-1" });
    const linked = stateForLookupResult(initial, {
      kind: "found",
      issue: {
        linearId: "issue-1",
        identifier: "ENG-1",
        title: "Issue",
        url: "https://linear.app/issue/ENG-1",
        team: { id: "team", key: "ENG", name: "Engineering" },
        state: { id: "state", name: "Todo" },
        updatedAt: new Date(),
      },
    });
    const phaseOnly = stateForCurrentTitle({
      sessionId: "session",
      title: "ENG-1: apply",
      configured: true,
      previous: linked,
    });
    expect(phaseOnly).toMatchObject({ status: "linked", linearId: "issue-1", phase: "apply" });
    const renamed = stateForCurrentTitle({
      sessionId: "session",
      title: "ENG-2",
      configured: true,
      previous: phaseOnly,
    });
    expect(renamed).toMatchObject({
      status: "linked",
      candidateIdentifier: "ENG-2",
      linearId: "issue-1",
    });
    const notFoundRefresh = stateForLookupResult(renamed, { kind: "not_found" });
    expect(notFoundRefresh).toMatchObject({ status: "linked", linearId: "issue-1" });
    const retryable = stateForLookupResult(
      stateForCurrentTitle({ sessionId: "unlinked", title: "ENG-2", configured: true }),
      { kind: "error", category: "network" },
    );
    expect(retryable).toMatchObject({ status: "error", failureCategory: "network" });
    const cleared = stateForCurrentTitle({
      sessionId: "session",
      title: "ordinary title",
      configured: true,
      previous: renamed,
    });
    expect(cleared).toMatchObject({ status: "linked", linearId: "issue-1" });
    expect(cleared.candidateIdentifier).toBeUndefined();
    expect(
      stateForCurrentTitle({ sessionId: "new", title: "ENG-3", configured: false }),
    ).toMatchObject({ status: "unconfigured", candidateIdentifier: "ENG-3" });
    expect(titleFingerprint("ENG-1")).not.toBe(titleFingerprint("ENG-2"));
  });

  test("retains a committed link when refresh fails", () => {
    const linked = stateForLookupResult(
      stateForCurrentTitle({ sessionId: "session", title: "ENG-1", configured: true }),
      {
        kind: "found",
        issue: {
          linearId: "issue-1",
          identifier: "ENG-1",
          title: "Issue",
          url: "https://linear.app/issue/ENG-1",
          team: { id: "team", key: "ENG", name: "Engineering" },
          state: { id: "state", name: "Todo" },
          updatedAt: new Date(),
        },
      },
    );
    expect(stateForLookupResult(linked, { kind: "error", category: "timeout" })).toMatchObject({
      status: "linked",
      linearId: "issue-1",
      failureCategory: "timeout",
    });
  });
});
