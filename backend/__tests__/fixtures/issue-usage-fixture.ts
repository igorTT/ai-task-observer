import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import pino from "pino";

import { AppDatabase } from "@/database/database.js";
import { applyMigrations } from "@/database/migrate.js";

export interface IssueUsageFixture {
  readonly database: AppDatabase;
  readonly dispose: () => Promise<void>;
}

export async function createIssueUsageFixture(): Promise<IssueUsageFixture> {
  const directory = await mkdtemp(join(tmpdir(), "issue-usage-"));
  const database = await AppDatabase.open(join(directory, "fixture.duckdb"));
  await applyMigrations(database, pino({ enabled: false }));
  await database.connection.run(`
    INSERT INTO linear_issues VALUES
      ('issue-1', 'ENG-1', 'First issue', 'https://linear.test/ENG-1',
        'team', 'ENG', 'Engineering', 'state', 'Doing',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('issue-2', 'ENG-2', 'Second issue', 'https://linear.test/ENG-2',
        'team', 'ENG', 'Engineering', 'state', 'Doing',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('issue-empty', 'ENG-9', 'Cached only', 'https://linear.test/ENG-9',
        'team', 'ENG', 'Engineering', 'state', 'Todo',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z');

    INSERT INTO codex_sessions (
      session_id, source_root, source_path, current_title, started_at, ended_at,
      developer_turns, import_state, parser_version, last_error
    ) VALUES
      ('session-a', '/root', '/root/a.jsonl', 'ENG-1: explore',
        '2026-08-01T08:00:00.000Z', '2026-08-02T09:00:00.000Z', 3, 'ready', 2, NULL),
      ('session-b', '/root', '/root/b.jsonl', 'ENG-1: apply',
        '2026-08-01T09:00:00.000Z', NULL, 1, 'importing', 2, 'retained prior snapshot'),
      ('session-c', '/root', '/root/c.jsonl', 'ENG-2',
        NULL, NULL, 1, 'ready', 2, NULL),
      ('session-u', '/root', '/root/u.jsonl', 'ordinary title',
        '2026-08-01T07:00:00.000Z', NULL, 1, 'ready', 2, NULL),
      ('session-no-usage', '/root', '/root/no-usage.jsonl', 'no usage',
        '2026-08-01T06:00:00.000Z', NULL, 0, 'ready', 2, NULL);

    INSERT INTO linear_session_attributions (
      session_id, title_fingerprint, candidate_identifier,
      resolution_status, linear_id, last_attempt_at, last_success_at
    ) VALUES
      ('session-a', 'a-fingerprint', 'ENG-1', 'linked', 'issue-1',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('session-b', 'b-fingerprint', 'ENG-1', 'linked', 'issue-1',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('session-c', 'c-fingerprint', 'ENG-2', 'linked', 'issue-2',
        '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z'),
      ('session-u', 'u-fingerprint', NULL, 'unlinked', NULL, NULL, NULL);

    INSERT INTO session_phase_assignments (session_id, phase) VALUES
      ('session-a', 'explore'),
      ('session-b', 'apply');

    INSERT INTO codex_session_events (
      event_id, session_id, source_path, source_identity, source_record_number,
      event_kind, message_role, event_time, message_content, parser_version
    ) VALUES
      ('turn-a-1', 'session-a', '/root/a.jsonl', 'a', 1, 'user_message', 'user',
        '2026-08-01T10:00:00.000Z', 'selected', 2),
      ('turn-a-2', 'session-a', '/root/a.jsonl', 'a', 2, 'user_message', 'user',
        '2026-08-01T11:00:00.000Z', 'selected', 2),
      ('turn-a-3', 'session-a', '/root/a.jsonl', 'a', 3, 'user_message', 'user',
        '2026-08-02T09:00:00.000Z', 'selected', 2),
      ('turn-b-1', 'session-b', '/root/b.jsonl', 'b', 1, 'user_message', 'user',
        '2026-08-01T12:00:00.000Z', 'selected', 2),
      ('turn-c-1', 'session-c', '/root/c.jsonl', 'c', 1, 'user_message', 'user',
        NULL, 'selected', 2),
      ('turn-u-1', 'session-u', '/root/u.jsonl', 'u', 1, 'user_message', 'user',
        '2026-08-01T12:00:00.000Z', 'selected', 2);

    INSERT INTO codex_usage_observations (
      observation_id, session_id, source_path, source_identity, source_record_number,
      parser_version, model, event_time, normalized_input, normalized_cached_input,
      normalized_uncached_input, normalized_output, normalized_total,
      normalization_epoch, normalization_method, complete, anomaly_codes, legacy
    ) VALUES
      ('obs-a-1', 'session-a', '/root/a.jsonl', 'a', 10, 2, 'gpt-alias-a',
        '2026-08-01T10:30:00.000Z', 100, 20, 80, 10, 110, 0,
        'standalone_delta', true, '[]', false),
      ('obs-a-2', 'session-a', '/root/a.jsonl', 'a', 11, 2, 'gpt-alias-b',
        '2026-08-02T10:30:00.000Z', 50, 10, 40, 5, 55, 0,
        'standalone_delta', true, '[]', false),
      ('obs-a-3', 'session-a', '/root/a.jsonl', 'a', 12, 2, 'mystery-model',
        NULL, 30, NULL, NULL, 3, 33, 0,
        'reset_incomplete', false, '["cached_exceeds_input"]', false),
      ('obs-b-1', 'session-b', '/root/b.jsonl', 'b', 10, 2, 'gpt-alias-a',
        '2026-08-01T12:30:00.000Z', 20, 0, 20, 2, 22, 0,
        'standalone_delta', true, '[]', false),
      ('obs-c-1', 'session-c', '/root/c.jsonl', 'c', 10, 2, 'gpt-alias-a',
        '2026-08-02T13:00:00.000Z', 7, 1, 6, 1, 8, 0,
        'standalone_delta', true, '[]', false),
      ('obs-u-1', 'session-u', '/root/u.jsonl', 'u', 10, 2, 'gpt-alias-a',
        '2026-08-01T13:00:00.000Z', 999, 0, 999, 99, 1098, 0,
        'standalone_delta', true, '[]', false);

    INSERT INTO cost_calculation_generations VALUES
      ('generation-stale', 'old-revision', 'completed', 1, 'catalog-old', 'old-hash',
        '1', 1000000, '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:01.000Z', NULL),
      ('generation-current', 'current-revision', 'completed', 1, 'catalog-current',
        'current-hash', '1', 1000000, '2026-08-03T00:00:00.000Z',
        '2026-08-03T00:00:01.000Z', NULL),
      ('generation-running', 'newer-revision', 'running', 1, 'catalog-next', 'next-hash',
        '1', 1000000, '2026-08-04T00:00:00.000Z', NULL, NULL),
      ('generation-failed', 'failed-revision', 'failed', 1, 'catalog-bad', 'bad-hash',
        '1', 1000000, '2026-08-05T00:00:00.000Z', '2026-08-05T00:00:01.000Z',
        'calculation_failed');

    INSERT INTO cost_calculation_items (
      generation_id, observation_id, session_id, source_path, source_identity,
      source_record_number, observed_model, observation_time, canonical_model,
      uncached_input_tokens, cached_input_tokens, output_tokens,
      estimated_cost_usd, cost_complete, gap_codes, anomaly_codes
    ) VALUES
      ('generation-stale', 'obs-b-1', 'session-b', '/root/b.jsonl', 'b', 10,
        'gpt-alias-a', '2026-08-01T12:30:00.000Z', 'gpt-5.6', 20, 0, 2,
        9.000000000000000000000000, true, '[]', '[]'),
      ('generation-current', 'obs-a-1', 'session-a', '/root/a.jsonl', 'a', 10,
        'gpt-alias-a', '2026-08-01T10:30:00.000Z', 'gpt-5.6', 80, 20, 10,
        0.100000000000000000000000, true, '[]', '[]'),
      ('generation-current', 'obs-a-2', 'session-a', '/root/a.jsonl', 'a', 11,
        'gpt-alias-b', '2026-08-02T10:30:00.000Z', 'gpt-5.6', 40, 10, 5,
        0.050000000000000000000000, true, '[]', '[]'),
      ('generation-current', 'obs-a-3', 'session-a', '/root/a.jsonl', 'a', 12,
        'mystery-model', NULL, NULL, NULL, NULL, 3, NULL, false,
        '["unknown_model","unknown_observation_time","cached_input_unavailable"]',
        '["cached_exceeds_input"]'),
      ('generation-current', 'obs-c-1', 'session-c', '/root/c.jsonl', 'c', 10,
        'gpt-alias-a', '2026-08-02T13:00:00.000Z', 'gpt-5.6', 6, 1, 1,
        0.007000000000000000000000, true, '[]', '[]'),
      ('generation-current', 'obs-u-1', 'session-u', '/root/u.jsonl', 'u', 10,
        'gpt-alias-a', '2026-08-01T13:00:00.000Z', 'gpt-5.6', 999, 0, 99,
        0.009000000000000000000000, true, '[]', '[]');
  `);
  return {
    database,
    dispose: async () => {
      database.close();
      await rm(directory, { recursive: true, force: true });
    },
  };
}
