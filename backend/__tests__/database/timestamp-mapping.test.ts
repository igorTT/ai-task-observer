import { DuckDBDateValue, DuckDBTimestampTZValue } from "@duckdb/node-api";
import { expect, test } from "bun:test";

import {
  mapDateAsUtc,
  mapNullableDateAsUtc,
  mapNullableTimestampWithTimeZone,
  mapTimestampWithTimeZone,
} from "@/database/models/timestamp.model.js";

test("maps TIMESTAMPTZ epoch microseconds without using the host timezone", () => {
  const timestamp = new DuckDBTimestampTZValue(1_787_421_900_123_456n);

  expect(mapTimestampWithTimeZone(timestamp).toISOString()).toBe("2026-08-22T18:05:00.123Z");
  expect(mapNullableTimestampWithTimeZone(null)).toBeNull();
});

test("maps DATE days as a UTC calendar date", () => {
  const date = new DuckDBDateValue(20_687);

  expect(mapDateAsUtc(date).toISOString()).toBe("2026-08-22T00:00:00.000Z");
  expect(mapNullableDateAsUtc(null)).toBeNull();
});

test("rejects invalid and out-of-range database timestamp values", () => {
  expect(() => mapTimestampWithTimeZone(DuckDBTimestampTZValue.PosInf)).toThrow(
    "Expected a finite DuckDB TIMESTAMPTZ value",
  );
  expect(() =>
    mapTimestampWithTimeZone(new DuckDBTimestampTZValue(8_640_000_000_000_001_000n)),
  ).toThrow("outside the JavaScript Date range");
  expect(() => mapTimestampWithTimeZone(new Date() as never)).toThrow(
    "Expected a finite DuckDB TIMESTAMPTZ value",
  );
});
