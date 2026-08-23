import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapSessionPhaseAssignmentRow,
  type SessionPhaseAssignment,
  type SessionPhaseAssignmentRow,
} from "@/database/models/session-phase-assignment.model.js";
import type { SessionPhase } from "@/modules/sessions/domain.js";

export class SessionPhaseAssignmentRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async findBySessionId(sessionId: string): Promise<SessionPhaseAssignment | undefined> {
    const statement = await this.connection.prepare(
      "SELECT session_id, phase FROM session_phase_assignments WHERE session_id = $sessionId",
    );
    statement.bind({ sessionId });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as SessionPhaseAssignmentRow[])[0];
    return row ? mapSessionPhaseAssignmentRow(row) : undefined;
  }

  public async upsert(sessionId: string, phase: SessionPhase): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO session_phase_assignments (session_id, phase)
      VALUES ($sessionId, $phase)
      ON CONFLICT (session_id) DO UPDATE SET phase = excluded.phase
    `);
    statement.bind({ sessionId, phase });
    await statement.run();
  }

  public async clear(sessionId: string): Promise<void> {
    const statement = await this.connection.prepare(
      "DELETE FROM session_phase_assignments WHERE session_id = $sessionId",
    );
    statement.bind({ sessionId });
    await statement.run();
  }
}
