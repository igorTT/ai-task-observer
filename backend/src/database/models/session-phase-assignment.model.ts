import type { SessionPhase } from "@/modules/sessions/domain.js";

export interface SessionPhaseAssignmentRow {
  readonly session_id: string;
  readonly phase: SessionPhase;
}

export interface SessionPhaseAssignment {
  readonly sessionId: string;
  readonly phase: SessionPhase;
}

export function mapSessionPhaseAssignmentRow(
  row: SessionPhaseAssignmentRow,
): SessionPhaseAssignment {
  return { sessionId: row.session_id, phase: row.phase };
}
