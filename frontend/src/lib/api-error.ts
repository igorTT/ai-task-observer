interface QueryError {
  status?: unknown;
  data?: unknown;
}

const SAFE_CODES: Record<string, string> = {
  NOT_FOUND: "The requested item is no longer available.",
  STALE_TITLE: "The session title changed. Refresh and try again.",
  LINEAR_UNCONFIGURED: "Linear is not configured.",
  VALIDATION_ERROR: "The request is no longer valid. Refresh and try again.",
};

export interface NormalizedApiError {
  code: string;
  message: string;
  notFound: boolean;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  const queryError = error as QueryError;
  const data = queryError?.data as { error?: { code?: unknown; message?: unknown } } | undefined;
  const code = typeof data?.error?.code === "string" ? data.error.code : "UNKNOWN";
  return {
    code,
    message:
      SAFE_CODES[code] ??
      (queryError?.status === 404
        ? "The requested item is no longer available."
        : "The request could not be completed. Please try again."),
    notFound: queryError?.status === 404 || code === "NOT_FOUND",
  };
}
