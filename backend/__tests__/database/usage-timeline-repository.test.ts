import { afterEach, describe, expect, test } from "bun:test";

import {
  createIssueUsageFixture,
  type IssueUsageFixture,
} from "@tests/fixtures/issue-usage-fixture.js";
import { UsageTimelineRepository } from "@/database/repositories/usage-timeline-repository.js";
import type { UsageTimelineWindow } from "@/modules/usage-timeline/domain.js";

let fixture: IssueUsageFixture | undefined;

afterEach(async () => {
  await fixture?.dispose();
  fixture = undefined;
});

describe("UsageTimelineRepository", () => {
  test("aggregates global observations into clipped, zero-filled buckets", async () => {
    fixture = await createIssueUsageFixture();
    const repository = new UsageTimelineRepository(fixture.database.connection);
    const window = range("2026-08-01T02:15:00.000Z", "2026-08-01T14:15:00.000Z");

    const result = await repository.query(window, "generation-current");

    expect(result.unknownTimeObservationCount).toBe(1n);
    expect(result.buckets[0]).toMatchObject({
      startAt: new Date("2026-08-01T02:15:00.000Z"),
      endAt: new Date("2026-08-01T03:00:00.000Z"),
      totalTokens: 0n,
      estimatedCostUsd: "0",
      tokenComplete: true,
      costComplete: true,
    });
    expect(
      result.buckets.find((bucket) => bucket.startAt.toISOString() === "2026-08-01T10:00:00.000Z"),
    ).toMatchObject({
      totalTokens: 110n,
      estimatedCostUsd: "0.1",
    });
    expect(
      result.buckets.find((bucket) => bucket.startAt.toISOString() === "2026-08-01T12:00:00.000Z"),
    ).toMatchObject({
      totalTokens: 22n,
      estimatedCostUsd: null,
      costComplete: false,
      warnings: ["cost_unavailable", "uncovered_generation"],
    });
    expect(result.totals).toMatchObject({
      totalTokens: 1230n,
      estimatedCostUsd: "0.109",
      tokenComplete: true,
      costComplete: false,
    });
  });

  test("assigns exact-boundary observations to the next bucket and keeps all sessions global", async () => {
    fixture = await createIssueUsageFixture();
    await fixture.database.connection.run(`
      INSERT INTO codex_usage_observations (
        observation_id, session_id, source_path, source_identity, source_record_number,
        parser_version, model, event_time, normalized_input, normalized_cached_input,
        normalized_uncached_input, normalized_output, normalized_total,
        normalization_epoch, normalization_method, complete, anomaly_codes, legacy
      ) VALUES (
        'obs-boundary', 'session-u', '/root/u.jsonl', 'u', 11, 2, 'gpt-alias-a',
        '2026-08-01T11:00:00.000Z', 3, 0, 3, 1, 4, 0, 'standalone_delta', true, '[]', false
      )
    `);
    const repository = new UsageTimelineRepository(fixture.database.connection);
    const result = await repository.query(
      range("2026-08-01T10:30:00.000Z", "2026-08-01T12:30:00.000Z"),
      "generation-current",
    );

    expect(
      result.buckets.map((bucket) => [bucket.startAt.toISOString(), bucket.totalTokens]),
    ).toEqual([
      ["2026-08-01T10:30:00.000Z", 110n],
      ["2026-08-01T11:00:00.000Z", 4n],
      ["2026-08-01T12:00:00.000Z", 0n],
    ]);
  });

  test("keeps winter and summer observations in their UTC buckets", async () => {
    fixture = await createIssueUsageFixture();
    await fixture.database.connection.run(`
      INSERT INTO codex_usage_observations (
        observation_id, session_id, source_path, source_identity, source_record_number,
        parser_version, model, event_time, normalized_input, normalized_cached_input,
        normalized_uncached_input, normalized_output, normalized_total,
        normalization_epoch, normalization_method, complete, anomaly_codes, legacy
      ) VALUES
        ('obs-winter', 'session-u', '/root/winter.jsonl', 'winter', 1, 2, 'gpt-alias-a',
          '2026-01-15T10:30:00.000Z', 5, 0, 5, 1, 6, 0, 'standalone_delta', true, '[]', false),
        ('obs-summer', 'session-u', '/root/summer.jsonl', 'summer', 1, 2, 'gpt-alias-a',
          '2026-07-15T10:30:00.000Z', 7, 0, 7, 1, 8, 0, 'standalone_delta', true, '[]', false)
    `);
    const repository = new UsageTimelineRepository(fixture.database.connection);

    const winter = await repository.query(
      range("2026-01-15T10:00:00.000Z", "2026-01-15T12:00:00.000Z"),
    );
    const summer = await repository.query(
      range("2026-07-15T10:00:00.000Z", "2026-07-15T12:00:00.000Z"),
    );

    expect(
      winter.buckets.map((bucket) => [bucket.startAt.toISOString(), bucket.totalTokens]),
    ).toEqual([
      ["2026-01-15T10:00:00.000Z", 6n],
      ["2026-01-15T11:00:00.000Z", 0n],
    ]);
    expect(
      summer.buckets.map((bucket) => [bucket.startAt.toISOString(), bucket.totalTokens]),
    ).toEqual([
      ["2026-07-15T10:00:00.000Z", 8n],
      ["2026-07-15T11:00:00.000Z", 0n],
    ]);
  });

  test("keeps token usage available when the selected generation is missing", async () => {
    fixture = await createIssueUsageFixture();
    const repository = new UsageTimelineRepository(fixture.database.connection);

    const result = await repository.query(
      range("2026-08-02T12:00:00.000Z", "2026-08-02T14:00:00.000Z"),
    );

    expect(result.totals).toMatchObject({
      totalTokens: 8n,
      estimatedCostUsd: null,
      tokenComplete: true,
      costComplete: false,
      warnings: ["cost_unavailable", "uncovered_generation"],
    });
  });

  test("filters by current assignments, not titles or Linear attribution", async () => {
    fixture = await createIssueUsageFixture();
    await fixture.database.connection.run(`
      UPDATE codex_sessions SET current_title = 'ENG-999: proposal' WHERE session_id = 'session-u';
    `);
    const repository = new UsageTimelineRepository(fixture.database.connection);
    const window = range("2026-08-01T02:15:00.000Z", "2026-08-01T14:15:00.000Z");

    const unassigned = await repository.query(window, "generation-current", "unassigned");
    expect(unassigned.totals).toMatchObject({
      totalTokens: 1098n,
      estimatedCostUsd: "0.009",
      tokenComplete: true,
      costComplete: true,
    });
    expect(unassigned.unknownTimeObservationCount).toBe(0n);

    await fixture.database.connection.run(
      "INSERT INTO session_phase_assignments (session_id, phase) VALUES ('session-u', 'other')",
    );
    const other = await repository.query(window, "generation-current", "other");
    expect(other.totals.totalTokens).toBe(1098n);
    expect(
      (await repository.query(window, "generation-current", "unassigned")).totals.totalTokens,
    ).toBe(0n);

    await fixture.database.connection.run(
      "UPDATE session_phase_assignments SET phase = 'proposal' WHERE session_id = 'session-u'",
    );
    const proposal = await repository.query(window, "generation-current", "proposal");
    expect(proposal.totals.totalTokens).toBe(1098n);

    await fixture.database.connection.run(
      "UPDATE session_phase_assignments SET phase = 'apply' WHERE session_id = 'session-u'",
    );
    const apply = await repository.query(window, "generation-current", "apply");
    expect(apply.totals).toMatchObject({
      totalTokens: 1120n,
      tokenComplete: true,
      costComplete: false,
    });
    expect(
      (await repository.query(window, "generation-current", "proposal")).totals.totalTokens,
    ).toBe(0n);

    await fixture.database.connection.run(
      "DELETE FROM session_phase_assignments WHERE session_id = 'session-u'",
    );
    const cleared = await repository.query(window, "generation-current", "unassigned");
    expect(cleared.totals.totalTokens).toBe(1098n);
  });

  test("keeps incomplete and unknown-time facts scoped to the selected phase", async () => {
    fixture = await createIssueUsageFixture();
    await fixture.database.connection.run(`
      INSERT INTO codex_usage_observations (
        observation_id, session_id, source_path, source_identity, source_record_number,
        parser_version, model, event_time, normalized_input, normalized_cached_input,
        normalized_uncached_input, normalized_output, normalized_total,
        normalization_epoch, normalization_method, complete, anomaly_codes, legacy
      ) VALUES (
        'obs-incomplete-proposal', 'session-a', '/root/a.jsonl', 'a', 13, 2, 'mystery-model',
        '2026-08-01T10:45:00.000Z', 30, NULL, NULL, 3, 33, 0,
        'reset_incomplete', false, '["cached_exceeds_input"]', false
      )
    `);
    const repository = new UsageTimelineRepository(fixture.database.connection);
    const window = range("2026-08-01T10:00:00.000Z", "2026-08-01T14:00:00.000Z");

    const apply = await repository.query(window, "generation-current", "apply");
    expect(apply.totals).toMatchObject({
      totalTokens: 22n,
      tokenComplete: true,
      warnings: ["cost_unavailable", "uncovered_generation"],
    });
    const explore = await repository.query(window, "generation-current", "explore");
    expect(explore.totals).toMatchObject({
      totalTokens: null,
      estimatedCostUsd: "0.1",
      tokenComplete: false,
      warnings: ["cached_exceeds_input", "incomplete_tokens", "uncovered_generation"],
    });
    expect(explore.unknownTimeObservationCount).toBe(1n);
  });
});

function range(startAt: string, endAt: string): UsageTimelineWindow {
  return {
    range: "12h",
    bucketUnit: "hour",
    startAt: new Date(startAt),
    endAt: new Date(endAt),
  };
}
