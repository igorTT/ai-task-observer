import type { LinearFailureCategory } from "@/modules/linear/domain.js";

export class LinearNotConfiguredError extends Error {
  public readonly status = 409;
  public readonly code = "linear_unconfigured";

  public constructor() {
    super("Linear integration is not configured");
    this.name = "LinearNotConfiguredError";
  }
}

export class SessionRelinkError extends Error {
  public readonly expose = true;

  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly failureCategory?: LinearFailureCategory,
  ) {
    super(message);
    this.name = "SessionRelinkError";
  }
}
