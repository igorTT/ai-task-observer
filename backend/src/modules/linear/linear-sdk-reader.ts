import {
  AuthenticationLinearError,
  ForbiddenLinearError,
  InternalLinearError,
  LinearClient,
  NetworkLinearError,
  RatelimitedLinearError,
  UsageLimitExceededLinearError,
} from "@linear/sdk";

import type {
  LinearFailureCategory,
  LinearIssueReader,
  LinearIssueSummary,
  LinearLookupResult,
} from "@/modules/linear/domain.js";

interface LinearSdkClient {
  readonly issue: (identifier: string) => Promise<IssueLike | undefined>;
}

interface IssueLike {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly updatedAt: Date;
  readonly team: Promise<{ readonly id: string; readonly key: string; readonly name: string }>;
  readonly state: Promise<{ readonly id: string; readonly name: string }> | undefined;
}

export class LinearSdkIssueReader implements LinearIssueReader {
  readonly #client: LinearSdkClient;

  public constructor(
    apiKey: string,
    client: LinearSdkClient = new LinearClient({ apiKey }) as unknown as LinearSdkClient,
  ) {
    this.#client = client;
  }

  public async findIssue(identifier: string): Promise<LinearLookupResult> {
    try {
      const issue = await this.#client.issue(identifier);
      if (!issue) return { kind: "not_found" };
      if (issue.identifier.toUpperCase() !== identifier.toUpperCase()) {
        return { kind: "error", category: "identifier_mismatch" };
      }
      return { kind: "found", issue: await mapIssue(issue) };
    } catch (error) {
      if (isNotFound(error)) return { kind: "not_found" };
      return { kind: "error", category: classifyLinearError(error) };
    }
  }
}

async function mapIssue(issue: IssueLike): Promise<LinearIssueSummary> {
  const [team, state] = await Promise.all([issue.team, issue.state]);
  if (!state) return Promise.reject(new Error("Linear issue has no workflow state"));
  return {
    linearId: issue.id,
    identifier: issue.identifier.toUpperCase(),
    title: issue.title,
    url: issue.url,
    team: { id: team.id, key: team.key, name: team.name },
    state: { id: state.id, name: state.name },
    updatedAt: new Date(issue.updatedAt),
  };
}

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? error.status : undefined;
  return status === 404;
}

export function classifyLinearError(error: unknown): LinearFailureCategory {
  if (error instanceof AuthenticationLinearError || error instanceof ForbiddenLinearError) {
    return "authentication";
  }
  if (error instanceof RatelimitedLinearError || error instanceof UsageLimitExceededLinearError) {
    return "rate_limit";
  }
  if (error instanceof NetworkLinearError) {
    return error.message.toLowerCase().includes("timeout") ? "timeout" : "network";
  }
  if (error instanceof InternalLinearError) return "upstream";
  if (error instanceof Error && /timeout|abort/iu.test(error.name + error.message))
    return "timeout";
  if (
    error instanceof Error &&
    /network|fetch failed|ECONNRESET|ECONNREFUSED|ENOTFOUND/iu.test(error.name + error.message)
  ) {
    return "network";
  }
  const status =
    error && typeof error === "object" && "status" in error ? Number(error.status) : undefined;
  if (status === 401 || status === 403) return "authentication";
  if (status === 429) return "rate_limit";
  if (status !== undefined && status >= 500) return "upstream";
  return "unknown";
}

export type { IssueLike as LinearSdkIssueShape, LinearSdkClient as LinearSdkClientShape };
