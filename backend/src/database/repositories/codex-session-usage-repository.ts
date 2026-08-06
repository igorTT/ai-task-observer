import type { DuckDBConnection } from "@duckdb/node-api";

import {
  mapUsageRow,
  type CodexSessionUsageRecord,
  type CodexSessionUsageRow,
} from "@/database/models/codex-session-usage.model.js";
import { assertNonNegative, type TokenValues } from "@/modules/sessions/domain.js";

export class CodexSessionUsageRepository {
  public constructor(private readonly connection: DuckDBConnection) {}

  public async ensure(sessionId: string): Promise<void> {
    const statement = await this.connection.prepare(`
      INSERT INTO codex_session_usage (session_id) VALUES ($sessionId)
      ON CONFLICT (session_id) DO NOTHING
    `);
    statement.bind({ sessionId });
    await statement.run();
  }

  public async addDeveloperTurns(sessionId: string, delta: bigint): Promise<void> {
    assertNonNegative(delta, "developer turn delta");
    const statement = await this.connection.prepare(`
      UPDATE codex_sessions
      SET developer_turns = developer_turns + $delta, updated_at = now()
      WHERE session_id = $sessionId
    `);
    statement.bind({ sessionId, delta });
    await statement.run();
  }

  public async replaceTokens(sessionId: string, values: TokenValues): Promise<void> {
    assertNonNegative(values.input, "input tokens");
    assertNonNegative(values.cachedInput, "cached input tokens");
    assertNonNegative(values.output, "output tokens");
    await this.ensure(sessionId);
    const statement = await this.connection.prepare(`
      UPDATE codex_session_usage SET
        input_tokens = $input,
        cached_input_tokens = $cached,
        output_tokens = $output,
        total_tokens = $input + $cached + $output,
        usage_observed = true,
        updated_at = now()
      WHERE session_id = $sessionId
    `);
    statement.bind({
      sessionId,
      input: values.input,
      cached: values.cachedInput,
      output: values.output,
    });
    await statement.run();
  }

  public async addTokens(sessionId: string, values: TokenValues): Promise<void> {
    assertNonNegative(values.input, "input token delta");
    assertNonNegative(values.cachedInput, "cached input token delta");
    assertNonNegative(values.output, "output token delta");
    await this.ensure(sessionId);
    const statement = await this.connection.prepare(`
      UPDATE codex_session_usage SET
        input_tokens = input_tokens + $input,
        cached_input_tokens = cached_input_tokens + $cached,
        output_tokens = output_tokens + $output,
        total_tokens = total_tokens + $input + $cached + $output,
        usage_observed = true,
        updated_at = now()
      WHERE session_id = $sessionId
    `);
    statement.bind({
      sessionId,
      input: values.input,
      cached: values.cachedInput,
      output: values.output,
    });
    await statement.run();
  }

  public async findBySessionId(sessionId: string): Promise<CodexSessionUsageRecord | undefined> {
    const statement = await this.connection.prepare(
      "SELECT * FROM codex_session_usage WHERE session_id = $sessionId",
    );
    statement.bind({ sessionId });
    const reader = await statement.runAndReadAll();
    const row = (reader.getRowObjects() as unknown as CodexSessionUsageRow[])[0];
    return row ? mapUsageRow(row) : undefined;
  }
}
