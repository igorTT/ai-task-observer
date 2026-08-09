import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapLinearSessionAttributionRow,
  type LinearSessionAttributionRow,
} from "@/database/models/linear-session-attribution.model.js";
import type {
  AttributionStatus,
  LinearFailureCategory,
  SessionAttribution,
} from "@/modules/linear/domain.js";

export interface AttributionStateInput {
  readonly sessionId: string;
  readonly titleFingerprint: string;
  readonly candidateIdentifier?: string;
  readonly phase?: string;
  readonly status: AttributionStatus;
  readonly linearId?: string;
  readonly lastAttemptAt?: Date;
  readonly lastSuccessAt?: Date;
  readonly failureCategory?: LinearFailureCategory;
}

export class LinearSessionAttributionRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async save(input: AttributionStateInput): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO linear_session_attributions (
        session_id, title_fingerprint, candidate_identifier, phase, resolution_status,
        linear_id, last_attempt_at, last_success_at, failure_category
      ) VALUES (
        $sessionId, $fingerprint, $candidate, $phase, $status,
        $linearId, $lastAttemptAt, $lastSuccessAt, $failureCategory
      )
      ON CONFLICT (session_id) DO UPDATE SET
        title_fingerprint = excluded.title_fingerprint,
        candidate_identifier = excluded.candidate_identifier,
        phase = excluded.phase,
        resolution_status = excluded.resolution_status,
        linear_id = excluded.linear_id,
        last_attempt_at = excluded.last_attempt_at,
        last_success_at = excluded.last_success_at,
        failure_category = excluded.failure_category,
        updated_at = now()
    `);
    statement.bind({
      sessionId: input.sessionId,
      fingerprint: input.titleFingerprint,
      candidate: input.candidateIdentifier ?? null,
      phase: input.phase ?? null,
      status: input.status,
      linearId: input.linearId ?? null,
      lastAttemptAt: input.lastAttemptAt?.toISOString() ?? null,
      lastSuccessAt: input.lastSuccessAt?.toISOString() ?? null,
      failureCategory: input.failureCategory ?? null,
    });
    await statement.run();
  }

  public async replaceLink(
    input: AttributionStateInput & { readonly linearId: string },
  ): Promise<void> {
    const statement = await this.connection.prepare(`
      UPDATE linear_session_attributions SET
        title_fingerprint = $fingerprint,
        candidate_identifier = $candidate,
        phase = $phase,
        resolution_status = 'linked',
        linear_id = $linearId,
        last_attempt_at = $lastAttemptAt,
        last_success_at = $lastSuccessAt,
        failure_category = NULL,
        updated_at = now()
      WHERE session_id = $sessionId
    `);
    statement.bind({
      sessionId: input.sessionId,
      fingerprint: input.titleFingerprint,
      candidate: input.candidateIdentifier ?? null,
      phase: input.phase ?? null,
      linearId: input.linearId,
      lastAttemptAt: input.lastAttemptAt?.toISOString() ?? null,
      lastSuccessAt: input.lastSuccessAt?.toISOString() ?? null,
    });
    await statement.run();
  }

  public async findBySessionId(sessionId: string): Promise<SessionAttribution | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM linear_session_attributions WHERE session_id = $sessionId",
    );
    statement.bind({ sessionId });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as LinearSessionAttributionRow[])[0];
    return row ? mapLinearSessionAttributionRow(row) : undefined;
  }

  public async list(): Promise<SessionAttribution[]> {
    const reader = await this.connection.runAndReadAll(
      "SELECT * FROM linear_session_attributions ORDER BY session_id",
    );
    return (reader.getRowObjects() as unknown as LinearSessionAttributionRow[]).map(
      mapLinearSessionAttributionRow,
    );
  }

  public async deleteBySessionId(sessionId: string): Promise<void> {
    const statement = await this.connection.prepare(
      "DELETE FROM linear_session_attributions WHERE session_id = $sessionId",
    );
    statement.bind({ sessionId });
    await statement.run();
  }

  public async counts(): Promise<Record<AttributionStatus, number>> {
    const reader = await this.connection.runAndReadAll(`
      SELECT resolution_status, count(*) AS count
      FROM linear_session_attributions GROUP BY resolution_status
    `);
    const counts: Record<AttributionStatus, number> = {
      unlinked: 0,
      unconfigured: 0,
      pending: 0,
      linked: 0,
      not_found: 0,
      error: 0,
    };
    for (const row of reader.getRowObjects() as Array<{
      resolution_status: AttributionStatus;
      count: bigint;
    }>) {
      counts[row.resolution_status] = Number(row.count);
    }
    return counts;
  }
}
