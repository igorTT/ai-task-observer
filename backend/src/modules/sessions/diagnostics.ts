import { basename } from "node:path";

import type { SanitizedDiagnostic } from "@/modules/sessions/domain.js";

const MAX_MESSAGE_LENGTH = 160;

export function sanitizedDiagnostic(
  category: SanitizedDiagnostic["category"],
  sourcePath: string,
  message: string,
  recordNumber?: number,
): SanitizedDiagnostic {
  const sanitized = message
    .replace(/[\r\n\t]+/gu, " ")
    .replace(/(?:[A-Za-z]:)?[/\\][^ ]+/gu, "[path]")
    .slice(0, MAX_MESSAGE_LENGTH);
  return {
    category,
    sourcePath: basename(sourcePath),
    ...(recordNumber === undefined ? {} : { recordNumber }),
    message: sanitized,
  };
}

export function sanitizedError(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  return `${name}: ingestion operation failed`;
}
