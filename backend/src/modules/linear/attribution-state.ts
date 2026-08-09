import { createHash } from "node:crypto";

import type { LinearLookupResult, SessionAttribution } from "@/modules/linear/domain.js";
import { parseSessionTitle } from "@/modules/linear/title-parser.js";

export function titleFingerprint(title: string | undefined): string {
  return createHash("sha256")
    .update(title ?? "")
    .digest("hex");
}

export function stateForCurrentTitle(input: {
  readonly sessionId: string;
  readonly title?: string;
  readonly configured: boolean;
  readonly previous?: SessionAttribution;
  readonly now?: Date;
}): SessionAttribution {
  const fingerprint = titleFingerprint(input.title);
  if (
    input.previous?.titleFingerprint === fingerprint &&
    !(input.configured && input.previous.status === "unconfigured")
  ) {
    return input.previous;
  }
  const parsed = parseSessionTitle(input.title);
  const updatedAt = input.now ?? new Date();
  if (input.previous?.status === "linked" && input.previous.linearId) {
    return {
      sessionId: input.previous.sessionId,
      titleFingerprint: fingerprint,
      ...(parsed.kind === "candidate"
        ? {
            candidateIdentifier: parsed.candidateIdentifier,
            ...(parsed.phase ? { phase: parsed.phase } : {}),
          }
        : {}),
      status: "linked",
      linearId: input.previous.linearId,
      ...(input.previous.lastAttemptAt ? { lastAttemptAt: input.previous.lastAttemptAt } : {}),
      ...(input.previous.lastSuccessAt ? { lastSuccessAt: input.previous.lastSuccessAt } : {}),
      ...(input.previous.failureCategory
        ? { failureCategory: input.previous.failureCategory }
        : {}),
      updatedAt,
    };
  }
  if (parsed.kind === "unlinked") {
    return {
      sessionId: input.sessionId,
      titleFingerprint: fingerprint,
      status: "unlinked",
      updatedAt,
    };
  }

  return {
    sessionId: input.sessionId,
    titleFingerprint: fingerprint,
    candidateIdentifier: parsed.candidateIdentifier,
    ...(parsed.phase ? { phase: parsed.phase } : {}),
    status: input.configured ? "pending" : "unconfigured",
    updatedAt,
  };
}

export function stateForLookupResult(
  current: SessionAttribution,
  result: LinearLookupResult,
  now = new Date(),
): SessionAttribution {
  if (current.status === "linked" && current.linearId) {
    return {
      sessionId: current.sessionId,
      titleFingerprint: current.titleFingerprint,
      ...(current.candidateIdentifier ? { candidateIdentifier: current.candidateIdentifier } : {}),
      ...(current.phase ? { phase: current.phase } : {}),
      status: "linked",
      linearId: current.linearId,
      lastAttemptAt: now,
      ...(result.kind === "found"
        ? { lastSuccessAt: now }
        : current.lastSuccessAt
          ? { lastSuccessAt: current.lastSuccessAt }
          : {}),
      ...(result.kind === "error" ? { failureCategory: result.category } : {}),
      updatedAt: now,
    };
  }
  if (result.kind === "found") {
    return {
      sessionId: current.sessionId,
      titleFingerprint: current.titleFingerprint,
      ...(current.candidateIdentifier ? { candidateIdentifier: current.candidateIdentifier } : {}),
      ...(current.phase ? { phase: current.phase } : {}),
      status: "linked",
      linearId: result.issue.linearId,
      lastAttemptAt: now,
      lastSuccessAt: now,
      updatedAt: now,
    };
  }
  if (result.kind === "not_found") {
    return {
      sessionId: current.sessionId,
      titleFingerprint: current.titleFingerprint,
      ...(current.candidateIdentifier ? { candidateIdentifier: current.candidateIdentifier } : {}),
      ...(current.phase ? { phase: current.phase } : {}),
      status: "not_found",
      lastAttemptAt: now,
      updatedAt: now,
    };
  }
  return {
    sessionId: current.sessionId,
    titleFingerprint: current.titleFingerprint,
    ...(current.candidateIdentifier ? { candidateIdentifier: current.candidateIdentifier } : {}),
    ...(current.phase ? { phase: current.phase } : {}),
    status: "error",
    lastAttemptAt: now,
    failureCategory: result.category,
    updatedAt: now,
  };
}
